import { memo } from 'react';

import type { City } from '@/shared/api/cities-contract';
import { cn } from '@/shared/lib/cn';

import { formatCityDetail } from '../lib/formatCity';

export interface CityOptionProps {
  city: City;
  index: number;
  optionId: string;
  active: boolean;
  /** Must be referentially stable (useCallback) — or memo() below is defeated. */
  onSelect: (city: City) => void;
  /** Must be referentially stable — a state setter is ideal. */
  onActivate: (index: number) => void;
}

export function CityOptionRow({
  city,
  index,
  optionId,
  active,
  onSelect,
  onActivate,
}: CityOptionProps) {
  return (
    // Keyboard interaction lives on the combobox input (aria-activedescendant pattern),
    // so options are pointer targets only and never take focus.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      id={optionId}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      // Keep focus in the input so the popup doesn't close before the click lands.
      onMouseDown={(event) => {
        event.preventDefault();
      }}
      onClick={() => {
        onSelect(city);
      }}
      onPointerMove={() => {
        if (!active) onActivate(index);
      }}
      className={cn(
        'flex min-h-11 cursor-pointer flex-col justify-center rounded-md px-3 py-1.5 md:pointer-fine:min-h-9',
        active && 'bg-surface-muted',
      )}
    >
      <span className="truncate text-sm font-medium text-fg">{city.name}</span>
      <span className="truncate text-xs text-fg-muted">{formatCityDetail(city)}</span>
    </div>
  );
}

/**
 * Memoized row. While the user types, the list shows the previous results (placeholder data
 * keeps the same array and city objects) and every prop here stays referentially equal, so
 * rows skip rendering. Moving the active option re-renders exactly two rows.
 */
export const CityOption = memo(CityOptionRow);
