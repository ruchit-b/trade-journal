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
  equityCurveDaily: { period: string; cumulative: number }[];
  equityCurveWeekly: { period: string; cumulative: number }[];
  equityCurveMonthly: { period: string; cumulative: number }[];
  equityCurveYearly: { period: string; cumulative: number }[];
  pnlByMonth: { month: string; pnl: number; count: number }[];
  pnlBySetup: { setupType: string; winRate: number; avgPnl: number; count: number; totalPnl: number; bestTrade: number }[];
  pnlBySector: { sector: string; pnl: number; count: number; winRate: number; avgPnl: number }[];
  winRateByMarketPulse: { marketPulse: string; wins: number; total: number; winRate: number }[];
}
