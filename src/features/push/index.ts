import { lazy } from 'react';

import { getEnv } from '@/shared/lib/env';

/** True when this build has a push worker and VAPID key (otherwise the card never shows). */
export function isPushConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.VITE_PUSH_WORKER_URL && env.VITE_VAPID_PUBLIC_KEY);
}

/** Non-critical panel, loaded after first render. Wrap in <Suspense>. */
export const ReminderCard = lazy(() =>
  import('./components/ReminderCard').then((module) => ({ default: module.ReminderCard })),
);
export type { ReminderCardProps } from './components/ReminderCard';
