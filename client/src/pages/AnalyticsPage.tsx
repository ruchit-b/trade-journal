import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { get } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { formatCurrencyWhole, formatDateShort } from '@/lib/format';
import type { DashboardStats } from '@/types/dashboard';
import type { Trade, TradesResponse } from '@/types/trade';
import { ChevronDown, ChevronUp, X, BarChart3 } from 'lucide-react';

const STATS_URL = '/api/trades/stats';
const TRADES_URL = '/api/trades';

type ApiStatsResponse = { success: boolean; data?: DashboardStats };
type ApiTradesResponse = { success: boolean; data?: TradesResponse };

async function fetchStats(): Promise<DashboardStats> {
  const res = await get<ApiStatsResponse>(STATS_URL);
  if (!res?.success || !res.data) throw new Error('Failed to fetch stats');
  return res.data;
}

async function fetchTradesBySetup(setupType: string, page: number): Promise<TradesResponse> {
  const res = await get<ApiTradesResponse>(TRADES_URL, {
    params: { setupType, page, limit: 20, sortBy: 'exitDate', sortOrder: 'desc' },
  });
  if (!res?.success || !res.data) throw new Error('Failed to fetch trades');
  return res.data;
}

async function fetchAllTradesForSetup(setupType: string): Promise<Trade[]> {
  const res = await get<ApiTradesResponse>(TRADES_URL, {
    params: { setupType, limit: 200, sortBy: 'exitDate', sortOrder: 'asc' },
  });
  if (!res?.success || !res.data) return [];
  return res.data.trades;
}

// --- Verdict ---
type Verdict = 'edge' | 'neutral' | 'cut' | 'insufficient';

function getVerdict(
  count: number,
  winRate: number,
  avgPnl: number
): Verdict {
  if (count < 5) return 'insufficient';
  if (winRate > 60 && avgPnl > 0) return 'edge';
  if (winRate >= 40 && winRate <= 60 && avgPnl > 0) return 'neutral';
  return 'cut';
}

const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; className: string }
> = {
  edge: { label: '✓ Edge', className: 'bg-profit/15 text-profit border-profit/30' },
  neutral: { label: '→ Neutral', className: 'bg-warning/15 text-warning border-warning/30' },
  cut: { label: '✗ Cut This', className: 'bg-loss/15 text-loss border-loss/30' },
  insufficient: { label: '? Insufficient data', className: 'bg-text-muted/15 text-text-muted border-border-subtle' },
};

// --- Sortable table ---
type SetupSortKey = 'setupType' | 'count' | 'winRate' | 'avgPnl' | 'totalPnl' | 'bestTrade' | 'verdict';
type SectorSortKey = 'sector' | 'count' | 'winRate' | 'avgPnl' | 'pnl' | 'verdict';

function WinRateBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="h-2 flex-1 rounded-full bg-elevated overflow-hidden">
        <div
          className="h-full rounded-full bg-profit transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-text-secondary w-10">{value.toFixed(0)}%</span>
    </div>
  );
}

function SortableHeader<Key extends string>({
  label,
  sortKey,
  currentSortKey,
  sortOrder,
  onSort,
}: {
  label: string;
  sortKey: Key;
  currentSortKey: Key;
  sortOrder: 'asc' | 'desc';
  onSort: (key: Key) => void;
}) {
  const active = currentSortKey === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-0.5 font-medium text-text-secondary hover:text-text-primary transition-colors text-left"
    >
      {label}
      {active ? (
        sortOrder === 'desc' ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronUp className="h-4 w-4 shrink-0" />
        )
      ) : null}
    </button>
  );
}

// --- Month label for tooltip (e.g. "Jan 25" -> "Jan 2025") ---
function monthToFullLabel(month: string): string {
  const parts = month.split(' ');
  if (parts.length !== 2) return month;
  const yr = parts[1];
  const year = yr.length === 2 ? `20${yr}` : yr;
  return `${parts[0]} ${year}`;
}

