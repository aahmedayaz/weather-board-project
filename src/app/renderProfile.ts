import type { ProfilerOnRenderCallback } from 'react';

export interface RenderSample {
  region: string;
  phase: 'mount' | 'update' | 'nested-update';
  actualDuration: number;
}

/**
 * Collector for <ProfiledRegion>. Off by default and only switched on by the render audit
 * (src/app/renderAudit.test.tsx). In production React does not call Profiler callbacks at
 * all, so the regions cost nothing there.
 */
const samples: RenderSample[] = [];
let recording = false;

export function startRecording(): void {
  samples.length = 0;
  recording = true;
}

export function stopRecording(): RenderSample[] {
  recording = false;
  return samples.splice(0);
}

export const onRegionRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  if (recording) samples.push({ region: id, phase, actualDuration });
};
