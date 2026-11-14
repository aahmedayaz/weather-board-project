import { Banner } from '@/shared/ui';

import type { WeatherErrorKind } from '../api/fetchWeather';

export interface WeatherErrorBannerProps {
  kind: WeatherErrorKind;
  /** What failed to load, e.g. "current conditions" or "the 5-day forecast". */
  subject: string;
  placeName: string;
  onRetry: () => void;
  /** Moves focus to city search — the way out of "not found". */
  onSearchAgain: () => void;
  role?: 'alert' | 'status';
}

/** One specific message and one recovery action per failure kind. */
export function WeatherErrorBanner({
  kind,
  subject,
  placeName,
  onRetry,
  onSearchAgain,
  role,
}: WeatherErrorBannerProps) {
  const retry = { label: 'Try again', onAction: onRetry };
  const roleProp = role ? { role } : {};

  switch (kind) {
    case 'offline':
      return (
        <Banner tone="warning" title="You’re offline" action={retry} {...roleProp}>
          Couldn’t load {subject} for {placeName}. Check your connection — it will load
          automatically when you’re back online.
        </Banner>
      );
    case 'rate-limited':
      return (
        <Banner tone="warning" title="Too many weather requests" action={retry} {...roleProp}>
          The weather service is limiting requests right now. Wait a minute, then try again.
        </Banner>
      );
    case 'not-found':
      return (
        <Banner
          tone="error"
          title={`No weather found for ${placeName}`}
          action={{ label: 'Search another city', onAction: onSearchAgain }}
          {...roleProp}
        >
          The weather service has no data for this location. Try a nearby larger city.
        </Banner>
      );
    case 'server':
      return (
        <Banner tone="error" title="Weather service problem" action={retry} {...roleProp}>
          Couldn’t load {subject} for {placeName}. This is on our side, not yours — try again in a
          moment.
        </Banner>
      );
  }
}
