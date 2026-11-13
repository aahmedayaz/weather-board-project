import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

import { SpinnerIcon } from './icons';
import { controlBase, controlHeight } from './styles';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'bg-surface text-fg border border-line-strong hover:bg-surface-muted',
  ghost: 'text-fg hover:bg-surface-muted',
  danger: 'bg-danger text-accent-fg hover:bg-danger-hover',
};

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  /** Shows a spinner, sets aria-busy and blocks clicks while an action is in flight. */
  loading?: boolean;
};

export function Button({
  variant = 'secondary',
  loading = false,
  disabled,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cn(controlBase, controlHeight, 'px-4', variantClasses[variant], className)}
      {...props}
    >
      {loading && <SpinnerIcon className="animate-spin" />}
      {children}
    </button>
  );
}
