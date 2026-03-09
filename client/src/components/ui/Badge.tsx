import { memo } from 'react';

type BadgeVariant = 'win' | 'loss' | 'open' | 'breakeven';

const variantClasses: Record<BadgeVariant, string> = {
  // Use explicit RGBA since Tailwind color/opacity doesn't work reliably with CSS var colors.
  win: 'bg-[rgba(0,200,150,0.14)] text-profit border-[rgba(0,200,150,0.40)]',
  loss: 'bg-[rgba(239,68,68,0.14)] text-loss border-[rgba(239,68,68,0.40)]',
  open: 'bg-[rgba(245,158,11,0.16)] text-warning border-[rgba(245,158,11,0.45)]',
  breakeven: 'bg-[rgba(153,153,153,0.14)] text-text-muted border-border',
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

function BadgeInner({ variant, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
export const Badge = memo(BadgeInner);
