import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-lg border border-border border-dashed bg-surface/50 py-12 px-6 text-center ${className}`}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-text-muted mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      {description && <p className="mt-1 text-sm text-text-secondary max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="primary" size="md" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
