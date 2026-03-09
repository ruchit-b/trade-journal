import { Button } from './Button';
import { AlertCircle } from 'lucide-react';

interface ErrorCardProps {
  message?: string;
  onRetry?: () => void;
  title?: string;
}

export function ErrorCard({
  message = 'Something went wrong.',
  onRetry,
  title = 'Failed to load',
}: ErrorCardProps) {
  return (
    <div className="rounded-lg border border-loss/30 bg-loss/5 p-6 flex flex-col items-center justify-center text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-loss/15 text-loss mb-3">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary max-w-sm">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
