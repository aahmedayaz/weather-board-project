import type { WeatherCondition } from '@/shared/api/weather-contract';

const CLOUD = 'M7.5 18.5h9a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.6 11a3.75 3.75 0 0 0 .9 7.5Z';
const HIGH_CLOUD = 'M7.5 15h9a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.6 7.5 3.75 3.75 0 0 0 7.5 15Z';

function glyph(condition: WeatherCondition, isDay: boolean) {
  switch (condition) {
    case 'clear':
      return isDay ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
        </>
      ) : (
        <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />
      );
    case 'partly-cloudy':
      return (
        <>
          <path d="M8 3v1.5M3 8h1.5M4.5 4.5l1 1M12 4.5l-1 1" />
          <path d="M5.6 10.3A3.5 3.5 0 0 1 11.3 6.6" />
          <path d={CLOUD} />
        </>
      );
    case 'cloudy':
      return <path d={CLOUD} />;
    case 'fog':
      return <path d="M4 9h16M3 13h18M5 17h14M8 21h8" />;
    case 'drizzle':
      return (
        <>
          <path d={HIGH_CLOUD} />
          <path d="M8 18.5v.5M12 18v.5M16 18.5v.5M10 21.5v.5M14 21.5v.5" />
        </>
      );
    case 'rain':
      return (
        <>
          <path d={HIGH_CLOUD} />
          <path d="M8 17.5l-1 3M12 17.5l-1 3M16 17.5l-1 3" />
        </>
      );
    case 'snow':
      return (
        <>
          <path d={HIGH_CLOUD} />
          <path d="M8 18v3M6.7 19.5h2.6M12 18v3M10.7 19.5h2.6M16 18v3M14.7 19.5h2.6" />
        </>
      );
    case 'thunderstorm':
      return (
        <>
          <path d={HIGH_CLOUD} />
          <path d="M12.5 15.5 10 19.5h3.5L11 23.5" />
        </>
      );
  }
}

/** Decorative: the condition is always also given as text next to it. */
export function ConditionIcon({
  condition,
  isDay = true,
  size = 24,
  className,
}: {
  condition: WeatherCondition;
  isDay?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {glyph(condition, isDay)}
    </svg>
  );
}
