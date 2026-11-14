import { describe, expect, it } from 'vitest';

import { celsiusToFahrenheit, formatTemperature, formatWind, metresPerSecondToKmh } from './units';

describe('unit conversions', () => {
  it.each([
    [0, 32],
    [100, 212],
    [-40, -40],
    [37, 98.6],
    [-17.7778, 0],
  ])('%s °C = %s °F', (celsius, fahrenheit) => {
    expect(celsiusToFahrenheit(celsius)).toBeCloseTo(fahrenheit, 2);
  });

  it.each([
    [0, 0],
    [1, 3.6],
    [10, 36],
    [27.78, 100.008],
  ])('%s m/s = %s km/h', (ms, kmh) => {
    expect(metresPerSecondToKmh(ms)).toBeCloseTo(kmh, 2);
  });
});

describe('formatting', () => {
  it('formats temperatures in either unit, rounded', () => {
    expect(formatTemperature(21.6, 'metric')).toBe('22°');
    expect(formatTemperature(21.6, 'imperial')).toBe('71°'); // 70.88
    expect(formatTemperature(-40, 'imperial')).toBe('-40°');
  });

  it('never prints "-0°"', () => {
    expect(formatTemperature(-0.4, 'metric')).toBe('0°');
    expect(formatTemperature(-17.9, 'imperial')).toBe('0°'); // -0.22 °F
  });

  it('always shows wind in km/h, whatever the temperature unit', () => {
    expect(formatWind(5)).toBe('18 km/h');
    expect(formatWind(0.1)).toBe('0 km/h');
  });
});
