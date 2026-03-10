import { Request, Response } from 'express';
import { body, query, param, ValidationChain } from 'express-validator';
import { PrismaClient, Prisma } from '@prisma/client';
import { computeTradeFields } from '../utils/trade.utils';
import { deleteFile } from '../utils/storage';

const prisma = new PrismaClient();

const DIRECTION_VALUES = ['long', 'short'] as const;
const OUTCOME_VALUES = ['open', 'win', 'loss', 'breakeven'] as const;
const SORT_BY_VALUES = ['symbol', 'entryDate', 'exitDate', 'pnl', 'riskReward'] as const;
const SORT_ORDER_VALUES = ['asc', 'desc'] as const;
const MARKET_PULSE_VALUES = ['Trending', 'Volatile/Chippy', 'Sideways', 'Correction'] as const;
const EXECUTION_ERROR_VALUES = [
  'Chased Entry',
  'Early Exit (Fear)',
  'Late Exit',
  'Wide SL',
  'Ignored VCP criteria',
  'Over-leveraged',
] as const;
const EXIT_REASON_VALUES = [
  'Hit SL',
  'Hit Target',
  'Time Stop',
  'Market Weakness',
  'Emotional Exit',
] as const;
const EXECUTION_GRADE_VALUES = [
  'Followed plan',
  'Slight deviation',
  'Luck/Random',
  'Broke rules',
] as const;

function normalizeExecutionErrors(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === 'string' && EXECUTION_ERROR_VALUES.includes(x as typeof EXECUTION_ERROR_VALUES[number]))
    .filter((x, i, a) => a.indexOf(x) === i);
}

function safeDecimal(value: number | null): Prisma.Decimal | null {
  if (value === null) return null;
  return new Prisma.Decimal(value);
}

/** Reward:Risk from actual prices (exit-based). Reward = max(0, profitable move). Returns null if open or risk is zero. */
function rewardRiskFromPrices(
  entry: number,
  exit: number | null,
  stopLoss: number,
  direction: string
): number | null {
  if (exit == null) return null;
  const risk = Math.abs(entry - stopLoss);
  if (risk < 1e-10) return null;
  const reward =
    direction === 'long' ? Math.max(0, exit - entry) : Math.max(0, entry - exit);
  return reward / risk;
}

function getUserId(req: Request): string {
  if (!req.user?.id) throw new Error('Unauthorized');
  return req.user.id;
}

function handleError(res: Response, err: unknown, fallbackMessage: string): void {
  console.error(err);
  res.status(500).json({
    success: false,
    error: fallbackMessage,
  });
}

// ---- createTrade ----
// Defaults when omitted: direction=long, target=0, setupType=null, notes='', executionErrors=[]

export const createTradeValidations: ValidationChain[] = [
  body('symbol').trim().isLength({ min: 1, max: 20 }).withMessage('Symbol must be 1–20 characters'),
  body('direction').optional().isIn(DIRECTION_VALUES).withMessage('Direction must be long or short'),
  body('entryPrice').toFloat().isFloat({ min: 0.0001 }).withMessage('Entry price must be a positive number'),
  body('quantity').toInt().isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
  body('entryDate').isISO8601().withMessage('Entry date must be a valid ISO date'),
  body('stopLoss').toFloat().isFloat({ min: 0 }).withMessage('Stop loss must be a positive number'),
  body('target').optional().toFloat().isFloat({ min: 0 }).withMessage('Target must be 0 or positive (omit = 0)'),
  body('exitPrice').optional().toFloat().isFloat({ min: 0 }).withMessage('Exit price must be a positive number'),
  body('exitDate').optional().isISO8601().withMessage('Exit date must be a valid ISO date'),
  body('setupType').optional().trim().isLength({ max: 100 }).withMessage('Setup type too long'),
  body('notes').optional().trim().isLength({ max: 5000 }).withMessage('Notes too long'),
  body('screenshotUrl').optional().trim().isLength({ max: 2000 }).withMessage('Screenshot URL too long'),
  body('marketPulse')
    .optional()
    .custom((v) => v == null || v === '' || MARKET_PULSE_VALUES.includes(v as (typeof MARKET_PULSE_VALUES)[number]))
    .withMessage('Market pulse must be one of: Trending, Volatile/Chippy, Sideways, Correction'),
  body('executionErrors').optional().isArray().withMessage('Execution errors must be an array'),
  body('executionErrors.*').optional().isIn(EXECUTION_ERROR_VALUES).withMessage('Invalid execution error tag'),
  body('exitReason')
    .optional()
    .custom((v) => v == null || v === '' || EXIT_REASON_VALUES.includes(v as (typeof EXIT_REASON_VALUES)[number]))
    .withMessage('Invalid exit reason'),
  body('executionGrade')
    .optional()
    .custom((v) => v == null || v === '' || EXECUTION_GRADE_VALUES.includes(v as (typeof EXECUTION_GRADE_VALUES)[number]))
    .withMessage('Invalid execution grade'),
];

