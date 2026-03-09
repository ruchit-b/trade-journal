import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateShort } from '@/lib/format';
import { ErrorCard } from '@/components/ui/ErrorCard';
import { api, get } from '@/lib/api';
import {
  Upload,
  ChevronDown,
  ChevronRight,
  History,
  ArrowLeft,
  Check,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const PREVIEW_TRADES_SHOW = 10;

// --- Types ---
type Step = 1 | 2 | 3;
type Broker = 'zerodha' | 'upstox' | 'generic';

interface ParsedTradePreview {
  symbol: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryDate: string;
  exitDate: string;
  setupType: string;
  sector: string;
  notes: string;
}

interface PreviewData {
  broker: Broker;
  totalRows: number;
  parsedTrades: ParsedTradePreview[];
  skippedRows: number;
  errors: string[];
}

interface ImportHistoryItem {
  id: string;
  broker: string;
  filename: string;
  tradeCount: number;
  importedAt: string;
}

// --- Helpers ---
function estPnl(t: ParsedTradePreview): number | null {
  const mult = t.direction === 'long' ? 1 : -1;
  return (t.exitPrice - t.entryPrice) * t.quantity * mult;
}

function formatPnl(value: number | null): string {
  if (value === null) return '—';
  const n = value;
  if (n > 0) return `+₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  if (n < 0) return `-₹${Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  return '₹0';
}

// --- API ---
async function postPreview(file: File): Promise<PreviewData> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<{ success: boolean; data?: PreviewData }>('/api/import/preview', form, {
    headers: { 'Content-Type': false as unknown as string },
  });
  const body = res?.data;
  if (!body?.success || !body.data) throw new Error('Failed to parse file');
  return body.data;
}

async function postConfirm(file: File): Promise<{ imported: number; skipped: number; importId: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<{ success: boolean; data?: { imported: number; skipped: number; importId: string } }>(
    '/api/import/confirm',
    form,
    { headers: { 'Content-Type': false as unknown as string } }
  );
  const body = res?.data;
  if (!body?.success || !body.data) throw new Error('Failed to import');
  return body.data;
}

async function fetchImportHistory(): Promise<ImportHistoryItem[]> {
  const body = await get<{ success: boolean; data?: ImportHistoryItem[] }>('/api/import/history');
  if (!body?.success || !Array.isArray(body.data)) return [];
  return body.data;
}

// --- Accordion ---
function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-text-primary hover:bg-elevated/50 transition-colors"
      >
        {title}
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
        )}
      </button>
      {open && <div className="border-t border-border px-4 py-3 text-sm text-text-secondary">{children}</div>}
    </div>
  );
}

// --- Checkmark animation (CSS) ---
function DoneCheckmark() {
  return (
    <div className="relative flex items-center justify-center">
      <div
        className="h-20 w-20 rounded-full border-[4px] border-accent flex items-center justify-center animate-[import-check-circle_0.5s_ease-out_forwards] opacity-0"
        style={{ animationDelay: '0.1s' }}
      >
        <Check className="h-10 w-10 text-accent stroke-[3]" strokeWidth={3} />
      </div>
    </div>
  );
}

