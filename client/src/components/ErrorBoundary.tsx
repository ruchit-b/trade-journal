import { Component, ErrorInfo, ReactNode } from 'react';
import { config } from '@/lib/config';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Candlestick going down with red X - SVG illustration */
function ErrorIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Red candle (down) */}
      <g stroke="var(--loss)" strokeWidth="1.5" strokeLinecap="round">
        <line x1="40" y1="15" x2="40" y2="28" />
        <rect x="36" y="42" width="8" height="26" rx="1" fill="var(--loss)" />
        <line x1="40" y1="68" x2="40" y2="72" />
      </g>
      {/* Red X overlay */}
      <g stroke="var(--loss)" strokeWidth="3" strokeLinecap="round">
        <line x1="72" y1="18" x2="108" y2="54" />
        <line x1="108" y1="18" x2="72" y2="54" />
      </g>
    </svg>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (config.isProd) return;
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const { error } = this.state;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-base p-6">
        <ErrorIllustration className="h-24 w-auto mb-6 opacity-90" />
        <h1 className="text-xl font-semibold text-text-primary text-center">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-text-secondary text-center max-w-sm">
          We hit an unexpected error. Reload the page to try again.
        </p>
        {!config.isProd && error && (
          <div className="mt-6 w-full max-w-lg rounded-lg border border-border bg-elevated p-4 overflow-auto">
            <p className="text-xs font-mono text-loss break-words">{error.message}</p>
            {error.stack && (
              <pre className="mt-2 text-xs text-text-muted whitespace-pre-wrap break-words font-mono">
                {error.stack}
              </pre>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 px-5 py-2.5 rounded-md font-medium bg-accent text-[#0a0a0f] hover:bg-accent/90 transition-colors"
        >
          Reload page
        </button>
      </div>
    );
  }
}
