import { Request, Response } from 'express';
import multer from 'multer';
import { PrismaClient, Prisma } from '@prisma/client';
import { detectBroker, parseCsvByBroker, parseCsvRows } from '../utils/csv.parsers';
import { computeTradeFields } from '../utils/trade.utils';

const prisma = new PrismaClient();
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function getUserId(req: Request): string {
  if (!req.user?.id) throw new Error('Unauthorized');
  return req.user.id;
}

const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/csv' ||
      file.originalname.toLowerCase().endsWith('.csv');
    if (ok) cb(null, true);
    else cb(new Error('Only CSV files are allowed'));
  },
});

export function previewImport(req: Request, res: Response): void {
  try {
    const userId = getUserId(req);
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file || !file.buffer) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded. Use multipart/form-data with field "file".',
      });
      return;
    }
    const csvRaw = file.buffer.toString('utf-8');
    const { headers, rows } = parseCsvRows(csvRaw);
    const totalRows = rows.length;

    const broker = detectBroker(headers);
    if (broker === 'unknown') {
      res.status(422).json({
        success: false,
        error:
          'Could not detect broker. Supported formats: Zerodha tradebook, Upstox tradebook, or generic CSV with columns: symbol, direction, entry_price, exit_price, quantity, entry_date, exit_date.',
      });
      return;
    }

    const { trades, errors } = parseCsvByBroker(csvRaw, broker);
    const skippedRows = Math.max(0, totalRows - trades.length);

    res.json({
      success: true,
      data: {
        broker,
        totalRows,
        parsedTrades: trades.map((t) => ({
          symbol: t.symbol,
          direction: t.direction,
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice,
          quantity: t.quantity,
          entryDate: t.entryDate.toISOString(),
          exitDate: t.exitDate.toISOString(),
          setupType: t.setupType,
          sector: t.sector,
          notes: t.notes,
        })),
        skippedRows,
        errors,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
      return;
    }
    if (err instanceof Error && err.message === 'Only CSV files are allowed') {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    console.error('previewImport error', err);
    res.status(500).json({
      success: false,
      error: 'Failed to parse CSV.',
    });
  }
}

export async function confirmImport(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file || !file.buffer) {
      res.status(400).json({
        success: false,
        error: 'No file uploaded. Use multipart/form-data with field "file".',
      });
      return;
    }
    const csvRaw = file.buffer.toString('utf-8');
    const { headers, rows } = parseCsvRows(csvRaw);
    const broker = detectBroker(headers);
    if (broker === 'unknown') {
      res.status(422).json({
        success: false,
        error: 'Could not detect broker. Please use a supported CSV format.',
      });
      return;
    }

    const { trades, errors } = parseCsvByBroker(csvRaw, broker);
    const skippedRows = Math.max(0, rows.length - trades.length);

    if (trades.length === 0) {
      res.status(422).json({
        success: false,
        error: 'No valid trades to import.',
        errors,
      });
      return;
    }

    const tradeData = trades.map((t) => {
      const { pnl, riskReward, outcome } = computeTradeFields({
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        quantity: t.quantity,
        direction: t.direction,
        stopLoss: t.stopLoss,
        target: t.target,
      });
      return {
        userId,
        symbol: t.symbol,
        direction: t.direction,
        entryPrice: new Prisma.Decimal(t.entryPrice),
        exitPrice: new Prisma.Decimal(t.exitPrice),
        quantity: t.quantity,
        entryDate: t.entryDate,
        exitDate: t.exitDate,
        stopLoss: new Prisma.Decimal(t.stopLoss),
        target: new Prisma.Decimal(t.target),
        setupType: t.setupType,
        sector: t.sector,
        notes: t.notes,
        pnl: pnl != null ? new Prisma.Decimal(pnl) : null,
        riskReward: riskReward != null ? new Prisma.Decimal(riskReward) : null,
        outcome,
      };
    });

    const result = await prisma.trade.createMany({ data: tradeData });

    const importLog = await prisma.importLog.create({
      data: {
        userId,
        broker,
        filename: file.originalname || 'import.csv',
        tradeCount: result.count,
      },
    });

    res.json({
      success: true,
      data: {
        imported: result.count,
        skipped: skippedRows,
        importId: importLog.id,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ success: false, error: 'File too large. Maximum size is 5MB.' });
      return;
    }
    if (err instanceof Error && err.message === 'Only CSV files are allowed') {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    console.error('confirmImport error', err);
    res.status(500).json({
      success: false,
      error: 'Failed to import trades.',
    });
  }
}

export async function getImports(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const logs = await prisma.importLog.findMany({
      where: { userId },
      orderBy: { importedAt: 'desc' },
      select: {
        id: true,
        broker: true,
        filename: true,
        tradeCount: true,
        importedAt: true,
      },
    });
    res.json({
      success: true,
      data: logs.map((l) => ({
        id: l.id,
        broker: l.broker,
        filename: l.filename,
        tradeCount: l.tradeCount,
        importedAt: l.importedAt.toISOString(),
      })),
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    console.error('getImports error', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch import history.',
    });
  }
}
