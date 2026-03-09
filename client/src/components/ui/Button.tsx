import React, { forwardRef, memo } from 'react';
import { Spinner } from './Spinner';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-[#0a0a0f] hover:bg-accent/90 focus-visible:ring-accent border-transparent',
  secondary:
    'bg-elevated text-text-primary border-border hover:bg-elevated/80 focus-visible:ring-border',
  ghost:
    'bg-transparent text-text-secondary border-transparent hover:bg-elevated hover:text-text-primary focus-visible:ring-border',
  danger:
    'bg-loss/15 text-loss border-loss/30 hover:bg-loss/25 focus-visible:ring-loss',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-5 py-3 text-base gap-2.5',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const ButtonInner = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center font-medium rounded-md border
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-base
          disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${className}
        `}
        {...props}
      >
        {loading ? (
          <Spinner size={size === 'lg' ? 'md' : size === 'sm' ? 'sm' : 'md'} className="shrink-0" />
        ) : (
          leftIcon
        )}
        {children && <span>{children}</span>}
        {!loading && rightIcon}
      </button>
    );
  }
);

ButtonInner.displayName = 'Button';
export const Button = memo(ButtonInner);