export async function createTrade(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const b = req.body as Record<string, unknown>;
    const symbol = String(b.symbol ?? '').trim().toUpperCase();
    const direction = (b.direction === 'short' ? 'short' : 'long') as 'long' | 'short';
    const entryPrice = Number(b.entryPrice);
    const quantity = Number(b.quantity);
    const entryDate = new Date(b.entryDate as string);
    const stopLoss = Number(b.stopLoss);
    const target =
      b.target != null && b.target !== '' && !Number.isNaN(Number(b.target))
        ? Number(b.target)
        : 0;
    const exitPrice = b.exitPrice != null && b.exitPrice !== '' ? Number(b.exitPrice) : null;
    let exitDate = b.exitDate != null && b.exitDate !== '' ? new Date(b.exitDate as string) : null;
    // When closing a trade (exitPrice set), default exitDate to entryDate so analytics have a date
    if (exitPrice != null && exitDate == null) exitDate = entryDate;
    const setupType = (b.setupType != null && String(b.setupType).trim()) ? String(b.setupType).trim() : null;
    const notes = (b.notes != null) ? String(b.notes).trim() : '';
    const screenshotUrl = (b.screenshotUrl != null && String(b.screenshotUrl).trim()) ? String(b.screenshotUrl).trim() : null;
    const marketPulse = b.marketPulse != null && String(b.marketPulse).trim() && MARKET_PULSE_VALUES.includes(b.marketPulse as typeof MARKET_PULSE_VALUES[number])
      ? (b.marketPulse as string)
      : null;
    const executionErrors = normalizeExecutionErrors(b.executionErrors);
    const exitReason = b.exitReason != null && String(b.exitReason).trim() && EXIT_REASON_VALUES.includes(b.exitReason as typeof EXIT_REASON_VALUES[number])
      ? (b.exitReason as string)
      : null;
    const executionGrade = b.executionGrade != null && String(b.executionGrade).trim() && EXECUTION_GRADE_VALUES.includes(b.executionGrade as typeof EXECUTION_GRADE_VALUES[number])
      ? (b.executionGrade as string)
      : null;

    const { pnl, riskReward, outcome } = computeTradeFields({
      entryPrice,
      exitPrice,
      quantity,
      direction,
      stopLoss,
      target,
    });

    const trade = await prisma.trade.create({
      data: {
        userId,
        symbol,
        direction,
        entryPrice: new Prisma.Decimal(entryPrice),
        exitPrice: exitPrice != null ? new Prisma.Decimal(exitPrice) : null,
        quantity,
        entryDate,
        exitDate,
        stopLoss: new Prisma.Decimal(stopLoss),
        target: new Prisma.Decimal(target),
        setupType,
        notes,
        screenshotUrl,
        marketPulse,
        executionErrors,
        exitReason,
        executionGrade,
        pnl: safeDecimal(pnl),
        riskReward: safeDecimal(riskReward),
        outcome,
      },
    });

    res.status(201).json({
      success: true,
      data: serializeTrade(trade),
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    handleError(res, err, 'Failed to create trade.');
  }
}

// ---- getTrades ----

export const getTradesValidations: ValidationChain[] = [
  query('page').optional().toInt().isInt({ min: 1 }).withMessage('Page must be at least 1'),
  query('limit').optional().toInt().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('symbol').optional().trim().isLength({ max: 20 }),
  query('outcome').optional().isIn(OUTCOME_VALUES),
  query('setupType').optional().trim(),
  query('direction').optional().isIn(DIRECTION_VALUES),
  query('dateFrom').optional().isISO8601(),
  query('dateTo').optional().isISO8601(),
  query('sortBy').optional().isIn(SORT_BY_VALUES),
  query('sortOrder').optional().isIn(SORT_ORDER_VALUES),
];

export async function getTrades(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const sortBy = (req.query.sortBy as string) || 'entryDate';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    const where: Prisma.TradeWhereInput = { userId };

    if (req.query.symbol && String(req.query.symbol).trim()) {
      where.symbol = String(req.query.symbol).trim().toUpperCase();
    }
    if (req.query.outcome && OUTCOME_VALUES.includes(req.query.outcome as typeof OUTCOME_VALUES[number])) {
      where.outcome = req.query.outcome as string;
    }
    if (req.query.setupType && String(req.query.setupType).trim()) {
      where.setupType = String(req.query.setupType).trim();
    }
    if (req.query.direction && DIRECTION_VALUES.includes(req.query.direction as typeof DIRECTION_VALUES[number])) {
      where.direction = req.query.direction as string;
    }
    if (req.query.dateFrom || req.query.dateTo) {
      const entryDate: Prisma.DateTimeFilter = {};
      if (req.query.dateFrom) entryDate.gte = new Date(req.query.dateFrom as string);
      if (req.query.dateTo) entryDate.lte = new Date(req.query.dateTo as string);
      where.entryDate = entryDate;
    }

    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.trade.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    res.json({
      success: true,
      data: {
        trades: trades.map(serializeTrade),
        total,
        page,
        totalPages,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    handleError(res, err, 'Failed to fetch trades.');
  }
}

// ---- getTradeById ----

export const getTradeByIdValidations: ValidationChain[] = [
  param('id').isString().notEmpty().withMessage('Trade ID is required'),
];

export async function getTradeById(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    const trade = await prisma.trade.findFirst({
      where: { id, userId },
    });

    if (!trade) {
      res.status(404).json({
        success: false,
        error: 'Trade not found.',
      });
      return;
    }

    res.json({
      success: true,
      data: serializeTrade(trade),
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    handleError(res, err, 'Failed to fetch trade.');
  }
}

// ---- updateTrade ----

export const updateTradeValidations: ValidationChain[] = [
  param('id').isString().notEmpty(),
  body('symbol').optional().trim().isLength({ min: 1, max: 20 }),
  body('direction').optional().isIn(DIRECTION_VALUES),
  body('entryPrice').optional().toFloat().isFloat({ min: 0.0001 }),
  body('exitPrice').optional().custom((v) => {
    if (v == null || v === '') return true;
    const n = typeof v === 'number' ? v : Number(v);
    return !Number.isNaN(n) && n >= 0;
  }).withMessage('Exit price must be a positive number or null'),
  body('quantity').optional().toInt().isInt({ min: 1 }),
  body('entryDate').optional().isISO8601(),
  body('exitDate').optional().custom((v) => v == null || v === '' || (typeof v === 'string' && !isNaN(Date.parse(v))) || (typeof v === 'number' && !Number.isNaN(v))).withMessage('Exit date must be ISO date or null'),
  body('stopLoss').optional().toFloat().isFloat({ min: 0 }),
  body('target').optional().toFloat().isFloat({ min: 0 }),
  body('setupType').optional().trim(),
  body('notes').optional().trim(),
  body('screenshotUrl').optional().trim(),
  body('marketPulse')
    .optional()
    .custom((v) => v == null || v === '' || MARKET_PULSE_VALUES.includes(v as (typeof MARKET_PULSE_VALUES)[number])),
  body('executionErrors').optional().isArray(),
  body('executionErrors.*').optional().isIn(EXECUTION_ERROR_VALUES),
  body('exitReason')
    .optional()
    .custom((v) => v == null || v === '' || EXIT_REASON_VALUES.includes(v as (typeof EXIT_REASON_VALUES)[number])),
  body('executionGrade')
    .optional()
    .custom((v) => v == null || v === '' || EXECUTION_GRADE_VALUES.includes(v as (typeof EXECUTION_GRADE_VALUES)[number])),
];

export async function updateTrade(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;
    const b = req.body as Record<string, unknown>;

    const existing = await prisma.trade.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Trade not found.',
      });
      return;
    }

    const entryPrice = b.entryPrice != null ? Number(b.entryPrice) : Number(existing.entryPrice);
    const exitPrice = b.exitPrice !== undefined
      ? (b.exitPrice === null || b.exitPrice === '' ? null : Number(b.exitPrice))
      : (existing.exitPrice != null ? Number(existing.exitPrice) : null);
    const quantity = b.quantity != null ? Number(b.quantity) : existing.quantity;
    const direction = (b.direction as 'long' | 'short') ?? existing.direction;
    const stopLoss = b.stopLoss != null ? Number(b.stopLoss) : Number(existing.stopLoss);
    const target = b.target != null ? Number(b.target) : Number(existing.target);

    const { pnl, riskReward, outcome } = computeTradeFields({
      entryPrice,
      exitPrice,
      quantity,
      direction,
      stopLoss,
      target,
    });

    const updateData: Prisma.TradeUpdateInput = {
      ...(b.symbol !== undefined && { symbol: String(b.symbol).trim().toUpperCase() }),
      ...(b.direction !== undefined && b.direction != null && { direction: b.direction }),
      ...(b.entryPrice !== undefined && { entryPrice: new Prisma.Decimal(entryPrice) }),
      exitPrice: exitPrice !== null ? new Prisma.Decimal(exitPrice) : null,
      ...(b.quantity !== undefined && { quantity }),
      ...(b.entryDate !== undefined && { entryDate: new Date(b.entryDate as string) }),
      exitDate: b.exitDate !== undefined ? (b.exitDate == null || b.exitDate === '' ? null : new Date(b.exitDate as string)) : undefined,
      ...(b.stopLoss !== undefined && { stopLoss: new Prisma.Decimal(stopLoss) }),
      ...(b.target !== undefined && { target: new Prisma.Decimal(target) }),
      ...(b.setupType !== undefined && {
        setupType: String(b.setupType ?? '').trim() ? String(b.setupType).trim() : null,
      }),
      ...(b.notes !== undefined && { notes: String(b.notes).trim() }),
      ...(b.screenshotUrl !== undefined && { screenshotUrl: b.screenshotUrl ? String(b.screenshotUrl).trim() : null }),
      ...(b.marketPulse !== undefined && {
        marketPulse: b.marketPulse != null && String(b.marketPulse).trim() && MARKET_PULSE_VALUES.includes(b.marketPulse as typeof MARKET_PULSE_VALUES[number])
          ? String(b.marketPulse).trim()
          : null,
      }),
      ...(b.executionErrors !== undefined && { executionErrors: normalizeExecutionErrors(b.executionErrors) }),
      ...(b.exitReason !== undefined && {
        exitReason: b.exitReason != null && String(b.exitReason).trim() && EXIT_REASON_VALUES.includes(b.exitReason as typeof EXIT_REASON_VALUES[number])
          ? String(b.exitReason).trim()
          : null,
      }),
      ...(b.executionGrade !== undefined && {
        executionGrade: b.executionGrade != null && String(b.executionGrade).trim() && EXECUTION_GRADE_VALUES.includes(b.executionGrade as typeof EXECUTION_GRADE_VALUES[number])
          ? String(b.executionGrade).trim()
          : null,
      }),
      pnl: safeDecimal(pnl),
      riskReward: safeDecimal(riskReward),
      outcome,
    };

    const trade = await prisma.trade.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: serializeTrade(trade),
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Trade not found.' });
      return;
    }
    handleError(res, err, 'Failed to update trade.');
  }
}

