import { useSyncExternalStore } from 'react';

/** Chromium's install prompt event (not in lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return 'prompt' in event && typeof event.prompt === 'function' && 'userChoice' in event;
}

export interface PwaState {
  /** A deferred install prompt the custom Install button can show. */
  installPrompt: BeforeInstallPromptEvent | null;
  /** A new service worker is waiting; the update toast offers to activate it. */
  updateAvailable: boolean;
}

let state: PwaState = { installPrompt: null, updateAvailable: false };
let applyUpdateFn: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();

function setState(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => state;

export function usePwaState(): PwaState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Call once at startup, before React renders: `beforeinstallprompt` can fire before any
 * component mounts. The browser's own mini-infobar is suppressed in favour of our button.
 */
export function listenForInstallPrompt(target: Window = window): void {
  target.addEventListener('beforeinstallprompt', (event) => {
    if (!isInstallPromptEvent(event)) return;
    event.preventDefault();
    setState({ installPrompt: event });
  });
  target.addEventListener('appinstalled', () => {
    setState({ installPrompt: null });
  });
}

/** Shows the native install dialog. Returns whether the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = state.installPrompt;
  if (!event) return false;
  setState({ installPrompt: null }); // a prompt event can only be used once
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome === 'accepted';
}

/** Wired by the service worker registration. */
export function notifyUpdateAvailable(applyUpdate: () => Promise<void>): void {
  applyUpdateFn = applyUpdate;
  setState({ updateAvailable: true });
}

export async function applyUpdate(): Promise<void> {
  setState({ updateAvailable: false });
  await applyUpdateFn?.();
}

export function dismissUpdate(): void {
  setState({ updateAvailable: false });
}
