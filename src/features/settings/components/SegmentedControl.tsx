import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Show only the icon (the label stays as the accessible name). */
  iconOnly?: boolean;
}

/** A small group of toggle buttons; the pressed one is the current value. 44 px targets. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded-md border border-line-strong p-0.5"
    >
      {options.map((option) => {
        const pressed = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            aria-label={option.iconOnly ? option.label : undefined}
            title={option.iconOnly ? option.label : undefined}
            onClick={() => {
              onChange(option.value);
            }}
            className={cn(
              'flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-[5px] px-2 text-sm font-medium md:pointer-fine:min-h-8 md:pointer-fine:min-w-9',
              pressed ? 'bg-surface-muted text-fg' : 'text-fg-muted hover:text-fg',
            )}
          >
            {option.icon}
            {!option.iconOnly && option.label}
          </button>
        );
      })}
    </div>
  );
}