// ---- deleteTrade ----

export const deleteTradeValidations: ValidationChain[] = [
  param('id').isString().notEmpty().withMessage('Trade ID is required'),
];

export async function deleteTrade(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const id = req.params.id as string;

    const existing = await prisma.trade.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'Trade not found.',
      });
      return;
    }

    if (existing.screenshotUrl) {
      try {
        await deleteFile(existing.screenshotUrl);
      } catch (e) {
        console.warn('Failed to delete trade screenshot file:', e);
      }
    }

    await prisma.trade.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      data: { message: 'Trade deleted successfully.' },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    handleError(res, err, 'Failed to delete trade.');
  }
}

// ---- getDashboardStats ----

function riskPerTradeInr(
  entryPrice: number | Prisma.Decimal,
  stopLoss: number | Prisma.Decimal,
  quantity: number
): number {
  const entry = typeof entryPrice === 'number' ? entryPrice : Number(entryPrice);
  const sl = typeof stopLoss === 'number' ? stopLoss : Number(stopLoss);
  return Math.abs(entry - sl) * quantity;
}

export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);

    const [user, trades] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { portfolioAmount: true },
      }),
      prisma.trade.findMany({
        where: { userId },
        orderBy: { exitDate: 'desc' },
      }),
    ]);

    const portfolioAmount = user?.portfolioAmount != null ? Number(user.portfolioAmount) : null;

    const closed = trades.filter((t) => t.outcome !== 'open' && t.outcome != null);
    const openTrades = trades.filter((t) => t.outcome === 'open' || t.outcome == null);
    const totalOpenRisk = openTrades.reduce(
      (sum, t) => sum + riskPerTradeInr(t.entryPrice, t.stopLoss, t.quantity),
      0
    );
    const withPnl = closed.filter((t) => t.pnl != null);
    const wins = closed.filter((t) => t.outcome === 'win');
    const losses = closed.filter((t) => t.outcome === 'loss');
    const totalPnl = withPnl.reduce((sum, t) => sum + Number(t.pnl), 0);
    const riskRewards = closed
      .map((t) =>
        rewardRiskFromPrices(
          Number(t.entryPrice),
          t.exitPrice != null ? Number(t.exitPrice) : null,
          Number(t.stopLoss),
          t.direction
        )
      )
      .filter((r): r is number => r != null);
    const avgRiskReward = riskRewards.length > 0
      ? riskRewards.reduce((a, b) => a + b, 0) / riskRewards.length
      : 0;

    const winRate =
      wins.length + losses.length > 0
        ? (wins.length / (wins.length + losses.length)) * 100
        : 0;

    const pnlValues = withPnl.map((t) => Number(t.pnl));
    const bestTrade = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
    const worstTrade = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;

    let currentStreak = 0;
    for (const t of trades) {
      if (t.outcome === 'open' || t.outcome == null) continue;
      if (currentStreak === 0) {
        currentStreak = t.outcome === 'win' ? 1 : t.outcome === 'loss' ? -1 : 0;
      } else if (t.outcome === 'win' && currentStreak > 0) currentStreak++;
      else if (t.outcome === 'loss' && currentStreak < 0) currentStreak--;
      else break;
    }

    let longestWinStreak = 0;
    let run = 0;
    for (const t of [...trades].reverse()) {
      if (t.outcome === 'win') {
        run++;
        longestWinStreak = Math.max(longestWinStreak, run);
      } else {
        run = 0;
      }
    }

    // Expectancy: (Win% * Avg Win) - (Loss% * Avg Loss)
    const winLossTotal = wins.length + losses.length;
    const sumWinPnl = wins.reduce((s, t) => s + (t.pnl != null ? Number(t.pnl) : 0), 0);
    const sumLossPnl = losses.reduce((s, t) => s + (t.pnl != null ? Number(t.pnl) : 0), 0);
    const avgWin = wins.length > 0 ? sumWinPnl / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(sumLossPnl / losses.length) : 0;
    const winPct = winLossTotal > 0 ? wins.length / winLossTotal : 0;
    const lossPct = winLossTotal > 0 ? losses.length / winLossTotal : 0;
    const expectancy = winLossTotal > 0 ? winPct * avgWin - lossPct * avgLoss : 0;

    // Max drawdown: closed trades by exitDate asc, cumulative P&L, then largest peak-to-trough
    const closedByExit = [...closed].filter((t) => t.exitDate != null && t.pnl != null);
    closedByExit.sort((a, b) => (a.exitDate!.getTime()) - (b.exitDate!.getTime()));
    let running = 0;
    let peak = 0;
    let maxDrawdown = 0;
    for (const t of closedByExit) {
      running += Number(t.pnl);
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    // Average holding time (closed trades with exitDate)
    const holdingTimesMs = closed
      .filter((t) => t.exitDate != null)
      .map((t) => new Date(t.exitDate!).getTime() - new Date(t.entryDate).getTime());
    const avgHoldingTimeMs = holdingTimesMs.length > 0
      ? holdingTimesMs.reduce((a, b) => a + b, 0) / holdingTimesMs.length
      : 0;
    const avgHoldingTimeHours = avgHoldingTimeMs / (1000 * 60 * 60);
    const avgHoldingTimeDays = avgHoldingTimeHours / 24;

    res.json({
      success: true,
      data: {
        totalTrades: closed.length,
        openTrades: openTrades.length,
        winRate,
        totalPnl,
        avgRiskReward,
        bestTrade,
        worstTrade,
        currentStreak,
        longestWinStreak,
        portfolioAmount,
        totalOpenRisk,
        expectancy,
        maxDrawdown,
        avgHoldingTimeHours,
        avgHoldingTimeDays,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      res.status(401).json({ success: false, error: 'Not authenticated.' });
      return;
    }
    handleError(res, err, 'Failed to fetch dashboard stats.');
  }
}

// ---- serialization ----

function serializeTrade(t: {
  id: string;
  userId: string;
  symbol: string;
  direction: string;
  entryPrice: Prisma.Decimal;
  exitPrice: Prisma.Decimal | null;
  quantity: number;
  entryDate: Date;
  exitDate: Date | null;
  stopLoss: Prisma.Decimal;
  target: Prisma.Decimal;
  setupType: string;
  notes: string;
  screenshotUrl: string | null;
  pnl: Prisma.Decimal | null;
  riskReward: Prisma.Decimal | null;
  outcome: string | null;
  marketPulse: string | null;
  executionErrors: string[];
  exitReason: string | null;
  executionGrade: string | null;
  createdAt: Date;
}) {
  return {
    id: t.id,
    userId: t.userId,
    symbol: t.symbol,
    direction: t.direction,
    entryPrice: Number(t.entryPrice),
    exitPrice: t.exitPrice != null ? Number(t.exitPrice) : null,
    quantity: t.quantity,
    entryDate: t.entryDate.toISOString(),
    exitDate: t.exitDate ? t.exitDate.toISOString() : null,
    stopLoss: Number(t.stopLoss),
    target: Number(t.target),
    setupType: t.setupType,
    notes: t.notes,
    screenshotUrl: t.screenshotUrl,
    pnl: t.pnl != null ? Number(t.pnl) : null,
    riskReward: t.riskReward != null
      ? Number(t.riskReward)
      : rewardRiskFromPrices(
          Number(t.entryPrice),
          t.exitPrice != null ? Number(t.exitPrice) : null,
          Number(t.stopLoss),
          t.direction
        ),
    outcome: t.outcome,
    marketPulse: t.marketPulse,
    executionErrors: t.executionErrors ?? [],
    exitReason: t.exitReason ?? null,
    executionGrade: t.executionGrade ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}
