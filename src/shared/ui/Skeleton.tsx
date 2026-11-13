import { cn } from '@/shared/lib/cn';

/**
 * Placeholder block. Hidden from assistive tech: the loading container announces itself
 * (role="status" + aria-busy, with a VisuallyHidden label). Size it with className.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none',
        className,
      )}
    />
  );
}
