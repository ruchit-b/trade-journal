-- AlterTable
ALTER TABLE "users" ADD COLUMN "portfolioAmount" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "trades" ADD COLUMN "marketPulse" TEXT,
ADD COLUMN "executionErrors" TEXT[] DEFAULT ARRAY[]::TEXT[];
