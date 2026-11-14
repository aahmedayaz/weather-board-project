/**
 * Daily-reminder sending. Pure orchestration: everything with side effects (the subscription
 * store, the push sender, the forecast source, the clock) is passed in, so this module is
 * unit-tested with plain fakes and no Workers runtime.
 */
import { localClock } from './clock';

/** How late a reminder may still go out after a missed or delayed cron run. */
export const CATCH_UP_MINUTES = 60;

/** HH:mm minus `minutes`, clamped at 00:00 (the window does not wrap past midnight). */
export function minutesBefore(time: string, minutes: number): string {
  const [hours = 0, mins = 0] = time.split(':').map(Number);
  const total = Math.max(-1, hours * 60 + mins - minutes);
  if (total < 0) return '-'; // sorts before "00:00": the window starts at midnight
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  reminderTime: string; // HH:mm
  timezone: string;
  city: { name: string; lat: number; lon: number };
  lastSentLocalDate: string | null;
}

export interface SubscriptionStore {
  /** Distinct time zones that have at least one subscription. */
  listTimezones(): Promise<string[]>;
  /**
   * Subscriptions in `timezone` with `fromTime < reminderTime <= toTime` (HH:mm, local) that
   * have not been sent on `localDate` yet. The window lets a skipped or late cron run catch
   * up — but only briefly, so a "morning" reminder never arrives in the evening.
   */
  listDue(
    timezone: string,
    localDate: string,
    fromTime: string,
    toTime: string,
  ): Promise<StoredSubscription[]>;
  markSent(endpoint: string, localDate: string): Promise<void>;
  remove(endpoint: string): Promise<void>;
}

export type SendResult = { ok: true } | { ok: false; gone: boolean; status?: number };

export interface PushSender {
  send(subscription: StoredSubscription, payload: string): Promise<SendResult>;
}

export interface DailyForecast {
  maxC: number;
  minC: number;
  precipitationChance: number; // 0–100
  summary: string; // e.g. "Light rain"
}

export type ForecastSource = (lat: number, lon: number, timezone: string) => Promise<DailyForecast>;

/** What the service worker receives (validated there too). */
export interface ReminderPayload {
  title: string;
  body: string;
  url: string;
}

export function buildPayload(
  subscription: StoredSubscription,
  forecast: DailyForecast | null,
): ReminderPayload {
  const { city } = subscription;
  const params = new URLSearchParams({
    name: city.name,
    lat: String(city.lat),
    lon: String(city.lon),
  });
  const url = `/?${params.toString()}`;
  if (!forecast) {
    return { title: `${city.name} today`, body: 'Tap to see today’s forecast.', url };
  }
  const rain = Math.round(forecast.precipitationChance);
  return {
    title: `${city.name}: ${String(Math.round(forecast.maxC))}° / ${String(Math.round(forecast.minC))}°`,
    body: `${forecast.summary}. ${String(rain)}% chance of rain.`,
    url,
  };
}

export interface RunSummary {
  due: number;
  sent: number;
  removed: number;
  failed: number;
}

export interface RunDeps {
  now: Date;
  store: SubscriptionStore;
  sender: PushSender;
  forecast: ForecastSource;
}

export async function runReminders({ now, store, sender, forecast }: RunDeps): Promise<RunSummary> {
  const summary: RunSummary = { due: 0, sent: 0, removed: 0, failed: 0 };
  // One forecast request per place per run, however many subscribers share it.
  const forecasts = new Map<string, Promise<DailyForecast | null>>();
  const forecastFor = (subscription: StoredSubscription) => {
    const { lat, lon } = subscription.city;
    const key = `${lat.toFixed(2)},${lon.toFixed(2)},${subscription.timezone}`;
    let pending = forecasts.get(key);
    if (!pending) {
      // A forecast outage must not cancel the reminder: send a generic one instead.
      pending = forecast(lat, lon, subscription.timezone).catch(() => null);
      forecasts.set(key, pending);
    }
    return pending;
  };

  for (const timezone of await store.listTimezones()) {
    const { date, time } = localClock(now, timezone);
    const due = await store.listDue(timezone, date, minutesBefore(time, CATCH_UP_MINUTES), time);
    summary.due += due.length;

    for (const subscription of due) {
      const payload = buildPayload(subscription, await forecastFor(subscription));
      const result = await sender.send(subscription, JSON.stringify(payload));
      if (result.ok) {
        await store.markSent(subscription.endpoint, date);
        summary.sent += 1;
      } else if (result.gone) {
        // 404/410: the browser dropped this subscription for good.
        await store.remove(subscription.endpoint);
        summary.removed += 1;
      } else {
        // Transient (429/5xx/network): leave unsent so the next run retries today.
        summary.failed += 1;
      }
    }
  }
  return summary;
}
