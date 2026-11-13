import { useId, type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

export type CardProps = Omit<ComponentProps<'div'>, 'title' | 'ref'> & {
  /** When set, the card becomes a labelled <section> region with an h2. */
  title?: string;
  description?: string;
  /** Header-right slot, e.g. an IconButton. */
  actions?: ReactNode;
};

export function Card({ title, description, actions, className, children, ...props }: CardProps) {
  const titleId = useId();
  const classes = cn('min-w-0 rounded-lg bg-surface p-4 shadow-card md:p-5', className);

  if (title === undefined) {
    return (
      <div className={classes} {...props}>
        {children}
      </div>
    );
  }

  return (
    <section aria-labelledby={titleId} className={classes} {...props}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-sm font-semibold text-fg">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm text-fg-muted">{description}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
