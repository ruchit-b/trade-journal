import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parse } from 'date-fns';
import DatePicker from 'react-datepicker';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import 'react-datepicker/dist/react-datepicker.css';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormLabel } from '@/components/ui/FormLabel';
import { formatCurrency } from '@/lib/format';
import { useAuth } from '@/contexts/AuthContext';
import { Check, ChevronRight } from 'lucide-react';
import {
  SETUP_TYPE_OPTIONS,
  MARKET_PULSE_OPTIONS,
  EXECUTION_ERROR_OPTIONS,
  EXIT_REASON_OPTIONS,
  EXECUTION_GRADE_OPTIONS,
} from './constants';

const tradeSchema = z
  .object({
    symbol: z.string().min(1, 'Symbol is required').max(20, 'Max 20 characters').transform((s) => s.trim().toUpperCase()),
    direction: z.enum(['long', 'short']).optional().default('long'),
    quantity: z.coerce.number().int().positive('Quantity must be a positive integer'),
    entryDate: z.string().min(1, 'Entry date is required'),
    entryPrice: z.coerce.number().positive('Buy price must be positive'),
    stopLoss: z.coerce.number().positive('Stop loss (₹) is required'),
    targetPct: z.coerce.number().min(0, 'Target % must be 0 or positive').optional().default(0),
    exitPrice: z.union([z.string(), z.number()]).optional(),
    exitDate: z.string().optional(),
    setupType: z.string().optional(),
    setupTypeOther: z.string().max(100).optional(),
    exitReason: z.string().optional().nullable(),
    executionGrade: z.string().optional().nullable(),
    notes: z.string().max(1000, 'Max 1000 characters').optional(),
    marketPulse: z.string().optional().nullable(),
    executionErrors: z.array(z.string()).optional().default([]),
  })
  .refine(
    (data) => {
      const ep = data.entryDate ? new Date(data.entryDate) : null;
      if (!ep) return true;
      return ep <= new Date(new Date().setHours(23, 59, 59, 999));
    },
    { message: 'Entry date cannot be in the future', path: ['entryDate'] }
  )
  .refine(
    (data) => {
      const hasExitPrice = data.exitPrice !== undefined && data.exitPrice !== '' && Number(data.exitPrice) > 0;
      if (!hasExitPrice) return true;
      return !!data.exitDate?.trim();
    },
    { message: 'Exit date is required when exit price is set', path: ['exitDate'] }
  );

export type TradeFormValues = z.infer<typeof tradeSchema>;

