import type { City } from '@/shared/api/cities-contract';
import { Card, Skeleton, VisuallyHidden } from '@/shared/ui';

import { weatherErrorKind } from '../api/fetchWeather';
import { selectForecast, useWeather } from '../api/weatherQuery';

import { ForecastDay } from './ForecastDay';
import { WeatherErrorBanner } from './WeatherErrorBanner';
import { WeatherSourceNote } from './WeatherSourceNote';

export interface ForecastStripProps {
  city: City;
  onSearchAgain: () => void;
  className?: string;
}

export function ForecastStrip({ city, onSearchAgain, className }: ForecastStripProps) {
  const query = useWeather(city, selectForecast);

  let body;
  if (query.data) {
    const { days, todayDate } = query.data;
    body =
      days.length === 0 ? (
        <p className="text-sm text-fg-muted">
          No forecast is available for {city.name} right now. Try refreshing in a few minutes.
        </p>
      ) : (
        <>
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {days.map((day) => (
              <ForecastDay key={day.date} day={day} isToday={day.date === todayDate} />
            ))}
          </ol>
          <WeatherSourceNote coordinates={city} />
        </>
      );
  } else if (query.isError || query.isPaused) {
    body = (
      <WeatherErrorBanner
        kind={query.isError ? weatherErrorKind(query.error) : 'offline'}
        subject="the 5-day forecast"
        placeName={city.name}
        onRetry={() => void query.refetch()}
        onSearchAgain={onSearchAgain}
        // Same failure as the current-conditions card, which already alerted: stay polite.
        role="status"
      />
    );
  } else {
    body = (
      <div role="status" aria-busy="true">
        <VisuallyHidden>Loading the 5-day forecast for {city.name}…</VisuallyHidden>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {[0, 1, 2, 3, 4].map((slot) => (
            <Skeleton key={slot} className="h-12 sm:h-36" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card title="5-day forecast" className={className}>
      {body}
    </Card>
  );
}
