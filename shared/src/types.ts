export type UserPlan = 'free' | 'pro';

export interface User {
  id: string;
  email: string;
  name: string;
  plan: UserPlan;
  portfolioAmount: number | null;
  createdAt: Date;
}

export type TradeDirection = 'long' | 'short';
export type TradeOutcome = 'win' | 'loss' | 'breakeven' | 'open';

/** In-memory trade with Date fields (e.g. after parsing API response). */
export interface Trade {
  id: string;
  userId: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  entryDate: Date;
  exitDate: Date | null;
  stopLoss: number;
  target: number;
  setupType: string | null;
  notes: string;
  pnl: number | null;
  riskReward: number | null;
  outcome: TradeOutcome | null;
  marketPulse: string | null;
  executionErrors: string[];
  exitReason: string | null;
  executionGrade: string | null;
  createdAt: Date;
}

/** API response shape: dates as ISO strings. Use for client state and API payloads. */
export interface TradeApi {
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
  pnl: number | null;
  riskReward: number | null;
  outcome: TradeOutcome | null;
  marketPulse: string | null;
  executionErrors: string[];
  exitReason: string | null;
  executionGrade: string | null;
  createdAt: string;
}

export interface DashboardStats {
  totalTrades: number;
  openTrades: number;
  winRate: number;
  totalPnl: number;
  avgRiskReward: number;
  bestTrade: number;
  worstTrade: number;
  currentStreak: number;
  longestWinStreak: number;
  portfolioAmount: number | null;
  totalOpenRisk: number;
  expectancy: number;
  maxDrawdown: number;
  avgHoldingTimeHours: number;
  avgHoldingTimeDays: number;
}
