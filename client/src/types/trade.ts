/** Matches API response shape; dates are ISO strings. */
export type TradeDirection = 'long' | 'short';
export type TradeOutcome = 'open' | 'win' | 'loss' | 'breakeven';

export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  entryDate: string;
  exitDate: string | null;
  stopLoss: number;
  target: number;
  setupType: string | null;
  notes: string;
  screenshotUrl: string | null;
  pnl: number | null;
  riskReward: number | null;
  outcome: TradeOutcome | null;
  marketPulse: string | null;
  executionErrors: string[];
  exitReason: string | null;
  executionGrade: string | null;
  createdAt: string;
}

export interface TradesResponse {
  trades: Trade[];
  total: number;
  page: number;
  totalPages: number;
}
