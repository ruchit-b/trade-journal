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
