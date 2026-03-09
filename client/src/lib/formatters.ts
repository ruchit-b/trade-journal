/**
 * Re-export from format.ts for backward compatibility.
 * Prefer importing from '@/lib/format' for new code.
 */
import {
  formatCurrency,
  formatCurrencyWhole,
  formatPercent,
  formatDateShort,
  formatDate,
  formatRatio,
} from './format';

export { formatCurrency, formatCurrencyWhole, formatPercent, formatDate, formatDateShort, formatRatio };

/** @deprecated Use formatCurrencyWhole from '@/lib/format' */
export const formatInr = formatCurrencyWhole;

/** @deprecated Use formatCurrency from '@/lib/format' */
export const formatInrDecimal = formatCurrency;

/** @deprecated Use formatPercent from '@/lib/format' */
export const formatPct = formatPercent;

/** @deprecated Use formatDateShort from '@/lib/format' */
export const formatShortDate = formatDateShort;
