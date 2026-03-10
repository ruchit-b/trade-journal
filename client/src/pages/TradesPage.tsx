import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, parse } from 'date-fns';
import DatePicker from 'react-datepicker';
import { get, del } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { formatCurrencyWhole, formatDateShort } from '@/lib/format';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuth } from '@/contexts/AuthContext';
import type { TradesResponse } from '@/types/trade';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  Columns3,
  Filter,
  ListOrdered,
  Plus,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import 'react-datepicker/dist/react-datepicker.css';

const TRADES_URL = '/api/trades';
const PAGE_SIZE = 10;
const SORT_FIELDS = ['symbol', 'entryDate', 'exitDate', 'pnl', 'riskReward'] as const;
const COLUMNS_STORAGE_KEY = 'trade-log-visible-columns';

const COLUMN_DEFS = [
  { id: 'symbol', label: 'Symbol', defaultVisible: true, sortField: 'symbol' as const },
  { id: 'direction', label: 'Direction', defaultVisible: true, sortField: null },
  { id: 'entryPrice', label: 'Entry', defaultVisible: true, sortField: null },
  { id: 'exitPrice', label: 'Exit', defaultVisible: true, sortField: null },
  { id: 'quantity', label: 'Qty', defaultVisible: false, sortField: null },
  { id: 'pnl', label: 'P&L', defaultVisible: false, sortField: 'pnl' as const },
  { id: 'pnlPct', label: 'P&L %', defaultVisible: true, sortField: null },
  { id: 'portfolioPct', label: 'Portfolio %', defaultVisible: false, sortField: null },
  { id: 'riskReward', label: 'Reward:Risk', defaultVisible: true, sortField: 'riskReward' as const },
  { id: 'setupType', label: 'Setup', defaultVisible: false, sortField: null },
  { id: 'daysHold', label: 'Days hold', defaultVisible: false, sortField: null },
  { id: 'entryDate', label: 'Entry Date', defaultVisible: false, sortField: 'entryDate' as const },
  { id: 'exitDate', label: 'Exit Date', defaultVisible: false, sortField: 'exitDate' as const },
  { id: 'outcome', label: 'Outcome', defaultVisible: true, sortField: null },
] as const;

function getDefaultVisibleColumnIds(): string[] {
  return COLUMN_DEFS.filter((c) => c.defaultVisible).map((c) => c.id);
}

function loadVisibleColumnIds(): string[] {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return getDefaultVisibleColumnIds();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.some((x) => typeof x !== 'string')) return getDefaultVisibleColumnIds();
    const validIds = new Set<string>(COLUMN_DEFS.map((c) => c.id));
    const filtered = parsed.filter((id: string) => validIds.has(id));
    return filtered.length > 0 ? filtered : getDefaultVisibleColumnIds();
  } catch {
    return getDefaultVisibleColumnIds();
  }
}

function saveVisibleColumnIds(ids: string[]): void {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}
const OUTCOME_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'win', label: 'Win' },
  { value: 'loss', label: 'Loss' },
  { value: 'open', label: 'Open' },
  { value: 'breakeven', label: 'Breakeven' },
];
type ApiTradesResponse = { success: boolean; data?: TradesResponse };