export function ImportPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; importId: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const { data: history = [], isLoading: historyLoading, error: historyError, refetch: refetchHistory } = useQuery({
    queryKey: ['import-history'],
    queryFn: fetchImportHistory,
  });

  const validateAndSetFile = useCallback((f: File | null) => {
    setFileError(null);
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.csv')) {
      setFileError('Please upload a .csv file.');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setFileError('File is too large. Maximum size is 5 MB.');
      return;
    }
    setFile(f);
    setFileError(null);
  }, []);

  const runPreview = useCallback(async (f: File) => {
    setPreviewError(null);
    setIsLoadingPreview(true);
    try {
      const data = await postPreview(f);
      setPreview(data);
      setStep(2);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = ax?.response?.data?.error ?? ax?.message ?? 'Failed to parse file.';
      if (String(msg).toLowerCase().includes('detect')) {
        setPreviewError(
          "We couldn't detect your broker. Make sure you're uploading an unmodified CSV export from Zerodha or Upstox."
        );
      } else {
        setPreviewError(msg);
      }
      toast.error(msg);
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      validateAndSetFile(f);
      const valid = f.name.toLowerCase().endsWith('.csv') && f.size <= MAX_FILE_SIZE;
      if (valid) runPreview(f);
    },
    [validateAndSetFile, runPreview]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
      e.target.value = '';
    },
    [handleFile]
  );

  const handleReupload = useCallback(() => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setPreviewError(null);
    setFileError(null);
    setImportResult(null);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!file || !preview?.parsedTrades?.length) return;
    setIsConfirming(true);
    try {
      const result = await postConfirm(file);
      setImportResult({ imported: result.imported, importId: result.importId });
      setStep(3);
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
      toast.success(`Imported ${result.imported} trades.`);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(ax?.response?.data?.error ?? ax?.message ?? 'Import failed.');
    } finally {
      setIsConfirming(false);
    }
  }, [file, preview, queryClient]);

  const brokerBadgeClass: Record<Broker, string> = {
    zerodha: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    upstox: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    generic: 'bg-text-muted/15 text-text-muted border-border-subtle',
  };

  return (
    <>
      <style>{`
        @keyframes import-check-circle {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <PageHeader title="Import" subtitle="Import trades from Zerodha or Upstox CSV" />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Step progress */}
          <div className="flex items-center justify-center gap-2 text-sm">
            <span
              className={
                step >= 1 ? 'text-accent font-medium' : 'text-text-muted'
              }
            >
              Upload
            </span>
            <span className="text-border">→</span>
            <span
              className={
                step >= 2 ? 'text-accent font-medium' : 'text-text-muted'
              }
            >
              Preview
            </span>
            <span className="text-border">→</span>
            <span
              className={
                step >= 3 ? 'text-accent font-medium' : 'text-text-muted'
              }
            >
              Done
            </span>
          </div>

          {/* Step 1: Upload */}
          {step === 1 && (
            <>
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`
                  relative rounded-xl border-2 border-dashed transition-all duration-200
                  ${isDragging
                    ? 'border-accent bg-accent/10 scale-[1.01]'
                    : 'border-border bg-elevated/50 hover:border-border-subtle hover:bg-elevated/80 hover:scale-[1.005]'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={onFileInputChange}
                />
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  {isLoadingPreview ? (
                    <>
                      <Spinner size="lg" className="mb-4" />
                      <p className="text-text-primary font-medium">Parsing CSV…</p>
                    </>
                  ) : (
                    <>
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-elevated text-text-muted">
                        <Upload className="h-7 w-7" />
                      </div>
                      <p className="text-text-primary font-medium">
                        Drop your Zerodha or Upstox CSV here
                      </p>
                      <button
                        type="button"
                        onClick={onBrowse}
                        className="mt-2 text-sm text-accent hover:underline"
                      >
                        or click to browse
                      </button>
                      <p className="mt-3 text-xs text-text-muted">.csv only · max 5 MB</p>
                    </>
                  )}
                </div>
              </div>
              {fileError && (
                <p className="text-sm text-loss flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {fileError}
                </p>
              )}
              {previewError && (
                <p className="text-sm text-loss flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {previewError}
                </p>
              )}

              <div className="space-y-3">
                <Accordion title="How to export from Zerodha">
                  Kite → Console → Reports → Tradebook → Select date range → Download CSV
                </Accordion>
                <Accordion title="How to export from Upstox">
                  Upstox → Reports → Trade History → Export
                </Accordion>
              </div>
            </>
          )}

          {/* Step 2: Preview */}
          {step === 2 && preview && (
            <Card>
              <CardBody className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm text-text-secondary">Detected:</span>
                  <span
                    className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium capitalize ${brokerBadgeClass[preview.broker]}`}
                  >
                    {preview.broker}
                  </span>
                </div>
                <p className="text-sm text-text-secondary">
                  {preview.parsedTrades.length} trades parsed · {preview.skippedRows} rows skipped
                  {preview.errors.length > 0 ? ` · ${preview.errors.length} errors` : ''}
                </p>

                {preview.errors.length > 0 && (
                  <ErrorsList errors={preview.errors} />
                )}

                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-elevated/50">
                        <th className="px-3 py-2.5 text-left font-medium text-text-primary">Symbol</th>
                        <th className="px-3 py-2.5 text-left font-medium text-text-primary">Direction</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-primary">Entry</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-primary">Exit</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-primary">Qty</th>
                        <th className="px-3 py-2.5 text-left font-medium text-text-primary">Entry Date</th>
                        <th className="px-3 py-2.5 text-left font-medium text-text-primary">Exit Date</th>
                        <th className="px-3 py-2.5 text-right font-medium text-text-primary">Est. P&L</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.parsedTrades.slice(0, PREVIEW_TRADES_SHOW).map((t, i) => {
                        const pnl = estPnl(t);
                        return (
                          <tr key={i} className="border-b border-border-subtle">
                            <td className="px-3 py-2 text-text-primary font-mono">{t.symbol}</td>
                            <td className="px-3 py-2 text-text-secondary capitalize">{t.direction}</td>
                            <td className="px-3 py-2 text-right text-text-primary">
                              ₹{t.entryPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 text-right text-text-primary">
                              ₹{t.exitPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-3 py-2 text-right text-text-primary">{t.quantity}</td>
                            <td className="px-3 py-2 text-text-secondary">{formatDateShort(t.entryDate)}</td>
                            <td className="px-3 py-2 text-text-secondary">{formatDateShort(t.exitDate)}</td>
                            <td className="px-3 py-2 text-right">
                              {pnl === null ? (
                                <span className="text-warning">Open trade</span>
                              ) : (
                                <span className={pnl >= 0 ? 'text-profit' : 'text-loss'}>
                                  {formatPnl(pnl)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {preview.parsedTrades.length > PREVIEW_TRADES_SHOW && (
                  <p className="text-sm text-text-muted">
                    {preview.parsedTrades.length - PREVIEW_TRADES_SHOW} more trades not shown
                  </p>
                )}
                <p className="text-sm text-text-muted">
                  Stop Loss and Target will be empty — you can add them later from the trade detail page.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button variant="ghost" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={handleReupload}>
                    Re-upload
                  </Button>
                  <Button
                    variant="primary"
                    loading={isConfirming}
                    onClick={handleConfirm}
                  >
                    Import {preview.parsedTrades.length} Trades →
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Step 3: Done */}
          {step === 3 && importResult && (
            <Card>
              <CardBody className="flex flex-col items-center py-12 text-center">
                <DoneCheckmark />
                <h3 className="mt-6 text-lg font-semibold text-text-primary">
                  Successfully imported {importResult.imported} trades!
                </h3>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button
                    variant="primary"
                    onClick={() => navigate('/trades')}
                  >
                    View Trade Log
                  </Button>
                  <Button variant="ghost" onClick={handleReupload}>
                    Import Another File
                  </Button>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Import History */}
          <section>
            <Card>
              <CardHeader
                title="Import History"
                subtitle="Past CSV imports"
              />
              {historyLoading ? (
                <CardBody className="py-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 rounded bg-elevated w-3/4" />
                    <div className="h-10 rounded bg-elevated" />
                    <div className="h-10 rounded bg-elevated" />
                    <div className="h-10 rounded bg-elevated" />
                  </div>
                </CardBody>
              ) : historyError ? (
                <CardBody>
                  <ErrorCard
                    title="Failed to load import history"
                    message="We couldn't load your past imports. Try again."
                    onRetry={() => refetchHistory()}
                  />
                </CardBody>
              ) : history.length === 0 ? (
                <CardBody>
                  <EmptyState
                    icon={History}
                    title="No imports yet"
                    description="Your CSV import history will appear here."
                  />
                </CardBody>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-elevated/50">
                        <th className="px-5 py-3 text-left font-medium text-text-primary">Date</th>
                        <th className="px-5 py-3 text-left font-medium text-text-primary">Broker</th>
                        <th className="px-5 py-3 text-left font-medium text-text-primary">File Name</th>
                        <th className="px-5 py-3 text-right font-medium text-text-primary">Trades Imported</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => (
                        <tr key={h.id} className="border-b border-border-subtle">
                          <td className="px-5 py-2.5 text-text-secondary">{formatDateShort(h.importedAt)}</td>
                          <td className="px-5 py-2.5 text-text-primary capitalize">{h.broker}</td>
                          <td className="px-5 py-2.5 text-text-primary truncate max-w-[200px]" title={h.filename}>
                            {h.filename}
                          </td>
                          <td className="px-5 py-2.5 text-right text-text-primary">{h.tradeCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}

function ErrorsList({ errors }: { errors: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const show = expanded ? errors : errors.slice(0, 5);
  const hasMore = errors.length > 5;
  return (
    <div className="rounded-lg border border-loss/30 bg-loss/5 p-3">
      <p className="text-sm font-medium text-loss mb-2">Errors</p>
      <ul className="list-disc list-inside text-sm text-text-secondary space-y-1">
        {show.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 text-sm text-accent hover:underline"
        >
          {expanded ? 'Show less' : `Show more (${errors.length - 5} more)`}
        </button>
      )}
    </div>
  );
}
