import { useCallback, useState, type ReactNode } from 'react';
import { z } from 'zod';

import { readStorage, writeStorage } from '@/shared/lib/storage';
import type { Units } from '@/shared/lib/units';

import { SetUnitsContext, UnitsContext } from './unitsContext';

const UNITS_STORAGE_KEY = 'weatherboard:units:v1';
const UnitsSchema = z.enum(['metric', 'imperial']);

export function UnitsProvider({ children }: { children: ReactNode }) {
  const [units, setUnitsState] = useState<Units>(
    () => readStorage(UNITS_STORAGE_KEY, UnitsSchema) ?? 'metric',
  );
  // Referential stability is the reason for useCallback here: the setter is a context value.
  const setUnits = useCallback((next: Units) => {
    writeStorage(UNITS_STORAGE_KEY, next);
    setUnitsState(next);
  }, []);

  return (
    <SetUnitsContext value={setUnits}>
      <UnitsContext value={units}>{children}</UnitsContext>
    </SetUnitsContext>
  );
}
