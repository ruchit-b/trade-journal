/**
 * CSV import parsers for Zerodha, Upstox, and generic tradebook format.
 * Handles BOM, Windows line endings, empty rows, and date/number parsing.
 */

export type BrokerType = 'zerodha' | 'upstox' | 'generic' | 'unknown';

export interface ParsedTrade {
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryDate: Date;
  exitDate: Date;
  stopLoss: number;
  target: number;
  setupType: string | null;
  notes: string;
}

const UTF8_BOM = '\uFEFF';

function stripBom(s: string): string {
  return s.startsWith(UTF8_BOM) ? s.slice(UTF8_BOM.length) : s;
}

function normalizeLineEndings(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

export function parseCsvRows(raw: string): { headers: string[]; rows: string[][] } {
  const text = normalizeLineEndings(stripBom(raw.trim()));
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(lines[0]);
  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.some((c) => c.length > 0)) rows.push(cells);
  }
  return { headers, rows };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      current += c;
    } else if (c === ',' || c === ';') {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function getColumn(row: string[], headers: string[], name: string): string {
  const i = headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  if (i < 0 || i >= row.length) return '';
  return (row[i] ?? '').trim();
}

function parseNum(s: string): number | null {
  const cleaned = s.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(s: string, formatHint?: 'zerodha' | 'upstox' | 'iso'): Date | null {
  const t = s.trim();
  if (!t) return null;
  if (formatHint === 'zerodha' || formatHint === 'upstox') {
    const d = new Date(t);
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const d = new Date(t);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function detectBroker(headers: string[]): BrokerType {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const has = (name: string) => lower.includes(name.toLowerCase());
  if (
    has('symbol') &&
    (has('trade_date') || has('trade date')) &&
    (has('trade_type') || has('trade type')) &&
    has('quantity') &&
    has('price')
  ) {
    return 'zerodha';
  }
  const buySellCol = has('buy/sell') || has('buy/sell (b/s)');
  if (has('date') && has('scrip') && buySellCol && has('quantity') && has('price')) {
    return 'upstox';
  }
  if (
    has('symbol') &&
    has('direction') &&
    has('entry_price') &&
    has('exit_price') &&
    has('quantity') &&
    has('entry_date') &&
    has('exit_date')
  ) {
    return 'generic';
  }
  return 'unknown';
}

interface ZerodhaRow {
  symbol: string;
  date: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  time: number;
}

function parseZerodhaRows(headers: string[], rows: string[][]): ZerodhaRow[] {
  const out: ZerodhaRow[] = [];
  for (const row of rows) {
    const symbol = getColumn(row, headers, 'symbol').toUpperCase();
    const tradeDate = getColumn(row, headers, 'trade_date') || getColumn(row, headers, 'trade date');
    const tradeType = getColumn(row, headers, 'trade_type') || getColumn(row, headers, 'trade type');
    const qty = parseNum(getColumn(row, headers, 'quantity'));
    const price = parseNum(getColumn(row, headers, 'price'));
    const execTime = getColumn(row, headers, 'order_execution_time');
    if (!symbol || qty == null || qty <= 0 || price == null || price < 0) continue;
    const type = tradeType.toLowerCase().startsWith('sell') ? 'sell' : 'buy';
    const date = tradeDate || '';
    const time = execTime ? new Date(execTime).getTime() : new Date(date).getTime();
    out.push({ symbol, date, type, quantity: Math.floor(qty), price, time });
  }
  return out;
}

function fifoMatchZerodha(rows: ZerodhaRow[]): ParsedTrade[] {
  const bySymbol = new Map<string, ZerodhaRow[]>();
  for (const r of rows) {
    if (!bySymbol.has(r.symbol)) bySymbol.set(r.symbol, []);
    bySymbol.get(r.symbol)!.push(r);
  }
  const trades: ParsedTrade[] = [];
  for (const [, symbolRows] of bySymbol) {
    symbolRows.sort((a, b) => a.time - b.time);
    const buys: { date: string; qty: number; price: number }[] = [];
    const sells: { date: string; qty: number; price: number }[] = [];
    for (const r of symbolRows) {
      if (r.type === 'buy') buys.push({ date: r.date, qty: r.quantity, price: r.price });
      else sells.push({ date: r.date, qty: r.quantity, price: r.price });
    }
    let i = 0;
    let j = 0;
    let buyRemain = 0;
    let buySum = 0;
    let buyDate = '';
    let sellRemain = 0;
    let sellSum = 0;
    let sellDate = '';

    while (i < buys.length || j < sells.length || buyRemain > 0 || sellRemain > 0) {
      if (buyRemain <= 0 && i < buys.length) {
        buyRemain = buys[i].qty;
        buySum = buys[i].price * buyRemain;
        buyDate = buys[i].date;
        i++;
      }
      if (sellRemain <= 0 && j < sells.length) {
        sellRemain = sells[j].qty;
        sellSum = sells[j].price * sellRemain;
        sellDate = sells[j].date;
        j++;
      }
      if (buyRemain <= 0 || sellRemain <= 0) break;
      const matchQty = Math.min(buyRemain, sellRemain);
      const entryPrice = buySum / buyRemain;
      const exitPrice = sellSum / sellRemain;
      const entryD = parseDate(buyDate, 'zerodha');
      const exitD = parseDate(sellDate, 'zerodha');
      if (!entryD || !exitD) {
        buyRemain -= matchQty;
        sellRemain -= matchQty;
        continue;
      }
      const direction: 'long' | 'short' = entryD.getTime() <= exitD.getTime() ? 'long' : 'short';
      trades.push({
        symbol: symbolRows[0].symbol,
        direction,
        entryPrice,
        exitPrice,
        quantity: matchQty,
        entryDate: entryD,
        exitDate: exitD,
        stopLoss: entryPrice,
        target: entryPrice,
        setupType: null,
        notes: 'Imported from Zerodha',
      });
      buySum -= entryPrice * matchQty;
      buyRemain -= matchQty;
      sellSum -= exitPrice * matchQty;
      sellRemain -= matchQty;
    }
  }
  return trades;
}

export function parseZerodha(csvRaw: string): { trades: ParsedTrade[]; errors: string[] } {
  const errors: string[] = [];
  const { headers, rows } = parseCsvRows(csvRaw);
  if (headers.length === 0) {
    errors.push('CSV has no header row');
    return { trades: [], errors };
  }
  const zerodhaRows = parseZerodhaRows(headers, rows);
  const trades = fifoMatchZerodha(zerodhaRows);
  return { trades, errors };
}

interface UpstoxRow {
  symbol: string;
  date: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  time: number;
}

function parseUpstoxRows(headers: string[], rows: string[][]): UpstoxRow[] {
  const out: UpstoxRow[] = [];
  for (const row of rows) {
    const scrip = getColumn(row, headers, 'Scrip') || getColumn(row, headers, 'scrip');
    const symbol = scrip.toUpperCase().trim();
    const dateStr = getColumn(row, headers, 'Date') || getColumn(row, headers, 'date');
    const buySell = getColumn(row, headers, 'Buy/Sell') || getColumn(row, headers, 'Buy/Sell (B/S)') || getColumn(row, headers, 'buy/sell');
    const qty = parseNum(getColumn(row, headers, 'Quantity') || getColumn(row, headers, 'quantity'));
    const price = parseNum(getColumn(row, headers, 'Price') || getColumn(row, headers, 'price'));
    if (!symbol || qty == null || qty <= 0 || price == null || price < 0) continue;
    const type = buySell.toLowerCase().startsWith('s') ? 'sell' : 'buy';
    const time = dateStr ? new Date(dateStr).getTime() : 0;
    out.push({ symbol, date: dateStr, type, quantity: Math.floor(qty), price, time });
  }
  return out;
}

function fifoMatchUpstox(rows: UpstoxRow[]): ParsedTrade[] {
  const bySymbol = new Map<string, UpstoxRow[]>();
  for (const r of rows) {
    if (!bySymbol.has(r.symbol)) bySymbol.set(r.symbol, []);
    bySymbol.get(r.symbol)!.push(r);
  }
  const trades: ParsedTrade[] = [];
  for (const [, symbolRows] of bySymbol) {
    symbolRows.sort((a, b) => a.time - b.time);
    const buys: { date: string; qty: number; price: number }[] = [];
    const sells: { date: string; qty: number; price: number }[] = [];
    for (const r of symbolRows) {
      if (r.type === 'buy') buys.push({ date: r.date, qty: r.quantity, price: r.price });
      else sells.push({ date: r.date, qty: r.quantity, price: r.price });
    }
    let i = 0;
    let j = 0;
    let buyRemain = 0;
    let buySum = 0;
    let buyDate = '';
    let sellRemain = 0;
    let sellSum = 0;
    let sellDate = '';

    while (i < buys.length || j < sells.length || buyRemain > 0 || sellRemain > 0) {
      if (buyRemain <= 0 && i < buys.length) {
        buyRemain = buys[i].qty;
        buySum = buys[i].price * buyRemain;
        buyDate = buys[i].date;
        i++;
      }
      if (sellRemain <= 0 && j < sells.length) {
        sellRemain = sells[j].qty;
        sellSum = sells[j].price * sellRemain;
        sellDate = sells[j].date;
        j++;
      }
      if (buyRemain <= 0 || sellRemain <= 0) break;
      const matchQty = Math.min(buyRemain, sellRemain);
      const entryPrice = buySum / buyRemain;
      const exitPrice = sellSum / sellRemain;
      const entryD = parseDate(buyDate, 'upstox');
      const exitD = parseDate(sellDate, 'upstox');
      if (!entryD || !exitD) {
        buyRemain -= matchQty;
        sellRemain -= matchQty;
        continue;
      }
      const direction: 'long' | 'short' = entryD.getTime() <= exitD.getTime() ? 'long' : 'short';
      trades.push({
        symbol: symbolRows[0].symbol,
        direction,
        entryPrice,
        exitPrice,
        quantity: matchQty,
        entryDate: entryD,
        exitDate: exitD,
        stopLoss: entryPrice,
        target: entryPrice,
        setupType: null,
        notes: 'Imported from Upstox',
      });
      buySum -= entryPrice * matchQty;
      buyRemain -= matchQty;
      sellSum -= exitPrice * matchQty;
      sellRemain -= matchQty;
    }
  }
  return trades;
}

export function parseUpstox(csvRaw: string): { trades: ParsedTrade[]; errors: string[] } {
  const errors: string[] = [];
  const { headers, rows } = parseCsvRows(csvRaw);
  if (headers.length === 0) {
    errors.push('CSV has no header row');
    return { trades: [], errors };
  }
  const upstoxRows = parseUpstoxRows(headers, rows);
  const trades = fifoMatchUpstox(upstoxRows);
  return { trades, errors };
}

export function parseGeneric(csvRaw: string): { trades: ParsedTrade[]; errors: string[] } {
  const errors: string[] = [];
  const { headers, rows } = parseCsvRows(csvRaw);
  if (headers.length === 0) {
    errors.push('CSV has no header row');
    return { trades: [], errors };
  }
  const trades: ParsedTrade[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const symbol = getColumn(row, headers, 'symbol').toUpperCase().trim();
    const direction = (getColumn(row, headers, 'direction') || 'long').toLowerCase();
    const entryPrice = parseNum(getColumn(row, headers, 'entry_price'));
    const exitPrice = parseNum(getColumn(row, headers, 'exit_price'));
    const quantity = parseNum(getColumn(row, headers, 'quantity'));
    const entryDate = parseDate(getColumn(row, headers, 'entry_date'));
    const exitDate = parseDate(getColumn(row, headers, 'exit_date'));
    if (!symbol || entryPrice == null || exitPrice == null || quantity == null || quantity <= 0 || !entryDate || !exitDate) {
      errors.push(`Row ${i + 2}: missing or invalid required fields`);
      continue;
    }
    trades.push({
      symbol,
      direction: direction === 'short' ? 'short' : 'long',
      entryPrice,
      exitPrice,
      quantity: Math.floor(quantity),
      entryDate,
      exitDate,
      stopLoss: entryPrice,
      target: entryPrice,
      setupType: (getColumn(row, headers, 'setup_type') || '').trim() || null,
      notes: getColumn(row, headers, 'notes') || '',
    });
  }
  return { trades, errors };
}

export function parseCsvByBroker(
  csvRaw: string,
  broker: BrokerType
): { trades: ParsedTrade[]; errors: string[] } {
  if (broker === 'zerodha') return parseZerodha(csvRaw);
  if (broker === 'upstox') return parseUpstox(csvRaw);
  if (broker === 'generic') return parseGeneric(csvRaw);
  return { trades: [], errors: ['Unknown broker format'] };
}
