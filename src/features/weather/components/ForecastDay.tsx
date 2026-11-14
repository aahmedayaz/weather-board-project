import { memo } from 'react';

import type { DailyForecast } from '@/shared/api/weather-contract';
import { VisuallyHidden } from '@/shared/ui';

import {
  conditionLabel,
  formatDateLong,
  formatPercent,
  formatTemperature,
  formatWeekdayShort,
} from '../lib/format';

import { ConditionIcon } from './ConditionIcon';

export interface ForecastDayProps {
  day: DailyForecast;
  isToday: boolean;
}

export function ForecastDayRow({ day, isToday }: ForecastDayProps) {
  return (
    <li className="flex items-center gap-3 rounded-md bg-surface-muted px-3 py-2.5 sm:flex-col sm:gap-1.5 sm:py-3 sm:text-center">
      <p className="w-12 text-sm font-medium text-fg sm:w-auto">
        <time dateTime={day.date}>
          <span aria-hidden="true">{isToday ? 'Today' : formatWeekdayShort(day.date)}</span>
          <VisuallyHidden>
            {isToday ? `Today, ${formatDateLong(day.date)}` : formatDateLong(day.date)}
          </VisuallyHidden>
        </time>
      </p>
      <ConditionIcon condition={day.condition} className="shrink-0 text-accent-text" />
      <p className="min-w-0 flex-1 truncate text-sm text-fg-muted sm:flex-none">
        {conditionLabel(day.condition)}
      </p>
      <p className="numeric text-xs text-fg-muted" title="Chance of precipitation">
        <VisuallyHidden>Chance of precipitation </VisuallyHidden>
        {formatPercent(day.precipitationChance)}
      </p>
      <p className="numeric text-sm whitespace-nowrap">
        <VisuallyHidden>High </VisuallyHidden>
        <span className="font-semibold text-fg">{formatTemperature(day.maxC)}</span>
        <span aria-hidden="true" className="text-fg-muted">
          {' '}
          /{' '}
        </span>
        <VisuallyHidden>, low </VisuallyHidden>
        <span className="text-fg-muted">{formatTemperature(day.minC)}</span>
      </p>
    </li>
  );
}

/**
 * Memoized after measuring (see ForecastStrip.test.tsx): when a refetch changes one day,
 * structural sharing keeps the other day objects identical, so memo cuts day re-renders from
 * 5 to 1. Without a changed day the strip itself doesn't re-render, memo or not.
 */
export const ForecastDay = memo(ForecastDayRow);
