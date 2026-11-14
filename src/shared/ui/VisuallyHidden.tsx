import type { ComponentProps } from 'react';

/** Text for screen readers only (e.g. a loading label, or context for an icon). */
export function VisuallyHidden(props: Omit<ComponentProps<'span'>, 'className'>) {
  return <span className="sr-only" {...props} />;
}
