import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, del } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatCurrencyWhole, formatDateShort } from '@/lib/format';
import type { Trade } from '@/types/trade';
import type { DashboardStats } from '@/types/dashboard';
import { ArrowLeft, Camera, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

type ApiTradeResponse = { success: boolean; data?: Trade };
type ApiStatsResponse = { success: boolean; data?: DashboardStats };

function holdingDays(entryDate: string, exitDate: string | null): number | null {
  const start = new Date(entryDate);
  const end = exitDate ? new Date(exitDate) : null;
  if (!end) return null;
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function outcomeLabel(outcome: string | null): string {
  if (!outcome) return 'Open';
  return outcome.charAt(0).toUpperCase() + outcome.slice(1);
}

function outcomeVariant(o: string | null): 'win' | 'loss' | 'open' | 'breakeven' {
  if (o === 'win') return 'win';
  if (o === 'loss') return 'loss';
  if (o === 'breakeven') return 'breakeven';
  return 'open';
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-elevated ${className}`} />;
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Skeleton className="h-4 w-24" />
        <span>/</span>
        <Skeleton className="h-4 w-32" />
        <span>/</span>
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}

export function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: trade, isLoading, error, refetch } = useQuery({
    queryKey: ['trade', id],
    queryFn: async () => {
      const res = await get<ApiTradeResponse>(`/api/trades/${id}`);
      if (!res?.success || !res.data) throw new Error('Not found');
      return res.data;
    },
    enabled: !!id,
  });

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await get<ApiStatsResponse>('/api/trades/stats');
      if (!res?.success || !res.data) return null;
      return res.data;
    },
    enabled: !!trade,
  });

  async function handleDelete() {
    if (!id) return;
    setIsDeleting(true);
    try {
      await del(`/api/trades/${id}`);
      toast.success('Trade deleted.');
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setDeleteOpen(false);
      navigate('/trades');
    } catch {
      toast.error('Failed to delete trade.');
    } finally {
      setIsDeleting(false);
    }
  }

  if (!id) {
    return (
      <>
        <PageHeader title="Trade Detail" />
        <div className="flex-1 overflow-auto p-6">
          <Card className="border-loss/20">
            <CardBody>
              <p className="text-loss">Invalid trade ID.</p>
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate('/trades')}>
                Back to Trade Log
              </Button>
            </CardBody>
          </Card>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Trade Detail" />
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-5xl">
            <DetailSkeleton />
          </div>
        </div>
      </>
    );
  }

  if (error || !trade) {
    return (
      <>
        <PageHeader title="Trade Detail" />
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-md">
            <Card className="border-border">
              <CardBody className="text-center">
                <p className="text-text-primary font-medium">Trade not found</p>
                <p className="mt-1 text-sm text-text-secondary">
                  This trade may have been deleted or you don’t have access to it.
                </p>
                <Button variant="secondary" size="sm" className="mt-4 mr-2" onClick={() => refetch()}>
                  Try again
                </Button>
                <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate('/trades')}>
                  Back to Trade Log
                </Button>
              </CardBody>
            </Card>
          </div>
        </div>
      </>
    );
  }

  const positionSize = trade.entryPrice * trade.quantity;
  const riskInr = Math.abs(trade.entryPrice - trade.stopLoss) * trade.quantity;
  const days = holdingDays(trade.entryDate, trade.exitDate);
  const roiPct = positionSize > 0 && trade.pnl != null ? (trade.pnl / positionSize) * 100 : null;
  const avgPnl = stats && stats.totalTrades > 0 ? stats.totalPnl / stats.totalTrades : null;

  return (
    <>
      <PageHeader
        title="Trade Detail"
        actions={
          <Link to="/trades">
            <Button variant="ghost" size="sm" leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Back to log
            </Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-text-secondary">
            <Link to="/trades" className="hover:text-accent transition-colors">
              Trade Log
            </Link>
            <span aria-hidden>/</span>
            <span className="text-text-primary font-medium">{trade.symbol}</span>
            <span aria-hidden>/</span>
            <span className="text-text-muted">Trade Detail</span>
          </nav>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            {/* Left column — Trade info */}
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-mono text-[28px] font-bold text-text-primary">{trade.symbol}</h1>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-mono font-medium ${
                      trade.direction === 'long' ? 'bg-profit/15 text-profit' : 'bg-loss/15 text-loss'
                    }`}
                  >
                    {trade.direction === 'long' ? 'LONG' : 'SHORT'}
                  </span>
                </div>
                <Badge variant={outcomeVariant(trade.outcome)} className="text-xs">
                  {outcomeLabel(trade.outcome)}
                </Badge>
              </div>
              <p className="text-sm text-text-secondary">
                {formatDateShort(trade.entryDate)} → {trade.exitDate ? formatDateShort(trade.exitDate) : 'Open'}
              </p>

              {/* Key metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardBody className="py-3">
                    <p className="text-xs text-text-muted">P&L</p>
                    <p
                      className={`font-mono text-lg font-semibold tabular-nums ${
                        trade.pnl != null ? (trade.pnl >= 0 ? 'text-profit' : 'text-loss') : 'text-text-primary'
                      }`}
                    >
                      {trade.pnl != null
                        ? `${trade.pnl >= 0 ? '' : '−'}${formatCurrencyWhole(Math.abs(trade.pnl))}`
                        : '—'}
                    </p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="py-3">
                    <p className="text-xs text-text-muted">Reward:Risk</p>
                    <p className="font-mono text-lg font-semibold tabular-nums text-text-primary">
                      {trade.riskReward != null ? `${trade.riskReward.toFixed(2)} : 1` : '—'}
                    </p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="py-3">
                    <p className="text-xs text-text-muted">Holding</p>
                    <p className="font-mono text-lg font-semibold tabular-nums text-text-primary">
                      {days != null ? `${days} days` : 'Ongoing'}
                    </p>
                  </CardBody>
                </Card>
                <Card>
                  <CardBody className="py-3">
                    <p className="text-xs text-text-muted">ROI %</p>
                    <p className="font-mono text-lg font-semibold tabular-nums text-text-primary">
                      {roiPct != null ? `${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(1)}%` : '—'}
                    </p>
                  </CardBody>
                </Card>
              </div>

              {/* Price breakdown */}
              <Card>
                <CardBody>
                  <h3 className="text-sm font-medium text-text-secondary mb-3">Price breakdown</h3>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-3 text-sm">
                    <div>
                      <p className="text-text-muted">Entry Price</p>
                      <p className="font-mono text-text-primary">{formatCurrency(trade.entryPrice)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Exit Price</p>
                      <p className="font-mono text-text-primary">
                        {trade.exitPrice != null ? formatCurrency(trade.exitPrice) : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-muted">Quantity</p>
                      <p className="font-mono text-text-primary">{trade.quantity}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Stop Loss</p>
                      <p className="font-mono text-text-primary">{formatCurrency(trade.stopLoss)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Target</p>
                      <p className="font-mono text-text-primary">{formatCurrency(trade.target)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Position Size</p>
                      <p className="font-mono text-text-primary">{formatCurrencyWhole(positionSize)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Risk</p>
                      <p className="font-mono text-text-primary">
                        {formatCurrencyWhole(riskInr)}
                        {stats?.portfolioAmount != null && stats.portfolioAmount > 0 && (
                          <span className="ml-1 text-text-muted text-xs">
                            ({((riskInr / stats.portfolioAmount) * 100).toFixed(2)}% of portfolio)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Setup, Sector, Market environment */}
              {(trade.setupType || trade.sector || trade.marketPulse) && (
                <p className="text-sm text-text-secondary flex flex-wrap gap-2">
                  {trade.setupType && (
                    <span className="rounded-md border border-border bg-elevated px-2 py-0.5 text-xs text-text-primary">
                      {trade.setupType}
                    </span>
                  )}
                  {trade.sector && (
                    <span className="rounded-md border border-border bg-elevated px-2 py-0.5 text-xs text-text-primary">
                      {trade.sector}
                    </span>
                  )}
                  {trade.marketPulse && (
                    <span className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent">
                      {trade.marketPulse}
                    </span>
                  )}
                </p>
              )}

              {/* Execution errors */}
              {trade.executionErrors?.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted mb-1">Execution errors</p>
                  <div className="flex flex-wrap gap-1">
                    {trade.executionErrors.map((err) => (
                      <span
                        key={err}
                        className="rounded-md border border-loss/30 bg-loss/10 px-2 py-0.5 text-xs text-loss"
                      >
                        {err}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Exit reason & Execution grade */}
              {(trade.exitReason || trade.executionGrade) && (
                <div className="flex flex-wrap gap-3 text-sm">
                  {trade.exitReason && (
                    <div>
                      <span className="text-text-muted">Exit reason: </span>
                      <span className="text-text-primary">{trade.exitReason}</span>
                    </div>
                  )}
                  {trade.executionGrade && (
                    <div>
                      <span className="text-text-muted">Execution grade: </span>
                      <span className="text-text-primary">{trade.executionGrade}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              <Card className={trade.notes ? 'border-l-4 border-l-accent' : ''}>
                <CardBody>
                  <h3 className="text-sm font-medium text-text-secondary mb-2">Notes</h3>
                  {trade.notes ? (
                    <p className="text-sm text-text-primary whitespace-pre-wrap">{trade.notes}</p>
                  ) : (
                    <p className="text-sm text-text-muted">No notes for this trade.</p>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Right column */}
            <div className="space-y-4 lg:max-w-[320px]">
              {/* Screenshot */}
              {trade.screenshotUrl ? (
                <Card>
                  <CardBody className="p-0 overflow-hidden">
                    <a
                      href={trade.screenshotUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <img
                        src={trade.screenshotUrl}
                        alt="Trade chart"
                        className="w-full h-auto object-cover"
                      />
                    </a>
                    <div className="px-3 py-2 border-t border-border">
                      <a
                        href={trade.screenshotUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline"
                      >
                        View full size
                      </a>
                    </div>
                  </CardBody>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardBody className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="rounded-full bg-elevated p-4 text-text-muted mb-3">
                      <Camera className="h-8 w-8" />
                    </div>
                    <p className="text-sm text-text-secondary">No chart screenshot</p>
                    <Link to={`/trades/${id}/edit`} className="mt-2 text-xs text-accent hover:underline">
                      Add one in Edit Trade
                    </Link>
                  </CardBody>
                </Card>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Link to={`/trades/${id}/edit`} className="block">
                  <Button variant="primary" size="md" className="w-full" leftIcon={<Pencil className="h-4 w-4" />}>
                    Edit Trade
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="md"
                  className="w-full text-loss hover:bg-loss/10"
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete Trade
                </Button>
              </div>

              {/* Related stats */}
              {stats && stats.totalTrades > 0 && trade.pnl != null && (
                <Card>
                  <CardBody>
                    <h3 className="text-sm font-medium text-text-secondary mb-3">
                      How this trade compares to your average
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-text-muted">Your avg P&L</span>
                        <span className="font-mono text-text-primary">{formatCurrencyWhole(avgPnl ?? 0)}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-text-muted">This trade</span>
                        <span
                          className={`font-mono ${
                            trade.pnl >= 0 ? 'text-profit' : 'text-loss'
                          }`}
                        >
                          {trade.pnl >= 0 ? '+' : ''}{formatCurrencyWhole(trade.pnl)}
                          {avgPnl != null && (
                            <span className="ml-1 text-text-muted text-xs">
                              ({trade.pnl >= avgPnl ? '+' : ''}{(trade.pnl - avgPnl).toFixed(0)} vs avg)
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-border-subtle">
                        <span className="text-text-muted">Your win rate </span>
                        <span className="font-mono text-text-primary">{stats.winRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 p-4">
          <Card className="w-full max-w-sm">
            <CardBody>
              <h3 className="font-semibold text-text-primary">Delete this trade?</h3>
              <p className="mt-1 text-sm text-text-secondary">
                This cannot be undone. The trade will be permanently removed.
              </p>
              <div className="mt-4 flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
                  Cancel
                </Button>
                <Button variant="danger" size="sm" onClick={handleDelete} loading={isDeleting}>
                  Delete
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  );
}
