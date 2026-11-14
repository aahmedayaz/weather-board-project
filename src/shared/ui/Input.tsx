import { useId, type ComponentProps, type ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import { ErrorIcon } from './icons';
import { controlHeight } from './styles';

export type InputProps = ComponentProps<'input'> & {
  label: string;
  /** Persistent help text, linked via aria-describedby. */
  hint?: string;
  /** Inline validation message. Sets aria-invalid and is linked via aria-describedby. */
  error?: string;
  /**
   * Rendered right after the <input>, inside a `relative` wrapper — for adornments and
   * popups that must anchor to the field itself (e.g. a combobox listbox at `top-full`).
   */
  inputAddon?: ReactNode;
};

export function Input({
  label,
  hint,
  error,
  inputAddon,
  id,
  className,
  'aria-describedby': describedBy,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const hasError = error !== undefined && error !== '';

  const describedByIds = [describedBy, hint ? hintId : null, hasError ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={hasError || undefined}
          aria-describedby={describedByIds === '' ? undefined : describedByIds}
          className={cn(
            controlHeight,
            'w-full rounded-md border bg-surface px-3 text-base text-fg md:text-sm',
            'placeholder:text-fg-muted disabled:cursor-not-allowed disabled:opacity-50',
            hasError ? 'border-danger' : 'border-line-strong',
          )}
          {...props}
        />
        {inputAddon}
      </div>
      {hint && (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-danger-fg">
          <ErrorIcon className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
