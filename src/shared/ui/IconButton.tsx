import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { controlBase, controlSquare } from './styles';

export type IconButtonProps = Omit<ComponentProps<'button'>, 'children' | 'aria-label'> & {
  /** Accessible name. Required: an icon alone tells a screen reader nothing. */
  label: string;
  icon: ReactNode;
};

export function IconButton({ label, icon, type = 'button', className, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        controlBase,
        controlSquare,
        'text-fg-muted hover:bg-surface-muted hover:text-fg',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
