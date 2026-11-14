import { useSetUnits, useUnits } from '../units/unitsContext';
import { useTheme, type ThemePreference } from '../theme/themeStore';

import { SegmentedControl, type SegmentOption } from './SegmentedControl';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const THEME_OPTIONS: readonly SegmentOption<ThemePreference>[] = [
  {
    value: 'light',
    label: 'Light theme',
    iconOnly: true,
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" {...stroke}>
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: 'Dark theme',
    iconOnly: true,
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" {...stroke}>
        <path d="M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6Z" />
      </svg>
    ),
  },
  {
    value: 'system',
    label: 'System theme',
    iconOnly: true,
    icon: (
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" {...stroke}>
        <rect x="2" y="3" width="12" height="8.5" rx="1.25" />
        <path d="M6 14h4M8 11.5V14" />
      </svg>
    ),
  },
];

const UNIT_OPTIONS = [
  { value: 'metric', label: '°C' },
  { value: 'imperial', label: '°F' },
] as const;

/**
 * Header controls. Theme lives in an external store (switching it re-renders only this);
 * units come from context (switching re-renders only components that display units).
 */
export function DisplaySettings() {
  const theme = useTheme();
  const units = useUnits();
  const setUnits = useSetUnits();

  return (
    <div className="flex items-center gap-2">
      <SegmentedControl label="Units" options={UNIT_OPTIONS} value={units} onChange={setUnits} />
      <SegmentedControl
        label={`Theme (now ${theme.resolved})`}
        options={THEME_OPTIONS}
        value={theme.preference}
        onChange={theme.setPreference}
      />
    </div>
  );
}
