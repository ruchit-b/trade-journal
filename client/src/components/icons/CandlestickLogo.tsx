/** Green candlestick logo mark for TradeEdge */
export function CandlestickLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Upper wick */}
      <line x1="12" y1="4" x2="12" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Body (green / bullish) */}
      <rect x="10" y="8" width="4" height="10" rx="0.5" fill="currentColor" />
      {/* Lower wick */}
      <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
