import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { get, put, del } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TradeForm, type TradeFormValues } from '@/components/trades/TradeForm';
import { SETUP_TYPE_OPTIONS, SECTOR_OPTIONS } from '@/components/trades/constants';
import { ErrorCard } from '@/components/ui/ErrorCard';
import type { Trade } from '@/types/trade';
import toast from 'react-hot-toast';

type ApiTradeResponse = { success: boolean; data?: Trade };

function roundPct(value: number): number {
  return Math.round(value * 100) / 100;
}

function targetPctFromPrice(
  entryPrice: number,
  target: number,
  direction: 'long' | 'short'
): number {
  if (entryPrice <= 0) return 0;
  if (direction === 'long') return roundPct((target / entryPrice - 1) * 100);
  return roundPct((1 - target / entryPrice) * 100);
}

function tradeToDefaultValues(t: Trade): Partial<TradeFormValues> {
  const entryPrice = Number(t.entryPrice);
  const targetPct = targetPctFromPrice(
    entryPrice,
    Number(t.target),
    t.direction as 'long' | 'short'
  );
  const setupRaw = (t.setupType || '').trim();
  const sectorRaw = (t.sector || '').trim();
  const isSetupUnknown = !setupRaw || setupRaw === 'Unknown';
  const isSectorUnknown = !sectorRaw || sectorRaw === 'Unknown';
  const setupInList = !isSetupUnknown && (SETUP_TYPE_OPTIONS as readonly string[]).includes(setupRaw);
  const sectorInList = !isSectorUnknown && (SECTOR_OPTIONS as readonly string[]).includes(sectorRaw);
  return {
    symbol: t.symbol,
    direction: t.direction as 'long' | 'short',
    quantity: t.quantity,
    entryDate: t.entryDate.slice(0, 10),
    entryPrice,
    stopLoss: Number(t.stopLoss),
    targetPct,
    exitPrice: t.exitPrice != null ? String(t.exitPrice) : '',
    exitDate: t.exitDate ? t.exitDate.slice(0, 10) : '',
    setupType: isSetupUnknown ? '' : setupInList ? setupRaw : 'Other',
    setupTypeOther: isSetupUnknown || setupInList ? '' : setupRaw,
    sector: isSectorUnknown ? '' : sectorInList ? sectorRaw : 'Other',
    sectorOther: isSectorUnknown || sectorInList ? '' : sectorRaw,
    notes: t.notes || '',
    screenshotUrl: t.screenshotUrl ?? null,
    marketPulse: t.marketPulse ?? null,
    executionErrors: t.executionErrors ?? [],
    exitReason: t.exitReason ?? null,
    executionGrade: t.executionGrade ?? null,
  };
}

function targetFromPct(entryPrice: number, targetPct: number, direction: 'long' | 'short'): number {
  if (direction === 'long') return entryPrice * (1 + targetPct / 100);
  return entryPrice * (1 - targetPct / 100);
}

function buildPayload(data: TradeFormValues) {
  const hasExit = data.exitPrice !== undefined && data.exitPrice !== '' && Number(data.exitPrice) > 0;
  const exitPrice = hasExit ? Number(data.exitPrice) : null;
  const exitDate = data.exitDate?.trim() ? data.exitDate.trim() : null;
  const entryPrice = Number(data.entryPrice);
  const stopLoss = Number(data.stopLoss);
  const targetPct = Number(data.targetPct ?? 0);
  const target = targetFromPct(entryPrice, targetPct, data.direction);
  return {
    symbol: data.symbol.trim().toUpperCase(),
    direction: data.direction,
    entryPrice,
    quantity: Number(data.quantity),
    entryDate: data.entryDate,
    stopLoss,
    target,
    exitPrice,
    exitDate,
    ...(data.setupType?.trim() && {
      setupType: data.setupType === 'Other' ? (data.setupTypeOther?.trim() || 'Other') : data.setupType.trim(),
    }),
    ...(data.sector?.trim() && {
      sector: data.sector === 'Other' ? (data.sectorOther?.trim() || 'Other') : data.sector.trim(),
    }),
    ...(data.notes?.trim() && { notes: data.notes.trim() }),
    ...(data.screenshotUrl != null && data.screenshotUrl !== '' && { screenshotUrl: data.screenshotUrl.trim() }),
    ...(data.marketPulse?.trim() && { marketPulse: data.marketPulse.trim() }),
    executionErrors: Array.isArray(data.executionErrors) ? data.executionErrors : [],
    exitReason: data.exitReason?.trim() || null,
    executionGrade: data.executionGrade?.trim() || null,
  };
}

export function EditTradePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: trade, isLoading, error, refetch } = useQuery({
    queryKey: ['trade', id],
    queryFn: async () => {
      const res = await get<ApiTradeResponse>(`/api/trades/${id}`);
      if (!res?.success || !res.data) throw new Error('Trade not found');
      return res.data;
    },
    enabled: !!id,
  });

  async function onSubmit(data: TradeFormValues) {
    if (!id) return;
    setIsSubmitting(true);
    try {
      const res = await put<{ success: boolean }>(`/api/trades/${id}`, buildPayload(data));
      if (!res?.success) throw new Error('Failed to save');
      toast.success('Trade saved!');
      queryClient.invalidateQueries({ queryKey: ['trade', id] });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      navigate('/trades');
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : null;
      toast.error(msg ?? 'Failed to save trade.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setIsDeleting(true);
    try {
      await del(`/api/trades/${id}`);
      toast.success('Trade deleted.');
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      setDeleteConfirmOpen(false);
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
        <PageHeader title="Edit Trade" />
        <div className="flex-1 overflow-auto p-6">
          <p className="text-loss">Invalid trade ID.</p>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title="Edit Trade" />
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-4xl">
            <Card>
              <CardBody>
                <div className="animate-pulse space-y-4">
                  <div className="h-10 rounded bg-elevated w-1/3" />
                  <div className="grid grid-cols-2 gap-4">
                    {[...Array(8)].map((i) => (
                      <div key={i} className="h-10 rounded bg-elevated" />
                    ))}
                  </div>
                  <div className="h-24 rounded bg-elevated" />
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </>
    );
  }

  if (error || !trade) {
    return (
      <>
        <PageHeader title="Edit Trade" />
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-md">
            <ErrorCard
              title="Failed to load trade"
              message="We couldn't load this trade. Try again or go back to the log."
              onRetry={() => refetch()}
            />
            <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={() => navigate('/trades')}>
              Back to Trade Log
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Edit Trade" />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <Card>
            <CardBody>
              <TradeForm
                defaultValues={tradeToDefaultValues(trade)}
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
                submitLabel="Save Trade"
              />
            </CardBody>
          </Card>

          <Card className="border-loss/20">
            <CardBody>
              <Button
                variant="danger"
                size="md"
                className="w-full"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={isDeleting}
              >
                Delete Trade
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-base/80 p-4">
          <Card className="w-full max-w-sm">
            <CardBody>
              <h3 className="font-semibold text-text-primary">Delete this trade?</h3>
              <p className="mt-1 text-sm text-text-secondary">
                This cannot be undone. The trade will be permanently removed.
              </p>
              <div className="mt-4 flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmOpen(false)} disabled={isDeleting}>
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
