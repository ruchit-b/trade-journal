-- AlterTable
ALTER TABLE "trades" ADD COLUMN "pnl" DECIMAL(18,4),
ADD COLUMN "riskReward" DECIMAL(18,4),
ADD COLUMN "outcome" TEXT;
