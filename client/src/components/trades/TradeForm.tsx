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
import { Check } from 'lucide-react';
import {
  SETUP_TYPE_OPTIONS,
  SECTOR_OPTIONS,
  MARKET_PULSE_OPTIONS,
  EXECUTION_ERROR_OPTIONS,
  EXIT_REASON_OPTIONS,
  EXECUTION_GRADE_OPTIONS,
} from './constants';
import { ScreenshotUpload } from './ScreenshotUpload';

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
    sector: z.string().optional(),
    sectorOther: z.string().max(100).optional(),
    exitReason: z.string().optional().nullable(),
    executionGrade: z.string().optional().nullable(),
    notes: z.string().max(1000, 'Max 1000 characters').optional(),
    screenshotUrl: z.string().max(2000).optional().nullable(),
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
      sector: '',
      sectorOther: '',
      exitReason: defaultValues?.exitReason ?? null,
      executionGrade: defaultValues?.executionGrade ?? null,
      notes: '',
      exitPrice: '',
      exitDate: '',
      screenshotUrl: null as string | null,
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
    'w-full rounded-md border border-border bg-elevated px-3 py-2 font-mono text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column */}
        <div className="space-y-4">
          <div>
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
            {/* <datalist id="nifty-symbols">
              {NIFTY_50_SYMBOLS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist> */}
            {errors.symbol && <p className="mt-1 text-sm text-loss">{errors.symbol.message}</p>}
          </div>

          <div>
            {/* <FormLabel required>Direction</FormLabel> */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setValue('direction', direction === 'long' ? 'short' : 'long', { shouldValidate: true })}
                className="flex h-10 w-28 flex-shrink-0 overflow-hidden rounded-full border border-border bg-elevated"
                aria-label={`Direction: ${direction}. Click to switch to ${direction === 'long' ? 'Short' : 'Long'}.`}
              >
                <span
                  className={`inline-flex h-full w-1/2 items-center justify-center text-xs font-medium transition-colors ${
                    direction === 'long' ? 'bg-profit text-white' : 'bg-elevated text-text-muted'
                  }`}
                >
                  Long
                </span>
                <span
                  className={`inline-flex h-full w-1/2 items-center justify-center text-xs font-medium transition-colors ${
                    direction === 'short' ? 'bg-loss text-white' : 'bg-elevated text-text-muted'
                  }`}
                >
                  Short
                </span>
              </button>
              {/* <span className="text-xs font-medium text-text-secondary">
                {direction === 'long' ? 'Long' : 'Short'}
              </span> */}
            </div>
          </div>

          <div>
            <FormLabel required>Quantity</FormLabel>
            <input
              type="number"
              min={1}
              {...register('quantity')}
              className={inputClass}
            />
            {errors.quantity && <p className="mt-1 text-sm text-loss">{errors.quantity.message}</p>}
          </div>

          <div>
            <FormLabel required>Entry date</FormLabel>
            <Controller
              control={control}
              name="entryDate"
              render={({ field }) => (
                <DatePicker
                  selected={field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : null}
                  onChange={(date: Date | null) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                  onBlur={field.onBlur}
                  dateFormat="dd MMM yyyy"
                  className={inputClass}
                  placeholderText="Select date"
                />
              )}
            />
            {errors.entryDate && <p className="mt-1 text-sm text-loss">{errors.entryDate.message}</p>}
          </div>

          <div>
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

          <div>
            <FormLabel required>Stop loss (₹)</FormLabel>
            <input
              type="number"
              step={0.01}
              min={0}
              {...register('stopLoss')}
              className={inputClass}
              placeholder="e.g. 2450.50"
            />
            <p className="mt-1 text-xs text-text-muted">Absolute price; can be above entry for trailing stops.</p>
            {errors.stopLoss && <p className="mt-1 text-sm text-loss">{errors.stopLoss.message}</p>}
          </div>

          <div>
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

        {/* Right column */}
        <div className="space-y-4">
          <div>
            <FormLabel>Sell price (₹)</FormLabel>
            <input
              type="number"
              step={0.01}
              min={0}
              {...register('exitPrice')}
              placeholder="Leave blank if trade is open"
              className={inputClass}
            />
            {errors.exitPrice && <p className="mt-1 text-sm text-loss">{errors.exitPrice.message}</p>}
          </div>

          <div>
            <FormLabel>Exit date</FormLabel>
            <Controller
              control={control}
              name="exitDate"
              render={({ field }) => (
                <DatePicker
                  selected={field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : null}
                  onChange={(date: Date | null) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                  onBlur={field.onBlur}
                  dateFormat="dd MMM yyyy"
                  className={inputClass}
                  placeholderText="Select date"
                />
              )}
            />
            {errors.exitDate && <p className="mt-1 text-sm text-loss">{errors.exitDate.message}</p>}
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
            <FormLabel>Sector</FormLabel>
            <Controller
              control={control}
              name="sector"
              render={({ field }) => (
                <Select
                  value={field.value || undefined}
                  onValueChange={(v) => field.onChange(v || '')}
                  onOpenChange={(open) => !open && field.onBlur()}
                >
                  <SelectTrigger className={inputClass} aria-label="Sector">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTOR_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {watch('sector') === 'Other' && (
              <input
                type="text"
                placeholder="Specify sector"
                maxLength={100}
                {...register('sectorOther')}
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
            <p className="mb-2 text-xs text-text-muted">Optional: tag mistakes made on this trade</p>
            <div className="flex flex-wrap gap-2">
              {EXECUTION_ERROR_OPTIONS.map((opt) => (
                (() => {
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
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
                        selected
                          ? 'border-accent bg-accent-dim text-text-primary'
                          : 'border-border bg-elevated text-text-secondary hover:bg-elevated/80 hover:text-text-primary'
                      }`}
                      aria-pressed={selected}
                    >
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border ${
                          selected ? 'border-accent bg-accent text-[#0a0a0f]' : 'border-border bg-surface text-text-muted'
                        }`}
                        aria-hidden="true"
                      >
                        {selected ? <Check className="h-3 w-3 stroke-[2.5]" /> : null}
                      </span>
                      <span className="text-sm">{opt}</span>
                    </button>
                  );
                })()
              ))}
            </div>
          </div>

          <div>
            <FormLabel>Notes</FormLabel>
            <textarea
              {...register('notes')}
              rows={4}
              maxLength={1000}
              className="w-full rounded-md border border-border bg-elevated px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent resize-y"
              placeholder="Optional notes..."
            />
            <p className="mt-1 text-xs text-text-muted text-right">
              {(watch('notes') ?? '').length}/1000
            </p>
            {errors.notes && <p className="mt-1 text-sm text-loss">{errors.notes.message}</p>}
          </div>

          <div>
            <FormLabel>Chart screenshot</FormLabel>
            <ScreenshotUpload
              screenshotUrl={watch('screenshotUrl') ?? null}
              onUpload={(url) => setValue('screenshotUrl', url, { shouldValidate: true })}
              onRemove={() => setValue('screenshotUrl', null, { shouldValidate: true })}
            />
          </div>
        </div>
      </div>

      {/* Live computed preview */}
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-text-secondary mb-3">Live preview</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
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
