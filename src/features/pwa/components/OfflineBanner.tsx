import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { Banner } from '@/shared/ui';

/** Page-level notice while the browser reports no connection. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <Banner tone="warning" title="You’re offline" className="mb-4">
      Showing the last weather saved on this device. Search and refresh will work again when you
      reconnect.
    </Banner>
  );
}
