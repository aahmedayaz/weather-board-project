import type { City } from '@/shared/api/cities-contract';
import type { WeatherBundle } from '@/shared/api/weather-contract';
import { Card, Skeleton, VisuallyHidden } from '@/shared/ui';

import { weatherErrorKind } from '../api/fetchWeather';
import { useWeather } from '../api/weatherQuery';
import { conditionLabel, formatLocalTime, formatTemperature, formatWind } from '../lib/format';

import { ConditionIcon } from './ConditionIcon';
import { RefreshButton } from './RefreshButton';
import { WeatherErrorBanner } from './WeatherErrorBanner';

const selectCurrentView = (bundle: WeatherBundle) => ({
  current: bundle.current,
  timezoneOffsetSeconds: bundle.timezoneOffsetSeconds,
});

export interface CurrentConditionsProps {
  city: City;
  /** Detail line under the city name, e.g. "Sindh, Pakistan". */
  placeDetail: string;
  onSearchAgain: () => void;
  className?: string;
}

export function CurrentConditions({
  city,
  placeDetail,
  onSearchAgain,
  className,
}: CurrentConditionsProps) {
  const query = useWeather(city, selectCurrentView);

  let body;
  if (query.data) {
    const { current, timezoneOffsetSeconds } = query.data;
    body = (
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="flex items-center gap-4">
          <ConditionIcon
            condition={current.condition}
            isDay={current.isDay}
            size={56}
            className="text-accent-text"
          />
          <div>
            <p className="numeric text-5xl font-semibold tracking-tight text-fg">
              {formatTemperature(current.temperatureC)}
              <VisuallyHidden>C</VisuallyHidden>
            </p>
            <p className="text-sm font-medium text-fg">{conditionLabel(current.condition)}</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-x-6 gap-y-1 text-sm">
          <dt className="text-fg-muted">Feels like</dt>
          <dt className="text-fg-muted">Humidity</dt>
          <dt className="text-fg-muted">Wind</dt>
          <dd className="numeric font-medium text-fg">{formatTemperature(current.feelsLikeC)}</dd>
          <dd className="numeric font-medium text-fg">{Math.round(current.humidity)}%</dd>
          <dd className="numeric font-medium text-fg">{formatWind(current.windSpeedMs)}</dd>
        </dl>
        <p className="w-full text-xs text-fg-muted">
          Observed at{' '}
          <span className="numeric">
            {formatLocalTime(current.observedAt, timezoneOffsetSeconds)}
          </span>{' '}
          local time
        </p>
      </div>
    );
  } else if (query.isError || query.fetchStatus === 'paused') {
    // `paused` = TanStack is waiting for the network to come back, with nothing cached.
    body = (
      <WeatherErrorBanner
        kind={query.isError ? weatherErrorKind(query.error) : 'offline'}
        subject="current conditions"
        placeName={city.name}
        onRetry={() => void query.refetch()}
        onSearchAgain={onSearchAgain}
      />
    );
  } else {
    body = (
      <div role="status" aria-busy="true" className="flex items-center gap-4">
        <VisuallyHidden>Loading current conditions for {city.name}…</VisuallyHidden>
        <Skeleton className="size-14 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="hidden h-10 w-56 sm:block" />
      </div>
    );
  }

  return (
    <Card
      title={city.name}
      description={placeDetail}
      actions={<RefreshButton coordinates={city} />}
      className={className}
    >
      {body}
    </Card>
  );
}
