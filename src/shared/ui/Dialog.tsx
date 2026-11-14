import { useEffect, useEffectEvent, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface DialogProps {
  open: boolean;
  /** Called on Escape and by your own Cancel button. */
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Footer buttons. Required, so there is always a visible way out. Put Cancel first. */
  actions: ReactNode;
  /** Element to focus on open. Defaults to the first focusable element (Cancel, by convention). */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Accessible modal dialog.
 * - role="dialog" + aria-modal, named by the title and described by the description
 * - focus moves into the dialog on open and is trapped there (Tab / Shift+Tab wrap)
 * - Escape closes
 * - the rest of the page is `inert` (unreachable by keyboard, pointer and screen readers)
 * - focus returns to the element that opened it on close
 */
export function Dialog(props: DialogProps) {
  if (!props.open) return null;
  return createPortal(<DialogContent {...props} />, document.body);
}

function DialogContent({
  onClose,
  title,
  description,
  children,
  actions,
  initialFocusRef,
}: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Escape + focus trap. An effect event always sees the latest onClose without
  // re-subscribing (and re-running focus management) when the parent re-renders.
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const panel = panelRef.current;
    if (!panel) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Mount/unmount side effects: initial focus, inert background, scroll lock, focus restore.
  useEffect(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;

    const previouslyFocused = document.activeElement;

    const background = Array.from(document.body.children).filter(
      (element) => element !== overlay && !element.hasAttribute('inert'),
    );
    for (const element of background) element.setAttribute('inert', '');

    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = 'hidden';

    const initial =
      initialFocusRef?.current ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
    initial.focus();

    return () => {
      for (const element of background) element.removeAttribute('inert');
      root.style.overflow = previousOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [initialFocusRef]);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay p-4 sm:items-center"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-y-auto rounded-lg bg-surface p-5 shadow-overlay"
      >
        <h2 id={titleId} className="text-base font-semibold text-fg">
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className="mt-1.5 text-sm text-fg-muted">
            {description}
          </p>
        )}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>
      </div>
    </div>
  );
}