async function fetchTrades(params: Record<string, string | number>): Promise<TradesResponse> {
  const res = await get<ApiTradesResponse>(TRADES_URL, { params });
  if (!res?.success || !res.data) throw new Error('Failed to fetch trades');
  return res.data;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-elevated ${className}`} />;
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="w-10 px-3 py-2.5" />
            {[...Array(11)].map((_, i) => (
              <th key={i} className="px-3 py-2.5 text-left">
                <Skeleton className="h-4 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(8)].map((_, row) => (
            <tr key={row} className="border-b border-border-subtle">
              <td className="w-10 px-3 py-2">
                <Skeleton className="h-4 w-4 rounded" />
              </td>
              {[...Array(11)].map((_, i) => (
                <td key={i} className="px-3 py-2">
                  <Skeleton className="h-4 w-full max-w-[80px]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Candlestick illustration for empty log */
function CandlestickIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 80" fill="none" xmlns="http://www.w3.org/2000/svg">
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

function outcomeVariant(t: string | null): 'win' | 'loss' | 'open' | 'breakeven' {
  if (t === 'win') return 'win';
  if (t === 'loss') return 'loss';
  if (t === 'open') return 'open';
  if (t === 'breakeven') return 'breakeven';
  return 'open';
}

export function TradesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const portfolioAmount = user?.portfolioAmount ?? null;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() => loadVisibleColumnIds());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const visibleColumns = useMemo(
    () => COLUMN_DEFS.filter((c) => visibleColumnIds.includes(c.id)),
    [visibleColumnIds]
  );

  const toggleColumn = useCallback((id: string) => {
    setVisibleColumnIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      const ordered = COLUMN_DEFS.filter((c) => next.includes(c.id)).map((c) => c.id);
      saveVisibleColumnIds(ordered);
      return ordered;
    });
  }, []);

  const resetColumnsToDefault = useCallback(() => {
    const defaultIds = getDefaultVisibleColumnIds();
    setVisibleColumnIds(defaultIds);
    saveVisibleColumnIds(defaultIds);
    setColumnsOpen(false);
  }, []);

  const columnsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!columnsOpen) return;
    const handle = (e: MouseEvent) => {
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) setColumnsOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [columnsOpen]);

  const symbol = searchParams.get('symbol') ?? '';
  const debouncedSymbol = useDebounce(symbol, 300);
  const outcome = searchParams.get('outcome') ?? '';
  const direction = searchParams.get('direction') ?? '';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';
  const sortBy = (searchParams.get('sortBy') ?? 'entryDate') as (typeof SORT_FIELDS)[number];
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc';
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debouncedSymbol && { symbol: debouncedSymbol.trim() }),
      ...(outcome && { outcome }),
      ...(direction && { direction }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
      sortBy,
      sortOrder,
    }),
    [page, debouncedSymbol, outcome, direction, dateFrom, dateTo, sortBy, sortOrder]
  );

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['trades', queryParams],
    queryFn: () => fetchTrades(queryParams),
  });

  const hasActiveFilters = !!(symbol || outcome || direction || dateFrom || dateTo);

  const setParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') {
          next.delete('page');
          next.set('page', '1');
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const setSort = useCallback(
    (field: (typeof SORT_FIELDS)[number]) => {
      const nextOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('sortBy', field);
        next.set('sortOrder', nextOrder);
        return next;
      });
    },
    [sortBy, sortOrder, setSearchParams]
  );

  const clearFilters = useCallback(() => {
    setSearchParams({ page: '1' });
    setSelectedIds(new Set());
  }, [setSearchParams]);

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const trades = data?.trades ?? [];
  const start = (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  const allOnPageSelected = trades.length > 0 && trades.every((t) => selectedIds.has(t.id));
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelectedIds((s) => {
        const next = new Set(s);
        trades.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds((s) => {
        const next = new Set(s);
        trades.forEach((t) => next.add(t.id));
        return next;
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((id) => del(`${TRADES_URL}/${id}`)));
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      toast.success(`${ids.length} trade(s) deleted.`);
    } catch {
      toast.error('Failed to delete some trades.');
    }
  };

  const SortHeader = ({
    field,
    label,
  }: {
    field: (typeof SORT_FIELDS)[number];
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => setSort(field)}
      className="inline-flex items-center gap-0.5 font-medium text-text-secondary hover:text-text-primary transition-colors text-left"
    >
      {label}
      {sortBy === field ? (
        sortOrder === 'desc' ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronUp className="h-4 w-4 shrink-0" />
        )
      ) : null}
    </button>
  );

  const renderTh = (col: (typeof COLUMN_DEFS)[number]) => {
    if (col.sortField != null) {
      return (
        <SortHeader field={col.sortField} label={col.label} />
      );
    }
    return col.label;
  };

  return (
    <>
      <PageHeader
        title="Trade Log"
        actions={
          <Link to="/trades/new">
            <Button variant="primary" size="sm" leftIcon={<Plus className="h-4 w-4" />}>
              Add Trade
            </Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-[1400px] space-y-4">
          {/* Filters + Columns toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div />
            <div className="relative flex gap-2" ref={columnsRef}>
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  filtersOpen
                    ? 'border-accent bg-accent-dim text-accent'
                    : 'border-border bg-surface text-text-primary hover:bg-elevated'
                }`}
              >
                <Filter className="h-4 w-4 text-text-muted" />
                Filters
                {hasActiveFilters && (
                  <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs font-medium text-accent">
                    On
                  </span>
                )}
              </button>
            <button
              type="button"
              onClick={() => setColumnsOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-primary hover:bg-elevated transition-colors"
            >
              <Columns3 className="h-4 w-4 text-text-muted" />
              Columns
            </button>
            <button
              type="button"
              onClick={resetColumnsToDefault}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors"
              aria-label="Reset columns to default"
              title="Reset columns to default"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            {columnsOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-60 rounded-lg border border-border bg-surface py-2 shadow-lg">
                <div className="px-3 py-1.5 text-xs font-medium text-text-muted border-b border-border">
                  Show columns
                </div>
                <div className="max-h-72 overflow-y-auto px-1">
                  {COLUMN_DEFS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => toggleColumn(col.id)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-text-primary hover:bg-elevated"
                    >
                      <Checkbox checked={visibleColumnIds.includes(col.id)} className="pointer-events-none" />
                      {col.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Collapsible filter panel */}
          {filtersOpen && (
            <Card>
              <CardBody className="py-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[120px]">
                    <label className="block text-xs text-text-muted mb-1">Symbol</label>
                    <input
                      type="text"
                      value={symbol}
                      onChange={(e) => setParam('symbol', e.target.value)}
                      placeholder="e.g. RELIANCE"
                      className="w-full rounded-md border border-border bg-elevated px-2.5 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                  </div>
                  <div className="min-w-[100px]">
                    <label className="block text-xs text-text-muted mb-1">Outcome</label>
                    <select
                      value={outcome}
                      onChange={(e) => setParam('outcome', e.target.value)}
                      className="w-full rounded-md border border-border bg-elevated px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                    >
                      {OUTCOME_OPTIONS.map((o) => (
                        <option key={o.value || 'all'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-[90px]">
                    <label className="block text-xs text-text-muted mb-1">Direction</label>
                    <div className="flex h-10 overflow-hidden rounded-full border border-border bg-elevated">
                      {[
                        { value: '', label: 'All' },
                        { value: 'long', label: 'Long' },
                        { value: 'short', label: 'Short' },
                      ].map((opt) => {
                        const active = direction === opt.value;
                        return (
                          <button
                            key={opt.value || '__all__'}
                            type="button"
                            onClick={() => setParam('direction', active ? '' : opt.value)}
                            className={`px-3 text-xs font-medium transition-colors ${
                              active
                                ? opt.value === 'long'
                                  ? 'bg-profit text-white'
                                  : opt.value === 'short'
                                    ? 'bg-loss text-white'
                                    : 'bg-accent text-accent-foreground'
                                : 'text-text-muted hover:text-text-primary'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">From</label>
                    <DatePicker
                      selected={dateFrom ? parse(dateFrom, 'yyyy-MM-dd', new Date()) : null}
                      onChange={(d: Date | null) => setParam('dateFrom', d ? format(d, 'yyyy-MM-dd') : '')}
                      dateFormat="dd MMM yyyy"
                      className="rounded-md border border-border bg-elevated px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                      placeholderText="Select date"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">To</label>
                    <DatePicker
                      selected={dateTo ? parse(dateTo, 'yyyy-MM-dd', new Date()) : null}
                      onChange={(d: Date | null) => setParam('dateTo', d ? format(d, 'yyyy-MM-dd') : '')}
                      dateFormat="dd MMM yyyy"
                      className="rounded-md border border-border bg-elevated px-2.5 py-1.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                      placeholderText="Select date"
                    />
                  </div>
                  {hasActiveFilters && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={clearFilters}
                      className="border border-border hover:border-accent/50"
                      leftIcon={<X className="h-4 w-4" />}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Bulk delete bar */}
          {selectedIds.size > 0 && (
            <div className="sticky top-3 z-20 rounded-xl border border-[rgba(239,68,68,0.40)] bg-[rgba(239,68,68,0.10)] px-4 py-3 shadow-lg backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-loss/15 text-loss">
                    <Trash2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      <span className="font-mono">{selectedIds.size}</span> trade{selectedIds.size === 1 ? '' : 's'} selected
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedIds(new Set())}
                    leftIcon={<X className="h-4 w-4" />}
                    className="rounded-full"
                  >
                    Clear selection
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<Trash2 className="h-4 w-4" />}
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="rounded-full border-[rgba(239,68,68,0.45)] bg-[rgba(239,68,68,0.14)] text-[rgb(239,68,68)] hover:bg-[rgba(239,68,68,0.20)]"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Delete confirm modal */}
          {deleteConfirmOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setDeleteConfirmOpen(false);
              }}
            >
              <Card className="w-full max-w-md">
                <CardBody>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-loss/15 text-loss">
                      <Trash2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-text-primary">Delete selected trades?</h3>
                      <p className="mt-1 text-sm text-text-secondary">
                        You’re about to permanently delete{' '}
                        <span className="font-mono font-medium text-text-primary">{selectedIds.size}</span>{' '}
                        trade{selectedIds.size === 1 ? '' : 's'}. This can’t be undone.
                      </p>
                      <div className="mt-3 rounded-lg border border-border bg-elevated/50 px-3 py-2 text-xs text-text-muted">
                        Tip: If you clicked by mistake, use “Clear selection” instead.
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteConfirmOpen(false)}
                    >
                      Keep trades
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      leftIcon={<Trash2 className="h-4 w-4" />}
                      onClick={handleBulkDelete}
                    >
                      Delete {selectedIds.size}
                    </Button>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* Table */}
          {isLoading && <TableSkeleton />}

          {error && (
            <ErrorCard
              title="Failed to load trades"
              message="We couldn't load your trade log. Check your connection and try again."
              onRetry={() => refetch()}
            />
          )}

          {!isLoading && !error && data && total === 0 && !hasActiveFilters && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-surface/50 py-16 px-6 text-center">
              <div className="mb-4 text-accent opacity-90">
                <CandlestickIllustration className="h-20 w-auto" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary">Your trade log is empty</h3>
              <p className="mt-1 text-sm text-text-secondary">Add your first trade to get started.</p>
              <Link to="/trades/new" className="mt-6">
                <Button variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />}>
                  Add Trade
                </Button>
              </Link>
            </div>
          )}

          {!isLoading && !error && data && total === 0 && hasActiveFilters && (
            <EmptyState
              icon={ListOrdered}
              title="No trades match your filters"
              description="Try clearing some filters or changing your criteria."
              actionLabel="Clear filters"
              onAction={clearFilters}
            />
          )}

          {!isLoading && !error && data && trades.length > 0 && (
            <>
              <div className="rounded-lg border border-border bg-surface overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-elevated/70 backdrop-blur supports-[backdrop-filter]:bg-elevated/60">
                        <th className="sticky left-0 z-10 w-10 bg-elevated/50 px-2 py-2 text-left">
                          <Checkbox
                            checked={
                              trades.length > 0 && allOnPageSelected
                                ? true
                                : trades.length > 0 && selectedIds.size > 0
                                  ? 'indeterminate'
                                  : false
                            }
                            onCheckedChange={() => toggleSelectAll()}
                          />
                        </th>
                        {visibleColumns.map((col) => (
                          <th
                            key={col.id}
                            className={`px-4 py-3 font-medium text-text-secondary ${col.id === 'symbol' ? 'text-left' : 'text-right'}`}
                          >
                            {renderTh(col)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((t) => (
                        <tr
                          key={t.id}
                          onClick={() => navigate(`/trades/${t.id}`)}
                          className={`group border-b border-border-subtle cursor-pointer transition-colors ${
                            selectedIds.has(t.id)
                              ? 'bg-[rgba(0,200,150,0.06)] hover:bg-[rgba(0,200,150,0.09)]'
                              : 'hover:bg-[rgba(255,255,255,0.05)] hover:shadow-[inset_0_0_0_1px_var(--border)]'
                          }`}
                        >
                          <td
                            className={`sticky left-0 z-10 w-10 px-2 py-2.5 transition-colors ${
                              selectedIds.has(t.id)
                                ? 'bg-[rgba(0,200,150,0.06)] group-hover:bg-[rgba(0,200,150,0.09)]'
                                : 'bg-transparent group-hover:bg-[rgba(255,255,255,0.05)]'
                            }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={selectedIds.has(t.id)}
                              onCheckedChange={() => toggleSelect(t.id)}
                            />
                          </td>
                          {visibleColumns.map((col) => {
                            const baseClass = `px-4 py-2.5 ${col.id === 'symbol' ? 'text-left' : 'text-right'}`;
                            let content: React.ReactNode = '—';
                            switch (col.id) {
                              case 'symbol':
                                content = (
                                  <span className="font-mono font-semibold text-text-primary">{t.symbol}</span>
                                );
                                break;
                              case 'direction':
                                content = (
                                  <span className="inline-flex items-center justify-end gap-1.5 font-mono text-text-primary">
                                    {t.direction === 'long' ? (
                                      <>
                                        <TrendingUp className="h-4 w-4 text-profit" />
                                        <span>Long</span>
                                      </>
                                    ) : (
                                      <>
                                        <TrendingDown className="h-4 w-4 text-loss" />
                                        <span>Short</span>
                                      </>
                                    )}
                                  </span>
                                );
                                break;
                              case 'entryPrice':
                                content = <span className="font-mono text-text-primary">{t.entryPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>;
                                break;
                              case 'exitPrice':
                                content = (
                                  <span className="font-mono text-text-primary">
                                    {t.exitPrice != null ? t.exitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
                                  </span>
                                );
                                break;
                              case 'quantity':
                                content = <span className="font-mono text-text-primary">{t.quantity}</span>;
                                break;
                              case 'pnl':
                                content =
                                  t.pnl != null ? (
                                    <span className={`font-mono ${t.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                      {t.pnl >= 0 ? '' : '−'}
                                      {formatCurrencyWhole(Math.abs(t.pnl))}
                                    </span>
                                  ) : (
                                    '—'
                                  );
                                break;
                              case 'pnlPct':
                                if (t.pnl != null && t.entryPrice && t.quantity) {
                                  const positionValue = Number(t.entryPrice) * t.quantity;
                                  if (positionValue > 0) {
                                    const pct = (t.pnl / positionValue) * 100;
                                    content = (
                                      <span className={`font-mono ${pct >= 0 ? 'text-profit' : 'text-loss'}`}>
                                        {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                                      </span>
                                    );
                                  }
                                }
                                break;
                              case 'portfolioPct':
                                if (t.pnl != null && portfolioAmount != null && portfolioAmount > 0) {
                                  content = (
                                    <span className={`font-mono ${t.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                                      {t.pnl >= 0 ? '+' : ''}{((t.pnl / portfolioAmount) * 100).toFixed(2)}%
                                    </span>
                                  );
                                }
                                break;
                              case 'riskReward':
                                content = (
                                  <span className="font-mono text-text-primary">
                                    {t.riskReward != null && t.riskReward > 0 ? t.riskReward.toFixed(2) : '—'}
                                  </span>
                                );
                                break;
                              case 'setupType':
                                content = (
                                  <span className="text-text-secondary truncate max-w-[80px] block">
                                    {t.setupType && t.setupType.trim() ? t.setupType : '—'}
                                  </span>
                                );
                                break;
                              case 'daysHold':
                                content = (
                                  <span className="font-mono text-text-primary">
                                    {t.exitDate
                                      ? Math.round(
                                          (new Date(t.exitDate).getTime() - new Date(t.entryDate).getTime()) / (1000 * 60 * 60 * 24)
                                        )
                                      : '—'}
                                  </span>
                                );
                                break;
                              case 'entryDate':
                                content = <span className="font-mono text-text-primary whitespace-nowrap">{formatDateShort(t.entryDate)}</span>;
                                break;
                              case 'exitDate':
                                content = <span className="font-mono text-text-primary whitespace-nowrap">{formatDateShort(t.exitDate)}</span>;
                                break;
                              case 'outcome':
                                content = <Badge variant={outcomeVariant(t.outcome)}>{t.outcome ?? 'open'}</Badge>;
                                break;
                              default:
                                break;
                            }
                            return (
                              <td key={col.id} className={baseClass}>
                                {content}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <nav
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-elevated/50 px-4 py-3"
                aria-label="Trade log pagination"
              >
                <p className="text-sm text-text-secondary">
                  Showing <span className="font-mono font-medium text-text-primary">{start}–{end}</span> of{' '}
                  <span className="font-mono font-medium text-text-primary">{total}</span> trades
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => setParam('page', '1')}
                      disabled={page <= 1}
                      aria-label="First page"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-text-muted transition-colors hover:bg-elevated hover:text-text-primary disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setParam('page', String(page - 1))}
                      disabled={page <= 1}
                      aria-label="Previous page"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-text-muted transition-colors hover:bg-elevated hover:text-text-primary disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="mx-1 h-6 w-px bg-border" aria-hidden />
                    {(() => {
                      const nums = new Set<number>([1, totalPages, page, page - 1, page + 1]);
                      const sorted = Array.from(nums).filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
                      const withEllipsis: (number | 'ellipsis')[] = [];
                      for (let i = 0; i < sorted.length; i++) {
                        if (i > 0 && sorted[i]! - sorted[i - 1]! > 1) withEllipsis.push('ellipsis');
                        withEllipsis.push(sorted[i]!);
                      }
                      return withEllipsis.map((item, i) =>
                        item === 'ellipsis' ? (
                          <span key={`e-${i}`} className="flex h-9 w-9 items-center justify-center text-text-muted" aria-hidden>
                            …
                          </span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setParam('page', String(item))}
                            aria-label={item === page ? `Current page, ${item}` : `Go to page ${item}`}
                            aria-current={item === page ? 'page' : undefined}
                            className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors ${
                              item === page
                                ? 'border-accent bg-accent/15 text-accent'
                                : 'border-transparent text-text-secondary hover:bg-elevated hover:text-text-primary'
                            }`}
                          >
                            {item}
                          </button>
                        )
                      );
                    })()}
                    <span className="mx-1 h-6 w-px bg-border" aria-hidden />
                    <button
                      type="button"
                      onClick={() => setParam('page', String(page + 1))}
                      disabled={page >= totalPages}
                      aria-label="Next page"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-text-muted transition-colors hover:bg-elevated hover:text-text-primary disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setParam('page', String(totalPages))}
                      disabled={page >= totalPages}
                      aria-label="Last page"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-text-muted transition-colors hover:bg-elevated hover:text-text-primary disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </nav>
            </>
          )}
        </div>
      </div>
    </>
  );
}
