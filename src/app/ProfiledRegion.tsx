import { Profiler, type ReactNode } from 'react';

import { onRegionRender } from './renderProfile';

/** Names a dashboard region for the React Profiler (see renderProfile.ts). */
export function ProfiledRegion({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Profiler id={id} onRender={onRegionRender}>
      {children}
    </Profiler>
  );
}
