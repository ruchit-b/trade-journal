/**
 * Indian number and date formatting utilities.
 * Use these consistently across the app.
 */

/** ₹1,23,456.78 (Indian system, 2 decimals) */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** ₹1,23,456 (no decimals) */
export function formatCurrencyWhole(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(value);
}

/** 45.3% */
export function formatPercent(value: number, decimals = 1): string {
  return `${Number(value).toFixed(decimals)}%`;
}

/** 2.34 (ratio, e.g. risk:reward) */
export function formatRatio(value: number, decimals = 2): string {
  return Number(value).toFixed(decimals);
}

/** 12 Mar 2025 */
export function formatDate(date: string | Date | null | undefined): string {
  if (date == null) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** 12 Mar 25 */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (date == null) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}
