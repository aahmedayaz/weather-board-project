import { Button } from '@/shared/ui';

import { promptInstall, usePwaState } from '../pwaStore';

/**
 * Appears only when the browser offers installation (Chromium's beforeinstallprompt).
 * Safari/iOS never fire that event — there, installing is "Share → Add to Home Screen".
 */
export function InstallButton() {
  const { installPrompt } = usePwaState();
  if (!installPrompt) return null;
  return (
    <Button variant="secondary" onClick={() => void promptInstall()}>
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M8 2.5v7M5 6.75 8 9.75l3-3M3 11.5v1.25c0 .41.34.75.75.75h8.5c.41 0 .75-.34.75-.75V11.5" />
      </svg>
      Install app
    </Button>
  );
}
