import { createContext, use } from 'react';

import type { Units } from '@/shared/lib/units';

/**
 * Two small contexts instead of one object:
 * - UnitsContext holds a string, so its value is stable without useMemo, and only components
 *   that *display* units (temperatures, wind) re-render when it changes;
 * - SetUnitsContext holds the stable setter for the toggle.
 * Default 'metric' outside the provider (e.g. isolated component tests).
 */
export const UnitsContext = createContext<Units>('metric');
export const SetUnitsContext = createContext<(units: Units) => void>(() => undefined);

export const useUnits = (): Units => use(UnitsContext);
export const useSetUnits = (): ((units: Units) => void) => use(SetUnitsContext);
