// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { aggregateDaily, dominantCondition, localDate, type ForecastSlot } from './aggregate.js';

const HOUR = 3600;
/** 2026-11-14T00:00:00Z */
const MIDNIGHT_UTC = Date.UTC(2026, 10, 14) / 1000;

function slot(hoursFromMidnightUtc: number, overrides: Partial<ForecastSlot> = {}): ForecastSlot {
  return {
    time: MIDNIGHT_UTC + hoursFromMidnightUtc * HOUR,
    temperatureC: 20,
    condition: 'clear',
    precipitationChance: 0,
    ...overrides,
  };
}

describe('localDate', () => {
  it('shifts the UTC instant by the location offset', () => {
    const lateEveningUtc = MIDNIGHT_UTC + 22 * HOUR; // 22:00 UTC on the 14th
    expect(localDate(lateEveningUtc, 0)).toBe('2026-11-14');
    expect(localDate(lateEveningUtc, 5 * HOUR)).toBe('2026-11-15'); // Karachi, UTC+5
    expect(localDate(MIDNIGHT_UTC + 2 * HOUR, -5 * HOUR)).toBe('2026-11-13'); // New York
  });
});

describe('dominantCondition', () => {
  it('picks the most frequent condition', () => {
    expect(dominantCondition(['rain', 'cloudy', 'rain', 'clear'])).toBe('rain');
  });

  it('breaks ties toward the more severe condition', () => {
    expect(dominantCondition(['clear', 'thunderstorm', 'clear', 'thunderstorm'])).toBe(
      'thunderstorm',
    );
    expect(dominantCondition(['cloudy', 'partly-cloudy'])).toBe('cloudy');
  });

  it('falls back to clear for no input', () => {
    expect(dominantCondition([])).toBe('clear');
  });
});

describe('aggregateDaily', () => {
  it('returns an empty list for no slots', () => {
    expect(aggregateDaily([], 0)).toEqual([]);
  });

  it('summarizes each day: min, max, dominant condition, max precipitation chance', () => {
    const daily = aggregateDaily(
      [
        slot(0, { temperatureC: 14.04, condition: 'cloudy', precipitationChance: 0.1 }),
        slot(3, { temperatureC: 12.96, condition: 'rain', precipitationChance: 0.72 }),
        slot(6, { temperatureC: 18.5, condition: 'rain', precipitationChance: 0.4 }),
        slot(9, { temperatureC: 21.25, condition: 'cloudy', precipitationChance: 0.05 }),
        slot(12, { temperatureC: 19, condition: 'rain', precipitationChance: 0.333 }),
      ],
      0,
    );
    expect(daily).toEqual([
      { date: '2026-11-14', minC: 13, maxC: 21.3, condition: 'rain', precipitationChance: 0.72 },
    ]);
  });

  it('buckets by the location’s local day, not UTC', () => {
    // 21:00 and 23:00 UTC on the 14th are already the 15th in UTC+5.
    const slots = [slot(18), slot(21, { temperatureC: 5 }), slot(23, { temperatureC: 3 })];
    expect(aggregateDaily(slots, 0).map((day) => day.date)).toEqual(['2026-11-14']);

    const karachi = aggregateDaily(slots, 5 * HOUR);
    expect(karachi.map((day) => day.date)).toEqual(['2026-11-14', '2026-11-15']);
    expect(karachi[1]).toMatchObject({ minC: 3, maxC: 5 });
  });

  it('caps the result at five days, earliest first, even from unsorted input', () => {
    const sixDays = [5, 0, 3, 1, 4, 2].map((day) => slot(day * 24 + 12, { temperatureC: day }));
    const daily = aggregateDaily(sixDays, 0);
    expect(daily.map((day) => day.date)).toEqual([
      '2026-11-14',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ]);
    expect(daily.map((day) => day.maxC)).toEqual([0, 1, 2, 3, 4]);
  });

  it('honours a custom day count', () => {
    const slots = [0, 1, 2].map((day) => slot(day * 24));
    expect(aggregateDaily(slots, 0, 2)).toHaveLength(2);
  });

  it('handles a day with a single slot', () => {
    expect(aggregateDaily([slot(6, { temperatureC: -2.44, condition: 'snow' })], 0)).toEqual([
      { date: '2026-11-14', minC: -2.4, maxC: -2.4, condition: 'snow', precipitationChance: 0 },
    ]);
  });

  it('does not mutate its input', () => {
    const slots = [slot(6), slot(0)];
    const copy = structuredClone(slots);
    aggregateDaily(slots, 0);
    expect(slots).toEqual(copy);
  });
});
