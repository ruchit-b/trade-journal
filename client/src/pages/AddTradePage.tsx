import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post } from '@/lib/api';
import { PageHeader } from '@/components/layout/AppShell';
import { Card, CardBody } from '@/components/ui/Card';
import { TradeForm, type TradeFormValues } from '@/components/trades/TradeForm';
import toast from 'react-hot-toast';

const TRADES_URL = '/api/trades';

function targetFromPct(entryPrice: number, targetPct: number, direction: 'long' | 'short'): number {
  if (direction === 'long') return entryPrice * (1 + targetPct / 100);
  return entryPrice * (1 - targetPct / 100);
}

function buildPayload(data: TradeFormValues) {
  const exitPrice = data.exitPrice !== undefined && data.exitPrice !== '' ? Number(data.exitPrice) : undefined;
  const exitDate = data.exitDate?.trim() || undefined;
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
    ...(exitPrice != null && exitPrice > 0 && { exitPrice }),
    ...(exitDate && { exitDate }),
    ...(data.setupType?.trim() && {
      setupType: data.setupType === 'Other' ? (data.setupTypeOther?.trim() || 'Other') : data.setupType.trim(),
    }),
    ...(data.notes?.trim() && { notes: data.notes.trim() }),
    ...(data.marketPulse?.trim() && { marketPulse: data.marketPulse.trim() }),
    ...(Array.isArray(data.executionErrors) && data.executionErrors.length > 0 && { executionErrors: data.executionErrors }),
    ...(data.exitReason?.trim() && { exitReason: data.exitReason.trim() }),
    ...(data.executionGrade?.trim() && { executionGrade: data.executionGrade.trim() }),
  };
}

export function AddTradePage() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function onSubmit(data: TradeFormValues) {
    setIsSubmitting(true);
    try {
      const res = await post<{ success: boolean }>(TRADES_URL, buildPayload(data));
      if (!res?.success) throw new Error('Failed to save');
      toast.success('Trade saved!');
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

  return (
    <>
      <PageHeader title="Add Trade" />
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl">
          <Card>
            <CardBody>
              <TradeForm
                defaultValues={{}}
                onSubmit={onSubmit}
                isSubmitting={isSubmitting}
                submitLabel="Save Trade"
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
