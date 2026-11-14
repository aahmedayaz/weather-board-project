import { describe, expect, it, vi } from 'vitest';

import { localClock } from './clock';
import {
  buildPayload,
  minutesBefore,
  runReminders,
  type DailyForecast,
  type PushSender,
  type SendResult,
  type StoredSubscription,
  type SubscriptionStore,
} from './reminders';

/** In-memory store with the same due-ness semantics as the D1 query. */
function memoryStore(initial: StoredSubscription[]) {
  const rows = new Map(initial.map((row) => [row.endpoint, { ...row }]));
  const store: SubscriptionStore = {
    listTimezones: () =>
      Promise.resolve([...new Set([...rows.values()].map((row) => row.timezone))]),
    listDue: (timezone, localDate, fromTime, toTime) =>
      Promise.resolve(
        [...rows.values()].filter(
          (row) =>
            row.timezone === timezone &&
            row.reminderTime > fromTime &&
            row.reminderTime <= toTime &&
            (row.lastSentLocalDate === null || row.lastSentLocalDate < localDate),
        ),
      ),
    markSent: (endpoint, localDate) => {
      const row = rows.get(endpoint);
      if (row) row.lastSentLocalDate = localDate;
      return Promise.resolve();
    },
    remove: (endpoint) => {
      rows.delete(endpoint);
      return Promise.resolve();
    },
  };
  return { store, rows };
}

function subscription(
  overrides: Partial<StoredSubscription> & { endpoint: string },
): StoredSubscription {
  return {
    keys: { p256dh: 'p', auth: 'a' },
    reminderTime: '07:30',
    timezone: 'Asia/Karachi',
    city: { name: 'Karachi', lat: 24.86, lon: 67.0 },
    lastSentLocalDate: null,
    ...overrides,
  };
}

function fakeSender(results: Record<string, SendResult> = {}) {
  const sent: { endpoint: string; payload: string }[] = [];
  const sender: PushSender = {
    send: (sub, payload) => {
      sent.push({ endpoint: sub.endpoint, payload });
      return Promise.resolve(results[sub.endpoint] ?? { ok: true });
    },
  };
  return { sender, sent };
}

const sunny: DailyForecast = { maxC: 31.4, minC: 22.6, precipitationChance: 10, summary: 'Clear' };
const forecastOk = vi.fn(() => Promise.resolve(sunny));

// 02:30 UTC = 07:30 in Karachi (UTC+5) = 03:30 in Lisbon (UTC+1? no — Nov: UTC+0 → 02:30).
const KARACHI_0730 = new Date(Date.UTC(2026, 10, 14, 2, 30));

describe('localClock', () => {
  it('gives the local date and time in a zone, including date rollover', () => {
    expect(localClock(KARACHI_0730, 'Asia/Karachi')).toEqual({ date: '2026-11-14', time: '07:30' });
    expect(localClock(KARACHI_0730, 'America/New_York')).toEqual({
      date: '2026-11-13',
      time: '21:30',
    });
  });

  it('follows daylight-saving changes', () => {
    // New York: UTC-4 in summer, UTC-5 in winter.
    expect(localClock(new Date(Date.UTC(2026, 6, 1, 12)), 'America/New_York').time).toBe('08:00');
    expect(localClock(new Date(Date.UTC(2026, 11, 1, 12)), 'America/New_York').time).toBe('07:00');
  });
});