export function AnalyticsPage() {
  const [setupSortKey, setSetupSortKey] = useState<SetupSortKey>('totalPnl');
  const [setupSortOrder, setSetupSortOrder] = useState<'asc' | 'desc'>('desc');
  const [sectorSortKey, setSectorSortKey] = useState<SectorSortKey>('pnl');
  const [sectorSortOrder, setSectorSortOrder] = useState<'asc' | 'desc'>('desc');
  const [drillSetup, setDrillSetup] = useState<string | null>(null);
  const [drillPage, setDrillPage] = useState(1);

  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['trades', 'stats'],
    queryFn: fetchStats,
  });

  const setupTradesQuery = useQuery({
    queryKey: ['trades', 'bySetup', drillSetup, drillPage],
    queryFn: () => fetchTradesBySetup(drillSetup!, drillPage),
    enabled: !!drillSetup,
  });

  const allTradesForCurveQuery = useQuery({
    queryKey: ['trades', 'bySetup', 'all', drillSetup],
    queryFn: () => fetchAllTradesForSetup(drillSetup!),
    enabled: !!drillSetup,
  });

  const totalTrades = (stats?.totalTrades ?? 0) + (stats?.openTrades ?? 0);
  const showEmptyState = totalTrades < 5;

  const setupRows = useMemo(() => {
    if (!stats?.pnlBySetup) return [];
    return [...stats.pnlBySetup].map((row) => ({
      ...row,
      verdict: getVerdict(row.count, row.winRate, row.avgPnl),
    }));
  }, [stats?.pnlBySetup]);

  const sortedSetupRows = useMemo(() => {
    const order = setupSortOrder === 'asc' ? 1 : -1;
    return [...setupRows].sort((a, b) => {
      let va: number | string = a.setupType;
      let vb: number | string = b.setupType;
      if (setupSortKey === 'count') { va = a.count; vb = b.count; }
      else if (setupSortKey === 'winRate') { va = a.winRate; vb = b.winRate; }
      else if (setupSortKey === 'avgPnl') { va = a.avgPnl; vb = b.avgPnl; }
      else if (setupSortKey === 'totalPnl') { va = a.totalPnl; vb = b.totalPnl; }
      else if (setupSortKey === 'bestTrade') { va = a.bestTrade; vb = b.bestTrade; }
      else if (setupSortKey === 'verdict') {
        const rank = (v: Verdict) => (v === 'edge' ? 4 : v === 'neutral' ? 3 : v === 'cut' ? 2 : 1);
        va = rank(a.verdict);
        vb = rank(b.verdict);
      }
      if (typeof va === 'number' && typeof vb === 'number') return order * (va - vb);
      return order * String(va).localeCompare(String(vb));
    });
  }, [setupRows, setupSortKey, setupSortOrder]);

  const sectorRows = useMemo(() => {
    if (!stats?.pnlBySector) return [];
    return [...stats.pnlBySector].map((row) => ({
      ...row,
      verdict: getVerdict(row.count, row.winRate, row.avgPnl),
    }));
  }, [stats?.pnlBySector]);

  const sortedSectorRows = useMemo(() => {
    const order = sectorSortOrder === 'asc' ? 1 : -1;
    return [...sectorRows].sort((a, b) => {
      let va: number | string = a.sector;
      let vb: number | string = b.sector;
      if (sectorSortKey === 'count') { va = a.count; vb = b.count; }
      else if (sectorSortKey === 'winRate') { va = a.winRate; vb = b.winRate; }
      else if (sectorSortKey === 'avgPnl') { va = a.avgPnl; vb = b.avgPnl; }
      else if (sectorSortKey === 'pnl') { va = a.pnl; vb = b.pnl; }
      else if (sectorSortKey === 'verdict') {
        const rank = (v: Verdict) => (v === 'edge' ? 4 : v === 'neutral' ? 3 : v === 'cut' ? 2 : 1);
        va = rank(a.verdict);
        vb = rank(b.verdict);
      }
      if (typeof va === 'number' && typeof vb === 'number') return order * (va - vb);
      return order * String(va).localeCompare(String(vb));
    });
  }, [sectorRows, sectorSortKey, sectorSortOrder]);

  const equityCurveData = useMemo(() => {
    const trades = allTradesForCurveQuery.data ?? [];
    const withPnl = trades.filter((t) => t.pnl != null && t.exitDate).sort(
      (a, b) => new Date(a.exitDate!).getTime() - new Date(b.exitDate!).getTime()
    );
    let cum = 0;
    return withPnl.map((t) => {
      cum += t.pnl!;
      return {
        date: formatDateShort(t.exitDate),
        cumulative: cum,
        pnl: t.pnl,
      };
    });
  }, [allTradesForCurveQuery.data]);

  const maxAbsPnlMonth = useMemo(() => {
    const months = stats?.pnlByMonth ?? [];
    if (months.length === 0) return 1;
    return Math.max(1, ...months.map((m) => Math.abs(m.pnl)));
  }, [stats?.pnlByMonth]);

  const handleSetupSort = useCallback((key: SetupSortKey) => {
    setSetupSortKey(key);
    setSetupSortOrder((o) => (setupSortKey === key && o === 'desc' ? 'asc' : 'desc'));
  }, [setupSortKey]);

  const handleSectorSort = useCallback((key: SectorSortKey) => {
    setSectorSortKey(key);
    setSectorSortOrder((o) => (sectorSortKey === key && o === 'desc' ? 'asc' : 'desc'));
  }, [sectorSortKey]);

  if (statsLoading) {
    return (
      <>
        <PageHeader title="Setup Analyzer" subtitle="Discover which setups actually make you money." />
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-lg border border-border bg-surface px-5 py-4">
                  <div className="animate-pulse rounded bg-elevated h-4 w-24" />
                  <div className="mt-2 animate-pulse rounded bg-elevated h-8 w-32" />
                </div>
              ))}
            </div>
            <div className="animate-pulse rounded-lg border border-border bg-surface h-96" />
            <div className="animate-pulse rounded-lg border border-border bg-surface h-72" />
          </div>
        </div>
      </>
    );
  }

  if (statsError) {
    return (
      <>
        <PageHeader title="Setup Analyzer" subtitle="Discover which setups actually make you money." />
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-md">
            <ErrorCard
              title="Failed to load analytics"
              message="We couldn't load your setup stats. Check your connection and try again."
              onRetry={() => refetchStats()}
            />
          </div>
        </div>
      </>
    );
  }

  if (showEmptyState) {
    return (
      <>
        <PageHeader title="Setup Analyzer" subtitle="Discover which setups actually make you money." />
        <div className="flex flex-1 items-center justify-center p-12">
          <Card className="w-full max-w-md">
            <CardBody className="flex flex-col items-center text-center py-12">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-elevated text-text-muted">
                <BarChart3 className="h-7 w-7" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary">Not enough data yet</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Add at least 5 trades to see meaningful setup analysis.
              </p>
              <Link to="/trades/new" className="mt-6">
                <Button variant="primary" size="md">Add Trade</Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Setup Analyzer"
        subtitle="Discover which setups actually make you money."
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl space-y-8">
          {/* Setup Performance Table */}
          <Card>
            <CardHeader title="Setup Performance" subtitle="Which setups actually make you money" />
            <CardBody className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2.5 text-left">
                        <SortableHeader
                          label="Setup Type"
                          sortKey="setupType"
                          currentSortKey={setupSortKey}
                          sortOrder={setupSortOrder}
                          onSort={handleSetupSort}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left">
                        <SortableHeader
                          label="Trades"
                          sortKey="count"
                          currentSortKey={setupSortKey}
                          sortOrder={setupSortOrder}
                          onSort={handleSetupSort}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left min-w-[120px]">Win Rate</th>
                      <th className="px-3 py-2.5 text-right">
                        <SortableHeader
                          label="Avg P&L"
                          sortKey="avgPnl"
                          currentSortKey={setupSortKey}
                          sortOrder={setupSortOrder}
                          onSort={handleSetupSort}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-right">
                        <SortableHeader
                          label="Total P&L"
                          sortKey="totalPnl"
                          currentSortKey={setupSortKey}
                          sortOrder={setupSortOrder}
                          onSort={handleSetupSort}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-right">
                        <SortableHeader
                          label="Best Trade"
                          sortKey="bestTrade"
                          currentSortKey={setupSortKey}
                          sortOrder={setupSortOrder}
                          onSort={handleSetupSort}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left">
                        <SortableHeader
                          label="Verdict"
                          sortKey="verdict"
                          currentSortKey={setupSortKey}
                          sortOrder={setupSortOrder}
                          onSort={handleSetupSort}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSetupRows.map((row) => {
                      const config = VERDICT_CONFIG[row.verdict];
                      return (
                        <tr
                          key={row.setupType}
                          onClick={() => {
                            setDrillSetup(row.setupType);
                            setDrillPage(1);
                          }}
                          className="border-b border-border-subtle cursor-pointer hover:bg-elevated/50 transition-colors"
                        >
                          <td className="px-3 py-2.5 font-semibold text-text-primary">{row.setupType}</td>
                          <td className="px-3 py-2.5 text-text-secondary">{row.count}</td>
                          <td className="px-3 py-2.5">
                            <WinRateBar value={row.winRate} />
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right tabular-nums ${
                              row.avgPnl >= 0 ? 'text-profit' : 'text-loss'
                            }`}
                          >
                            {formatCurrencyWhole(row.avgPnl)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right tabular-nums font-medium ${
                              row.totalPnl >= 0 ? 'text-profit' : 'text-loss'
                            }`}
                          >
                            {formatCurrencyWhole(row.totalPnl)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right tabular-nums ${
                              row.bestTrade >= 0 ? 'text-profit' : 'text-loss'
                            }`}
                          >
                            {formatCurrencyWhole(row.bestTrade)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${config.className}`}
                            >
                              {config.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Sector Performance */}
          <Card>
            <CardHeader title="Sector Performance" subtitle="P&L and verdict by sector" />
            <CardBody className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-2.5 text-left">
                        <SortableHeader
                          label="Sector"
                          sortKey="sector"
                          currentSortKey={sectorSortKey}
                          sortOrder={sectorSortOrder}
                          onSort={handleSectorSort}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left">
                        <SortableHeader
                          label="Trades"
                          sortKey="count"
                          currentSortKey={sectorSortKey}
                          sortOrder={sectorSortOrder}
                          onSort={handleSectorSort}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left min-w-[100px]">Win Rate</th>
                      <th className="px-3 py-2.5 text-right">
                        <SortableHeader
                          label="Avg P&L"
                          sortKey="avgPnl"
                          currentSortKey={sectorSortKey}
                          sortOrder={sectorSortOrder}
                          onSort={handleSectorSort}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-right">
                        <SortableHeader
                          label="Total P&L"
                          sortKey="pnl"
                          currentSortKey={sectorSortKey}
                          sortOrder={sectorSortOrder}
                          onSort={handleSectorSort}
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left">Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSectorRows.map((row) => {
                      const config = VERDICT_CONFIG[row.verdict];
                      return (
                        <tr key={row.sector} className="border-b border-border-subtle">
                          <td className="px-3 py-2.5 font-semibold text-text-primary">{row.sector}</td>
                          <td className="px-3 py-2.5 text-text-secondary">{row.count}</td>
                          <td className="px-3 py-2.5">
                            <WinRateBar value={row.winRate} />
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right tabular-nums ${
                              row.avgPnl >= 0 ? 'text-profit' : 'text-loss'
                            }`}
                          >
                            {formatCurrencyWhole(row.avgPnl)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right tabular-nums font-medium ${
                              row.pnl >= 0 ? 'text-profit' : 'text-loss'
                            }`}
                          >
                            {formatCurrencyWhole(row.pnl)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${config.className}`}
                            >
                              {config.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          {/* Monthly P&L Calendar heatmap */}
          <Card>
            <CardHeader title="Monthly P&L" subtitle="Last 12 months" />
            <CardBody>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {(stats?.pnlByMonth ?? []).map((cell) => {
                  const intensity = maxAbsPnlMonth > 0 ? Math.min(1, Math.abs(cell.pnl) / maxAbsPnlMonth) : 0;
                  const isZero = cell.count === 0;
                  const isProfit = cell.pnl > 0;
                  let bg =
                    isZero
                      ? 'bg-elevated'
                      : isProfit
                        ? `rgba(0, 200, 150, ${0.15 + intensity * 0.5})`
                        : `rgba(239, 68, 68, ${0.15 + intensity * 0.5})`;
                  return (
                    <div
                      key={cell.month}
                      className="rounded-lg border border-border p-3 transition-transform hover:scale-[1.02]"
                      style={{ backgroundColor: bg }}
                      title={`${monthToFullLabel(cell.month)} · ${formatCurrencyWhole(cell.pnl)} · ${cell.count} trades`}
                    >
                      <p className="text-xs font-medium text-text-secondary">{monthToFullLabel(cell.month)}</p>
                      <p
                        className={`mt-1 font-mono text-sm font-semibold tabular-nums ${
                          isZero ? 'text-text-muted' : isProfit ? 'text-profit' : 'text-loss'
                        }`}
                      >
                        {cell.count === 0 ? '—' : formatCurrencyWhole(cell.pnl)}
                      </p>
                      {cell.count > 0 && (
                        <p className="mt-0.5 text-xs text-text-muted">{cell.count} trades</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Drill-down panel */}
      {drillSetup && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 transition-opacity"
            aria-hidden
            onClick={() => setDrillSetup(null)}
          />
          <aside
            className="fixed right-0 top-0 z-50 h-full w-full max-w-xl border-l border-border bg-base shadow-xl flex flex-col"
            style={{ animation: 'slideInRight 0.2s ease-out' }}
          >
            <style>{`
              @keyframes slideInRight {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
              }
            `}</style>
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-lg font-semibold text-text-primary truncate">{drillSetup}</h2>
              <button
                type="button"
                onClick={() => setDrillSetup(null)}
                className="rounded-md p-2 text-text-muted hover:bg-elevated hover:text-text-primary transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Mini equity curve */}
              {equityCurveData.length > 0 && (
                <Card>
                  <CardHeader title="Equity curve (this setup)" />
                  <CardBody className="pt-0">
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={equityCurveData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                            axisLine={{ stroke: 'var(--border-subtle)' }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                            axisLine={false}
                            tickLine={false}
                            width={44}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                              fontSize: '12px',
                            }}
                            formatter={(value: number) => [formatCurrencyWhole(value), 'Cumulative P&L']}
                          />
                          <Line
                            type="monotone"
                            dataKey="cumulative"
                            stroke="var(--accent)"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Trades list */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">Trades</h3>
                {setupTradesQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner size="md" />
                  </div>
                ) : (
                  <>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-border bg-elevated/50">
                            <th className="px-2 py-2 text-left font-medium text-text-primary">Symbol</th>
                            <th className="px-2 py-2 text-left font-medium text-text-primary">Entry</th>
                            <th className="px-2 py-2 text-left font-medium text-text-primary">Exit</th>
                            <th className="px-2 py-2 text-right font-medium text-text-primary">P&L</th>
                            <th className="px-2 py-2 text-left font-medium text-text-primary">Outcome</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(setupTradesQuery.data?.trades ?? []).map((t) => (
                            <tr key={t.id} className="border-b border-border-subtle">
                              <td className="px-2 py-1.5 font-mono text-text-primary">
                                <Link
                                  to={`/trades/${t.id}`}
                                  className="hover:text-accent hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {t.symbol}
                                </Link>
                              </td>
                              <td className="px-2 py-1.5 text-text-secondary">{formatDateShort(t.entryDate)}</td>
                              <td className="px-2 py-1.5 text-text-secondary">{formatDateShort(t.exitDate)}</td>
                              <td
                                className={`px-2 py-1.5 text-right tabular-nums ${
                                  t.pnl != null ? (t.pnl >= 0 ? 'text-profit' : 'text-loss') : 'text-text-muted'
                                }`}
                              >
                                {t.pnl != null ? formatCurrencyWhole(t.pnl) : '—'}
                              </td>
                              <td className="px-2 py-1.5">
                                <span
                                  className={`inline-flex rounded border px-1.5 py-0.5 text-xs ${
                                    t.outcome === 'win'
                                      ? 'bg-profit/15 text-profit border-profit/30'
                                      : t.outcome === 'loss'
                                        ? 'bg-loss/15 text-loss border-loss/30'
                                        : t.outcome === 'open'
                                          ? 'bg-warning/15 text-warning border-warning/30'
                                          : 'bg-text-muted/15 text-text-muted border-border-subtle'
                                  }`}
                                >
                                  {t.outcome ?? '—'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {setupTradesQuery.data && setupTradesQuery.data.totalPages > 1 && (
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-text-muted">
                          Page {drillPage} of {setupTradesQuery.data.totalPages}
                        </p>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={drillPage <= 1}
                            onClick={() => setDrillPage((p) => Math.max(1, p - 1))}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={drillPage >= setupTradesQuery.data.totalPages}
                            onClick={() => setDrillPage((p) => p + 1)}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
