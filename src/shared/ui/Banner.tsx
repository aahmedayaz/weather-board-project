import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { Button } from './Button';
import { ErrorIcon, InfoIcon, WarningIcon } from './icons';

export type BannerTone = 'info' | 'warning' | 'error';

const toneStyles: Record<BannerTone, { box: string; icon: ReactNode }> = {
  info: { box: 'bg-info-bg border-info-line text-info-fg', icon: <InfoIcon /> },
  warning: { box: 'bg-warning-bg border-warning-line text-warning-fg', icon: <WarningIcon /> },
  error: { box: 'bg-danger-bg border-danger-line text-danger-fg', icon: <ErrorIcon /> },
};

export interface BannerProps {
  tone: BannerTone;
  /** Says what happened, e.g. "Couldn't load the forecast for Lisbon." */
  title: string;
  /** Says what to do next. */
  children?: ReactNode;
  /** Optional recovery action, e.g. { label: 'Try again', onAction: refetch }. */
  action?: { label: string; onAction: () => void };
  className?: string;
  /**
   * Live-region role. Defaults to 'alert' for errors (interrupts) and 'status' otherwise
   * (polite). Pass 'status' for a second error that repeats one already announced.
   */
  role?: 'alert' | 'status';
}

export function Banner({ tone, title, children, action, className, role }: BannerProps) {
  const { box, icon } = toneStyles[tone];
  return (
    <div
      role={role ?? (tone === 'error' ? 'alert' : 'status')}
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center',
        box,
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="min-w-0 text-sm">
          <p className="font-semibold">{title}</p>
          {children && <div className="mt-0.5">{children}</div>}
        </div>
      </div>
      {action && (
        <Button
          variant="secondary"
          onClick={action.onAction}
          className="shrink-0 self-start sm:self-auto"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
