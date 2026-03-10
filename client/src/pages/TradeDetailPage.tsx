import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, del } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency, formatCurrencyWhole, formatDateShort, formatRMultiple } from '@/lib/format';
import type { Trade } from '@/types/trade';
import type { DashboardStats } from '@/types/dashboard';
import { ArrowLeft, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

function hasMeaningfulSetup(value: string | null | undefined): boolean {
  const s = value?.trim();
  return !!(s && s.toLowerCase() !== 'unknown');
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
  const [lightboxOpen, setLightboxOpen] = useState(false);

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

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen]);

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
  const rMultiple = formatRMultiple(trade.pnl, riskInr);
  const plannedMove = trade.target - trade.entryPrice;
  const capturedMove =
    trade.exitPrice != null ? trade.exitPrice - trade.entryPrice : null;
  const efficiencyPct =
    plannedMove !== 0 &&
    capturedMove != null &&
    trade.direction === 'long'
      ? Math.min(100, Math.max(0, (capturedMove / plannedMove) * 100))
      : null;

  const executionRows: [string, string][] = [
    ['Quantity', `${trade.quantity} shares`],
    ['Avg. Entry Price', formatCurrency(trade.entryPrice)],
    ['Avg. Exit Price', trade.exitPrice != null ? formatCurrency(trade.exitPrice) : '—'],
    ['Initial Stop Loss', formatCurrency(trade.stopLoss)],
    ...(Math.abs(trade.target - trade.entryPrice) >= 0.01
      ? ([['Planned Target', formatCurrency(trade.target)]] as [string, string][])
      : []),
    ['Holding Period', days != null ? `${days} days` : 'Ongoing'],
    ['Capital Deployed', formatCurrencyWhole(positionSize)],
  ];

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
      <div className="flex-1 overflow-auto p-6 sm:p-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <nav className="flex items-center gap-2 text-xs tracking-wide text-text-muted">
            <Link to="/trades" className="hover:text-accent transition-colors">
              Trade Log
            </Link>
            <span aria-hidden className="opacity-50">·</span>
            <span className="text-text-primary font-medium">{trade.symbol}</span>
          </nav>

          {/* Hero: symbol, badges, date, and key metrics */}
          <header className="rounded-xl border border-border bg-elevated/60 px-5 py-5 sm:px-6 sm:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-mono text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                    {trade.symbol}
                  </h1>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11px] font-mono font-medium uppercase tracking-wider ${
                      trade.direction === 'long' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                    }`}
                  >
                    {trade.direction === 'long' ? 'Long' : 'Short'}
                  </span>
                  <Badge variant={outcomeVariant(trade.outcome)} className="text-xs font-medium">
                    {outcomeLabel(trade.outcome)}
                  </Badge>
                </div>
                <p className="text-sm text-text-secondary">
                  {formatDateShort(trade.entryDate)}
                  <span className="mx-1.5 text-text-muted">→</span>
                  {trade.exitDate ? formatDateShort(trade.exitDate) : 'Open'}
                </p>
              </div>
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border pt-4 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
                <span
                  className={`font-mono text-xl font-semibold tabular-nums sm:text-2xl ${
                    trade.pnl != null ? (trade.pnl >= 0 ? 'text-profit' : 'text-loss') : 'text-text-primary'
                  }`}
                >
                  {trade.pnl != null
                    ? `${trade.pnl >= 0 ? '+' : '−'}${formatCurrencyWhole(Math.abs(trade.pnl))}`
                    : '—'}
                </span>
                {roiPct != null && (
                  <span className="font-mono text-sm tabular-nums text-text-secondary">
                    {roiPct >= 0 ? '+' : ''}{roiPct.toFixed(1)}%
                  </span>
                )}
                {rMultiple != null && (
                  <span
                    className={`font-mono text-sm font-medium tabular-nums ${
                      trade.pnl != null && trade.pnl >= 0 ? 'text-profit' : 'text-loss'
                    }`}
                  >
                    {rMultiple}
                  </span>
                )}
              </div>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
            <div className="space-y-8">
              {/* The Setup — only when we have meaningful setup/market pulse (not empty or "unknown") */}
              {(hasMeaningfulSetup(trade.setupType) || hasMeaningfulSetup(trade.marketPulse)) && (
                <Card className="overflow-hidden border-border bg-surface">
                  <CardBody className="py-5">
                    <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-text-muted">
                      The Setup
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      {hasMeaningfulSetup(trade.setupType) && (
                        <span className="rounded-xl border border-border bg-elevated/80 px-4 py-2 text-sm font-medium text-text-primary shadow-sm transition-shadow hover:shadow-md">
                          {trade.setupType!.trim()}
                        </span>
                      )}
                      {hasMeaningfulSetup(trade.marketPulse) && (
                        <span className="rounded-xl border border-accent/50 bg-accent/15 px-4 py-2 text-sm font-medium text-accent shadow-sm transition-shadow hover:shadow-md hover:bg-accent/20">
                          {trade.marketPulse!.trim()}
                        </span>
                      )}
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Execution Details */}
              <Card className="overflow-hidden border-border bg-surface">
                <CardBody className="py-5">
                  <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-text-muted">
                    Execution Details
                  </h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {executionRows.map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-border-subtle bg-elevated/50 px-4 py-3 transition-colors hover:bg-elevated/70 hover:border-border"
                      >
                        <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-text-muted">
                          {label}
                        </p>
                        <p className="font-mono text-base font-semibold tabular-nums text-text-primary">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>

              {/* The Audit — only when there is something to show */}
              {(trade.exitReason ||
                trade.executionGrade ||
                (trade.executionErrors?.length ?? 0) > 0 ||
                (trade.notes?.trim() ?? '') !== '') && (
                <Card
                  className={`overflow-hidden border-border bg-surface ${
                    trade.notes?.trim() ? 'border-l-4 border-l-accent' : ''
                  }`}
                >
                  <CardBody className="py-5">
                    <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-text-muted">
                      The Audit
                    </h2>
                    <div className="space-y-5">
                      {(trade.exitReason || trade.executionGrade) && (
                        <div className="flex flex-wrap gap-3">
                          {trade.executionGrade && (
                            <div className="rounded-xl border border-border-subtle bg-elevated/50 px-4 py-2.5">
                              <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                                Execution grade
                              </span>
                              <p className="mt-0.5 font-medium text-text-primary">
                                {trade.executionGrade}
                              </p>
                            </div>
                          )}
                          {trade.exitReason && (
                            <div className="rounded-xl border border-border-subtle bg-elevated/50 px-4 py-2.5">
                              <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                                Exit reason
                              </span>
                              <p className="mt-0.5 font-medium text-text-primary">
                                {trade.exitReason}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                      {trade.executionErrors?.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                            Execution errors
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {trade.executionErrors.map((err) => (
                              <span
                                key={err}
                                className="rounded-xl border border-loss/40 bg-loss/15 px-3 py-1.5 text-xs font-medium text-loss"
                              >
                                {err}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {(trade.notes?.trim() ?? '') !== '' && (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                            Notes
                          </p>
                          <div className="markdown-notes rounded-xl border border-border-subtle bg-elevated/30 p-4 text-sm leading-relaxed text-text-primary space-y-2 [&_p]:my-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:rounded [&_code]:bg-elevated [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => <p className="my-0 first:mt-0 last:mb-0">{children}</p>,
                                ul: ({ children }) => <ul className="my-2">{children}</ul>,
                                ol: ({ children }) => <ol className="my-2">{children}</ol>,
                              }}
                            >
                              {trade.notes}
                            </ReactMarkdown>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              )}

              {/* Risk Analysis */}
              <Card className="overflow-hidden border-border bg-surface">
                <CardBody className="py-5">
                  <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-text-muted">
                    Risk Analysis
                  </h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border-subtle bg-elevated/50 px-4 py-3 transition-colors hover:bg-elevated/70 hover:border-border">
                      <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-text-muted">
                        Initial Risk (1R)
                      </p>
                      <p className="font-mono text-base font-semibold tabular-nums text-text-primary">
                        {formatCurrencyWhole(riskInr)}
                      </p>
                    </div>
                    {stats?.portfolioAmount != null && stats.portfolioAmount > 0 && (
                      <div className="rounded-xl border border-border-subtle bg-elevated/50 px-4 py-3 transition-colors hover:bg-elevated/70 hover:border-border">
                        <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-text-muted">
                          Risk % of portfolio
                        </p>
                        <p className="font-mono text-base font-semibold tabular-nums text-text-primary">
                          {((riskInr / stats.portfolioAmount) * 100).toFixed(2)}%
                        </p>
                      </div>
                    )}
                    {efficiencyPct != null && (
                      <div className="rounded-xl border border-border-subtle bg-elevated/50 px-4 py-3 transition-colors hover:bg-elevated/70 hover:border-border">
                        <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-text-muted">
                          Efficiency
                        </p>
                        <p className="font-mono text-base font-semibold tabular-nums text-text-primary">
                          {efficiencyPct.toFixed(0)}%
                        </p>
                      </div>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>

            <aside className="space-y-6 lg:max-w-[340px]">
              {/* Chart screenshot + lightbox — only when screenshot exists */}
              {trade.screenshotUrl && (
                <Card className="overflow-hidden border-border bg-surface">
                  <CardBody className="p-0">
                    <button
                      type="button"
                      className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-accent focus:ring-inset rounded-t-lg overflow-hidden"
                      onClick={() => setLightboxOpen(true)}
                      aria-label="Open chart in lightbox"
                    >
                      <img
                        src={trade.screenshotUrl}
                        alt="Trade chart"
                        className="w-full h-auto object-cover cursor-pointer transition-opacity hover:opacity-90"
                      />
                    </button>
                    <div className="border-t border-border px-4 py-2.5">
                      <button
                        type="button"
                        className="text-xs font-medium text-accent hover:underline"
                        onClick={() => setLightboxOpen(true)}
                      >
                        View full size
                      </button>
                    </div>
                  </CardBody>
                </Card>
              )}

              <div className="flex flex-col gap-2">
                <Link to={`/trades/${id}/edit`} className="block">
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full"
                    leftIcon={<Pencil className="h-4 w-4" />}
                  >
                    Edit Trade
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="md"
                  className="w-full text-loss hover:bg-loss/10 hover:text-loss"
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  onClick={() => setDeleteOpen(true)}
                >
                  Delete Trade
                </Button>
              </div>

              {stats && stats.totalTrades > 0 && trade.pnl != null && (
                <Card className="overflow-hidden border-border bg-surface">
                  <CardBody className="py-5">
                    <h3 className="mb-4 text-xs font-medium uppercase tracking-wider text-text-muted">
                      Vs. your average
                    </h3>
                    <div className="space-y-3">
                      <div className="rounded-xl border border-border-subtle bg-elevated/50 px-4 py-2.5 transition-colors hover:bg-elevated/70">
                        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                          Avg P&L
                        </p>
                        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-text-primary">
                          {formatCurrencyWhole(avgPnl ?? 0)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border-subtle bg-elevated/50 px-4 py-2.5 transition-colors hover:bg-elevated/70">
                        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                          This trade
                        </p>
                        <p
                          className={`mt-0.5 font-mono text-sm font-semibold tabular-nums ${
                            trade.pnl >= 0 ? 'text-profit' : 'text-loss'
                          }`}
                        >
                          {trade.pnl >= 0 ? '+' : ''}{formatCurrencyWhole(trade.pnl)}
                          {avgPnl != null && (
                            <span className="ml-1.5 text-xs font-normal text-text-muted">
                              ({trade.pnl >= avgPnl ? '+' : ''}{(trade.pnl - avgPnl).toFixed(0)} vs avg)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border-subtle bg-elevated/50 px-4 py-2.5 transition-colors hover:bg-elevated/70">
                        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">
                          Win rate
                        </p>
                        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-text-primary">
                          {stats.winRate.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxOpen && trade.screenshotUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-base/90 backdrop-blur-sm p-4"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Chart full size"
        >
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-elevated/90 p-2.5 text-text-primary hover:bg-elevated focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={trade.screenshotUrl}
            alt="Trade chart"
            className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Delete confirm */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm overflow-hidden shadow-xl">
            <CardBody className="py-6">
              <h3 className="text-lg font-semibold text-text-primary">Delete this trade?</h3>
              <p className="mt-2 text-sm text-text-secondary">
                This cannot be undone. The trade will be permanently removed.
              </p>
              <div className="mt-6 flex gap-3 justify-end">
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
