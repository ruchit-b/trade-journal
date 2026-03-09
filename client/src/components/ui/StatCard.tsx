import { memo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  change?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

function StatCardInner({ label, value, subtitle, change, className = '' }: StatCardProps) {
  return (
    <div className={`rounded-lg border border-border bg-surface px-5 py-4 ${className}`}>
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-text-primary">{value}</p>
      {(subtitle != null && subtitle !== '') && (
        <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>
      )}
      {change != null && (
        <div className="mt-2 flex items-center gap-1">
          {change.isPositive ? (
            <TrendingUp className="h-4 w-4 text-profit" />
          ) : (
            <TrendingDown className="h-4 w-4 text-loss" />
          )}
          <span className={change.isPositive ? 'text-profit text-sm font-medium' : 'text-loss text-sm font-medium'}>
            {change.isPositive ? '+' : ''}{change.value}%
          </span>
        </div>
      )}
    </div>
  );
}
export const StatCard = memo(StatCardInner);
