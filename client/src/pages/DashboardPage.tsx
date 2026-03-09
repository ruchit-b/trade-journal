import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { get } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { formatCurrencyWhole, formatPercent } from '@/lib/format';
import { useCountUp } from '@/hooks/useCountUp';
import type { DashboardStats } from '@/types/dashboard';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

const STATS_URL = '/api/trades/stats';

type ApiStatsResponse = { success: boolean; data?: DashboardStats };

async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await get<ApiStatsResponse>(STATS_URL);
  if (!res?.success || !res.data) throw new Error('Failed to fetch stats');
  return res.data;
}

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-elevated ${className}`} />
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface px-5 py-4">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-2 h-8 w-32" />
    </div>
  );
}

/** Circular progress ring (SVG) for win rate */
function WinRateRing({ value, size = 44 }: { value: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} className="shrink-0" viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--bg-elevated)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

/** Candlestick illustration for empty state (SVG) */
function CandlestickIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 3 candles: 2 green, 1 red */}
      <g stroke="var(--profit)" strokeWidth="1.5" strokeLinecap="round">
        <line x1="25" y1="20" x2="25" y2="35" />
        <rect x="21" y="35" width="8" height="25" rx="1" fill="var(--profit)" />
        <line x1="25" y1="60" x2="25" y2="72" />
      </g>
      <g stroke="var(--profit)" strokeWidth="1.5" strokeLinecap="round">
        <line x1="60" y1="15" x2="60" y2="28" />
        <rect x="56" y="28" width="8" height="32" rx="1" fill="var(--profit)" />
        <line x1="60" y1="60" x2="60" y2="72" />
      </g>
      <g stroke="var(--loss)" strokeWidth="1.5" strokeLinecap="round">
        <line x1="95" y1="25" x2="95" y2="42" />
        <rect x="91" y="42" width="8" height="18" rx="1" fill="var(--loss)" />
        <line x1="95" y1="60" x2="95" y2="72" />
      </g>
    </svg>
  );
}

function EmptyDashboard() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardBody className="flex flex-col items-center text-center">
          <div className="mb-4 text-accent opacity-90">
            <CandlestickIllustration className="h-24 w-auto" />
          </div>
          <h2 className="text-lg font-semibold text-text-primary">No trades yet</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Start by adding your first trade to see your stats and equity curve here.
          </p>
          <Link to="/trades/new" className="mt-6 inline-block">
            <Button variant="primary" size="md">Add your first trade</Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}

function DashboardContent({ data }: { data: DashboardStats }) {
  const hasAnyTrades = data.totalTrades > 0 || data.openTrades > 0;
  const totalPnlDisplay = useCountUp(data.totalPnl, { enabled: hasAnyTrades, decimals: 0 });
  const winRateDisplay = useCountUp(data.winRate, { enabled: hasAnyTrades, duration: 1000, decimals: 1 });
  const totalTradesDisplay = useCountUp(data.totalTrades, { enabled: hasAnyTrades });
  const avgRRDisplay = useCountUp(data.avgRiskReward, { enabled: hasAnyTrades, decimals: 2 });

  const openRiskPct =
    data.portfolioAmount != null && data.portfolioAmount > 0 && data.totalOpenRisk > 0
      ? (data.totalOpenRisk / data.portfolioAmount) * 100
      : null;

  return (
    <div className="space-y-6">
      {/* Top row: 4 stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-text-secondary">Total P&L</p>
            <div className="mt-1 flex items-center gap-2">
              {data.totalPnl >= 0 ? (
                <TrendingUp className="h-5 w-5 shrink-0 text-profit" />
              ) : (
                <TrendingDown className="h-5 w-5 shrink-0 text-loss" />
              )}
              <span
                className={`font-mono text-2xl font-semibold tabular-nums ${
                  data.totalPnl >= 0 ? 'text-profit' : 'text-loss'
                }`}
              >
                {data.totalPnl >= 0 ? '' : '-'}
                {formatCurrencyWhole(Math.abs(totalPnlDisplay))}
              </span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-text-secondary">Win Rate</p>
                <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text-primary">
                  {formatPercent(winRateDisplay)}
                </p>
              </div>
              <WinRateRing value={data.winRate} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-sm font-medium text-text-secondary">Total Trades</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text-primary">
              {totalTradesDisplay}
            </p>
            {data.openTrades > 0 && (
              <p className="mt-0.5 text-xs text-text-muted">{data.openTrades} open</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <p className="text-sm font-medium text-text-secondary">Avg Reward:Risk</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text-primary">
              {data.totalTrades > 0 ? avgRRDisplay.toFixed(2) : '—'}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Second row: Open Risk, Expectancy, Max Drawdown, Avg Holding Time */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-text-secondary">Total open risk</p>
            <div className="mt-1 flex items-start gap-2">
              {data.openTrades > 0 && (
                <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" aria-hidden />
              )}
              <div>
                {openRiskPct != null ? (
                  <>
                    <p className="font-mono text-2xl font-semibold tabular-nums text-text-primary">
                      {openRiskPct.toFixed(2)}%
                    </p>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {formatCurrencyWhole(data.totalOpenRisk)}
                    </p>
                  </>
                ) : (
                  <p className="font-mono text-2xl font-semibold tabular-nums text-text-primary">
                    {formatCurrencyWhole(data.totalOpenRisk)}
                  </p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-text-secondary">Expectancy</p>
            <p
              className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${
                data.expectancy >= 0 ? 'text-profit' : 'text-loss'
              }`}
            >
              {data.totalTrades > 0 ? formatCurrencyWhole(data.expectancy) : '—'}
            </p>
            <p className="mt-0.5 text-xs text-text-muted">Per trade</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-text-secondary">Max drawdown</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-loss">
              {data.totalTrades > 0 ? formatCurrencyWhole(data.maxDrawdown) : '—'}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-text-secondary">Avg holding time</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-text-primary">
              {data.totalTrades > 0
                ? data.avgHoldingTimeDays >= 1
                  ? `${data.avgHoldingTimeDays.toFixed(1)} days`
                  : `${data.avgHoldingTimeHours.toFixed(1)} hrs`
                : '—'}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Removed: Equity curve, streak, win rate by market environment, P&L by setup, P&L by sector */}
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
  });

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl">
          {isLoading && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <StatCardSkeleton key={i} />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Skeleton className="h-80 lg:col-span-2" />
                <Skeleton className="h-80" />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Skeleton className="h-72" />
                <Skeleton className="h-72" />
              </div>
            </div>
          )}

          {error && (
            <ErrorCard
              title="Failed to load dashboard"
              message="We couldn't load your stats. Check your connection and try again."
              onRetry={() => refetch()}
            />
          )}

          {!isLoading && !error && data && data.totalTrades === 0 && data.openTrades === 0 && (
            <EmptyDashboard />
          )}

          {!isLoading && !error && data && (data.totalTrades > 0 || data.openTrades > 0) && (
            <DashboardContent data={data} />
          )}
        </div>
      </div>
    </>
  );
}
