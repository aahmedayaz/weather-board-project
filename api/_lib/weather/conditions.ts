import type { WeatherCondition } from '../../../src/shared/api/weather-contract.js';

/** OpenWeatherMap condition ids: https://openweathermap.org/weather-conditions */
export function conditionFromOpenWeatherId(id: number): WeatherCondition {
  if (id >= 200 && id < 300) return 'thunderstorm';
  if (id >= 300 && id < 400) return 'drizzle';
  if (id >= 500 && id < 600) return 'rain';
  if (id >= 600 && id < 700) return 'snow';
  if (id >= 700 && id < 800) return 'fog'; // mist, haze, smoke, dust, fog…
  if (id === 800) return 'clear';
  if (id === 801 || id === 802) return 'partly-cloudy';
  return 'cloudy'; // 803, 804 and anything unknown
}

/** WMO weather interpretation codes used by Open-Meteo. */
export function conditionFromWmoCode(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'partly-cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'thunderstorm';
  return 'cloudy'; // 3 and anything unknown
}