describe('runReminders', () => {
  it('sends to subscriptions whose local time is due and marks them sent today', async () => {
    const { store, rows } = memoryStore([
      subscription({ endpoint: 'due' }),
      subscription({ endpoint: 'later', reminderTime: '08:00' }),
    ]);
    const { sender, sent } = fakeSender();

    const summary = await runReminders({ now: KARACHI_0730, store, sender, forecast: forecastOk });

    expect(sent.map((s) => s.endpoint)).toEqual(['due']);
    expect(rows.get('due')?.lastSentLocalDate).toBe('2026-11-14');
    expect(rows.get('later')?.lastSentLocalDate).toBeNull();
    expect(summary).toEqual({ due: 1, sent: 1, removed: 0, failed: 0 });
  });

  it('never sends twice on the same local day', async () => {
    const { store } = memoryStore([subscription({ endpoint: 'due' })]);
    const { sender, sent } = fakeSender();
    await runReminders({ now: KARACHI_0730, store, sender, forecast: forecastOk });
    await runReminders({
      now: new Date(KARACHI_0730.getTime() + 5 * 60_000),
      store,
      sender,
      forecast: forecastOk,
    });
    expect(sent).toHaveLength(1);
  });

  it('catches up later the same day if a run was missed', async () => {
    const { store } = memoryStore([subscription({ endpoint: 'missed', reminderTime: '07:00' })]);
    const { sender, sent } = fakeSender();
    await runReminders({ now: KARACHI_0730, store, sender, forecast: forecastOk });
    expect(sent).toHaveLength(1);
  });

  it('never sends a reminder more than an hour late', async () => {
    const { store } = memoryStore([subscription({ endpoint: 'too-late', reminderTime: '06:25' })]);
    const { sender, sent } = fakeSender();
    await runReminders({ now: KARACHI_0730, store, sender, forecast: forecastOk }); // 65 min late
    expect(sent).toHaveLength(0);
  });

  it('evaluates each subscriber in their own time zone', async () => {
    const { store } = memoryStore([
      subscription({ endpoint: 'karachi' }), // 07:30 local → due
      subscription({ endpoint: 'new-york', timezone: 'America/New_York' }), // 21:30 local → not due
    ]);
    const { sender, sent } = fakeSender();
    await runReminders({ now: KARACHI_0730, store, sender, forecast: forecastOk });
    expect(sent.map((s) => s.endpoint)).toEqual(['karachi']);
  });

  it.each([404, 410])(
    'deletes subscriptions the push service reports as gone (%i)',
    async (status) => {
      const { store, rows } = memoryStore([subscription({ endpoint: 'gone' })]);
      const { sender } = fakeSender({ gone: { ok: false, gone: true, status } });
      const summary = await runReminders({
        now: KARACHI_0730,
        store,
        sender,
        forecast: forecastOk,
      });
      expect(rows.has('gone')).toBe(false);
      expect(summary).toMatchObject({ removed: 1, sent: 0 });
    },
  );

  it('keeps transient failures unsent so the next run retries', async () => {
    const { store, rows } = memoryStore([subscription({ endpoint: 'flaky' })]);
    const { sender } = fakeSender({ flaky: { ok: false, gone: false, status: 503 } });
    const summary = await runReminders({ now: KARACHI_0730, store, sender, forecast: forecastOk });
    expect(rows.get('flaky')?.lastSentLocalDate).toBeNull();
    expect(rows.has('flaky')).toBe(true);
    expect(summary).toMatchObject({ failed: 1 });
  });

  it('fetches each place’s forecast once per run, however many subscribers share it', async () => {
    const forecast = vi.fn(() => Promise.resolve(sunny));
    const { store } = memoryStore([
      subscription({ endpoint: 'a' }),
      subscription({ endpoint: 'b' }),
      subscription({ endpoint: 'c', city: { name: 'Lahore', lat: 31.55, lon: 74.34 } }),
    ]);
    const { sender } = fakeSender();
    await runReminders({ now: KARACHI_0730, store, sender, forecast });
    expect(forecast).toHaveBeenCalledTimes(2);
  });

  it('still sends a generic reminder when the forecast is unavailable', async () => {
    const { store } = memoryStore([subscription({ endpoint: 'due' })]);
    const { sender, sent } = fakeSender();
    await runReminders({
      now: KARACHI_0730,
      store,
      sender,
      forecast: () => Promise.reject(new Error('Open-Meteo down')),
    });
    expect(JSON.parse(sent[0]?.payload ?? '{}')).toMatchObject({
      title: 'Karachi today',
      body: 'Tap to see today’s forecast.',
    });
  });
});

describe('minutesBefore', () => {
  it('subtracts within the day and clamps at midnight', () => {
    expect(minutesBefore('07:30', 60)).toBe('06:30');
    expect(minutesBefore('00:20', 60)).toBe('-'); // sorts before "00:00", so a 00:00 reminder stays inside the window
  });
});

describe('buildPayload', () => {
  it('summarizes the day and links back to the saved city', () => {
    const payload = buildPayload(subscription({ endpoint: 'x' }), sunny);
    expect(payload).toEqual({
      title: 'Karachi: 31° / 23°',
      body: 'Clear. 10% chance of rain.',
      url: '/?name=Karachi&lat=24.86&lon=67',
    });
  });
});