function toNum(v: string | number | undefined): number {
  if (v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

/** Derive target price from entry and target % (stop loss is entered as price). */
function targetFromPct(entryPrice: number, targetPct: number, direction: 'long' | 'short'): number {
  if (entryPrice <= 0 || targetPct < 0) return 0;
  if (direction === 'long') return entryPrice * (1 + targetPct / 100);
  return entryPrice * (1 - targetPct / 100);
}

export interface TradeFormProps {
  defaultValues: Partial<TradeFormValues>;
  onSubmit: (data: TradeFormValues) => Promise<void>;
  isSubmitting: boolean;
  submitLabel?: string;
}

export function TradeForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel = 'Save Trade',
}: TradeFormProps) {
  const {
    register,
    control,
    getValues,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<TradeFormValues>({
    resolver: zodResolver(tradeSchema),
    defaultValues: {
      direction: 'long',
      entryDate: defaultValues?.entryDate ?? format(new Date(), 'yyyy-MM-dd'),
      stopLoss: defaultValues?.stopLoss,
      targetPct: defaultValues?.targetPct,
      setupType: '',
      setupTypeOther: '',
      exitReason: defaultValues?.exitReason ?? null,
      executionGrade: defaultValues?.executionGrade ?? null,
      notes: '',
      exitPrice: '',
      exitDate: '',
      marketPulse: defaultValues?.marketPulse ?? null,
      executionErrors: defaultValues?.executionErrors ?? [],
      ...defaultValues,
    },
  });

  const { user } = useAuth();
  const portfolioAmount = user?.portfolioAmount ?? null;
  const direction = watch('direction');
  const entryPrice = toNum(watch('entryPrice'));
  const quantity = toNum(watch('quantity'));
  const stopLoss = toNum(watch('stopLoss'));
  const targetPct = toNum(watch('targetPct'));
  const target = targetFromPct(entryPrice, targetPct, direction);

  const potentialPnl = entryPrice > 0 && quantity > 0
    ? (direction === 'long' ? target - entryPrice : entryPrice - target) * quantity
    : 0;
  const riskPerTrade = entryPrice > 0 && quantity > 0
    ? Math.abs(entryPrice - stopLoss) * quantity
    : 0;
  const portfolioRiskPct = portfolioAmount != null && portfolioAmount > 0 && riskPerTrade > 0
    ? (riskPerTrade / portfolioAmount) * 100
    : null;
  const executionErrors = watch('executionErrors') ?? [];
  const riskDenom = Math.abs(entryPrice - stopLoss);
  const exitPriceVal = toNum(watch('exitPrice'));
  const reward =
    exitPriceVal > 0
      ? direction === 'long'
        ? Math.max(0, exitPriceVal - entryPrice)
        : Math.max(0, entryPrice - exitPriceVal)
      : direction === 'long'
        ? Math.max(0, target - entryPrice)
        : Math.max(0, entryPrice - target);
  const rewardRiskRatio = riskDenom > 0 && entryPrice > 0 ? reward / riskDenom : 0;
  const positionValue = entryPrice * quantity;

  const inputClass =
    'w-full rounded-md border border-border bg-elevated px-3 py-1.5 text-sm font-mono text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Row 1: Symbol, Quantity, Direction */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="min-w-0 w-full">
          <FormLabel required>Symbol</FormLabel>
          <input
            list="nifty-symbols"
            {...register('symbol')}
            onInput={(e) => {
              const t = e.target as HTMLInputElement;
              t.value = t.value.toUpperCase();
            }}
            onChange={(e) => setValue('symbol', e.target.value.trim().toUpperCase(), { shouldValidate: true })}
            className={inputClass}
            placeholder="eg. RELIANCE"
          />
          {errors.symbol && <p className="mt-1 text-sm text-loss">{errors.symbol.message}</p>}
        </div>
        <div className="min-w-0 w-full">
          <FormLabel required>Quantity</FormLabel>
          <input
            type="number"
            min={1}
            {...register('quantity')}
            className={inputClass}
          />
          {errors.quantity && <p className="mt-1 text-sm text-loss">{errors.quantity.message}</p>}
        </div>
        <div className="min-w-0 w-full">
          <FormLabel>Direction</FormLabel>
          <button
            type="button"
            role="switch"
            aria-checked={direction === 'short'}
            aria-label={`Direction: ${direction}. Switch to ${direction === 'long' ? 'Short' : 'Long'}.`}
            onClick={() => setValue('direction', direction === 'long' ? 'short' : 'long', { shouldValidate: true })}
            className="relative flex h-9 w-full max-w-[7rem] items-center rounded-full border border-border bg-elevated px-1 transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
          >
            <span
              className={`absolute left-1 top-1/2 h-7 w-[calc(50%-2px)] -translate-y-1/2 rounded-full transition-all duration-200 ease-out ${direction === 'long' ? 'bg-profit' : 'bg-loss'}`}
              style={{ transform: direction === 'long' ? 'translateY(-50%) translateX(0)' : 'translateY(-50%) translateX(calc(100% + 4px))' }}
              aria-hidden
            />
            <span className={`relative z-10 flex h-full w-1/2 items-center justify-center text-xs font-medium transition-colors ${direction === 'long' ? 'text-white' : 'text-text-muted'}`}>
              Long
            </span>
            <span className={`relative z-10 flex h-full w-1/2 items-center justify-center text-xs font-medium transition-colors ${direction === 'short' ? 'text-white' : 'text-text-muted'}`}>
              Short
            </span>
          </button>
        </div>
      </div>

      {/* Row 2: Buy date, Buy price, Stop loss */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="min-w-0 w-full">
          <FormLabel required>Buy date</FormLabel>
          <Controller
            control={control}
            name="entryDate"
            render={({ field }) => (
              <div className="w-full [&_.react-datepicker-wrapper]:block [&_.react-datepicker-wrapper]:w-full">
                <DatePicker
                  selected={field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : null}
                  onChange={(date: Date | null) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                  onBlur={field.onBlur}
                  dateFormat="dd MMM yyyy"
                  className={inputClass}
                  placeholderText="Select date"
                />
              </div>
            )}
          />
          {errors.entryDate && <p className="mt-1 text-sm text-loss">{errors.entryDate.message}</p>}
        </div>
        <div className="min-w-0 w-full">
          <FormLabel required>Buy price (₹)</FormLabel>
          <input
            type="number"
            step={0.01}
            min={0}
            {...register('entryPrice')}
            className={inputClass}
          />
          {errors.entryPrice && <p className="mt-1 text-sm text-loss">{errors.entryPrice.message}</p>}
        </div>
        <div className="min-w-0 w-full">
          <FormLabel required>Stop loss (₹)</FormLabel>
          <input
            type="number"
            step={0.01}
            min={0}
            {...register('stopLoss')}
            className={inputClass}
            placeholder="e.g. 2450.50"
          />
          {errors.stopLoss && <p className="mt-1 text-sm text-loss">{errors.stopLoss.message}</p>}
        </div>
      </div>

      {/* Row 3: Exit date, Exit price, Target (%) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        <div className="min-w-0 w-full">
          <FormLabel>Exit date</FormLabel>
          <Controller
            control={control}
            name="exitDate"
            render={({ field }) => (
              <div className="w-full [&_.react-datepicker-wrapper]:block [&_.react-datepicker-wrapper]:w-full">
                <DatePicker
                  selected={field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : null}
                  onChange={(date: Date | null) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                  onBlur={field.onBlur}
                  dateFormat="dd MMM yyyy"
                  className={inputClass}
                  placeholderText="Select date"
                />
              </div>
            )}
          />
          {errors.exitDate && <p className="mt-1 text-sm text-loss">{errors.exitDate.message}</p>}
        </div>
        <div className="min-w-0 w-full">
          <FormLabel>Exit price (₹)</FormLabel>
          <input
            type="number"
            step={0.01}
            min={0}
            {...register('exitPrice')}
            placeholder="Leave blank if open"
            className={inputClass}
          />
          {errors.exitPrice && <p className="mt-1 text-sm text-loss">{errors.exitPrice.message}</p>}
        </div>
        <div className="min-w-0 w-full">
          <FormLabel>Target (%)</FormLabel>
          <input
            type="number"
            step={0.01}
            min={0}
            {...register('targetPct')}
            className={inputClass}
            placeholder="e.g. 4"
          />
          {errors.targetPct && <p className="mt-1 text-sm text-loss">{errors.targetPct.message}</p>}
        </div>
      </div>

      {/* More details: collapsible, closed by default */}
      <details className="group rounded-lg border border-border bg-elevated/50">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-text-secondary hover:text-text-primary [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
          <span>More details</span>
        </summary>
        <div className="border-t border-border px-4 py-4">
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-2 lg:space-y-0">
            <div className="space-y-3">
              <div>
                <FormLabel>Execution grade</FormLabel>
                <Controller
                  control={control}
                  name="executionGrade"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(v) => field.onChange(v || null)}
                      onOpenChange={(open) => !open && field.onBlur()}
                    >
                      <SelectTrigger className={inputClass} aria-label="Execution grade">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXECUTION_GRADE_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <FormLabel>Setup type</FormLabel>
                <Controller
                  control={control}
                  name="setupType"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      onValueChange={(v) => field.onChange(v || '')}
                      onOpenChange={(open) => !open && field.onBlur()}
                    >
                      <SelectTrigger className={inputClass} aria-label="Setup type">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {SETUP_TYPE_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {watch('setupType') === 'Other' && (
                  <input
                    type="text"
                    placeholder="Specify setup type"
                    maxLength={100}
                    {...register('setupTypeOther')}
                    className={`${inputClass} mt-2`}
                  />
                )}
              </div>

              <div>
                <FormLabel>Exit reason</FormLabel>
                <Controller
                  control={control}
                  name="exitReason"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(v) => field.onChange(v || null)}
                      onOpenChange={(open) => !open && field.onBlur()}
                    >
                      <SelectTrigger className={inputClass} aria-label="Exit reason">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXIT_REASON_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div>
                <FormLabel>Market environment</FormLabel>
                <Controller
                  control={control}
                  name="marketPulse"
                  render={({ field }) => {
                    const value = field.value ?? null;
                    const options: Array<{ value: string; label: string }> =
                      MARKET_PULSE_OPTIONS.map((s) => ({ value: s, label: s }));
                    return (
                      <div className="flex flex-wrap gap-2">
                        {options.map((opt) => {
                          const selected = value === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                field.onChange(selected ? null : opt.value);
                                field.onBlur();
                              }}
                              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                selected
                                  ? 'border-accent bg-accent-dim text-accent'
                                  : 'border-border bg-elevated text-text-secondary hover:bg-elevated/80 hover:text-text-primary'
                              }`}
                              aria-pressed={selected}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    );
                  }}
                />
              </div>

              <div>
                <FormLabel>Execution errors</FormLabel>
                <p className="mb-1.5 text-xs text-text-muted">Optional: tag mistakes on this trade</p>
                <div className="flex flex-wrap gap-2">
                  {EXECUTION_ERROR_OPTIONS.map((opt) => {
                    const selected = executionErrors.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const current = getValues('executionErrors') ?? [];
                          const next = current.includes(opt)
                            ? current.filter((x) => x !== opt)
                            : [...current, opt];
                          setValue('executionErrors', next, { shouldValidate: true });
                        }}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          selected
                            ? 'border-accent bg-accent-dim text-text-primary'
                            : 'border-border bg-elevated text-text-secondary hover:bg-elevated/80 hover:text-text-primary'
                        }`}
                        aria-pressed={selected}
                      >
                        <span
                          className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${
                            selected ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface text-text-muted'
                          }`}
                          aria-hidden="true"
                        >
                          {selected ? <Check className="h-2.5 w-2.5 stroke-[2.5]" /> : null}
                        </span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <FormLabel>Notes</FormLabel>
                <textarea
                  {...register('notes')}
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                  placeholder="Optional notes..."
                />
                <p className="mt-0.5 text-xs text-text-muted text-right">
                  {(watch('notes') ?? '').length}/1000
                </p>
                {errors.notes && <p className="mt-1 text-sm text-loss">{errors.notes.message}</p>}
              </div>
            </div>
          </div>
        </div>
      </details>

      {/* Live computed preview */}
      <Card>
        <CardBody className="py-3">
          <h3 className="text-sm font-medium text-text-secondary mb-2">Live preview</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs text-text-muted">Potential P&L</p>
              <p className="font-mono text-lg font-semibold text-profit">
                {formatCurrency(potentialPnl)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Risk per trade</p>
              <p className="font-mono text-lg font-semibold text-loss">
                {formatCurrency(riskPerTrade)}
                {portfolioRiskPct != null && (
                  <span className="ml-1 text-sm font-normal text-text-muted">
                    ({portfolioRiskPct.toFixed(2)}% of portfolio)
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Reward:Risk</p>
              <p className="font-mono text-lg font-semibold text-text-primary">
                {rewardRiskRatio > 0 ? `${rewardRiskRatio.toFixed(2)} : 1` : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Position value</p>
              <p className="font-mono text-lg font-semibold text-text-primary">
                {positionValue > 0 ? formatCurrency(positionValue) : '—'}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        loading={isSubmitting}
        disabled={isSubmitting || (Object.keys(defaultValues).length > 0 ? !isDirty : false)}
      >
        {submitLabel}
      </Button>
    </form>
  );
}
