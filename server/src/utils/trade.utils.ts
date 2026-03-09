export type TradeDirection = 'long' | 'short';
export type TradeOutcome = 'open' | 'win' | 'loss' | 'breakeven';

interface TradeComputationInput {
  entryPrice: number | { toString(): string };
  exitPrice: number | { toString(): string } | null;
  quantity: number;
  direction: TradeDirection;
  stopLoss: number | { toString(): string };
  target: number | { toString(): string };
}

function toNum(v: number | { toString(): string }): number {
  return typeof v === 'number' ? v : Number(v.toString());
}

/**
 * PnL = (exitPrice - entryPrice) * quantity * (direction === 'long' ? 1 : -1)
 * Returns null if exitPrice is null (open trade).
 */
export function computePnl(input: TradeComputationInput): number | null {
  const exitPrice = input.exitPrice == null ? null : toNum(input.exitPrice);
  if (exitPrice === null) return null;
  const entryPrice = toNum(input.entryPrice);
  const qty = input.quantity;
  const mult = input.direction === 'long' ? 1 : -1;
  return (exitPrice - entryPrice) * qty * mult;
}

/**
 * Reward:Risk = reward / risk, where reward is only the profitable part (max(0, ...)).
 * Long: reward = max(0, exit - entry). Short: reward = max(0, entry - exit).
 * Returns null when trade is open or denominator is zero.
 */
export function computeRiskReward(input: TradeComputationInput): number | null {
  const exitPrice = input.exitPrice == null ? null : toNum(input.exitPrice);
  if (exitPrice === null) return null;
  const entry = toNum(input.entryPrice);
  const sl = toNum(input.stopLoss);
  const risk = Math.abs(entry - sl);
  if (risk < 1e-10) return null;
  const reward =
    input.direction === 'long'
      ? Math.max(0, exitPrice - entry)
      : Math.max(0, entry - exitPrice);
  return reward / risk;
}

/**
 * outcome: if no exitPrice → 'open'. if pnl > 0 → 'win'. if pnl < 0 → 'loss'. if pnl === 0 → 'breakeven'
 */
export function computeOutcome(
  exitPrice: number | { toString(): string } | null,
  pnl: number | null
): TradeOutcome {
  if (exitPrice == null || pnl === null) return 'open';
  if (pnl > 0) return 'win';
  if (pnl < 0) return 'loss';
  return 'breakeven';
}

/**
 * Compute pnl, riskReward, outcome for a trade. Use when creating or updating.
 */
export function computeTradeFields(input: TradeComputationInput): {
  pnl: number | null;
  riskReward: number | null;
  outcome: TradeOutcome;
} {
  const pnl = computePnl(input);
  const riskReward = computeRiskReward(input);
  const outcome = computeOutcome(input.exitPrice, pnl);
  return { pnl, riskReward, outcome };
}
