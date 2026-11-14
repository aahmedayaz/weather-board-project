import type { StoredSubscription, SubscriptionStore } from './reminders';
import type { SubscribeBody } from './schemas';

export interface SubscriptionWriter {
  /** Insert or update by endpoint. `lastSentLocalDate` lets the caller skip "today". */
  upsert(body: SubscribeBody, lastSentLocalDate: string | null): Promise<void>;
  remove(endpoint: string): Promise<void>;
}

interface Row {
  endpoint: string;
  p256dh: string;
  auth: string;
  reminder_time: string;
  timezone: string;
  city_name: string;
  lat: number;
  lon: number;
  last_sent_local_date: string | null;
}

const toSubscription = (row: Row): StoredSubscription => ({
  endpoint: row.endpoint,
  keys: { p256dh: row.p256dh, auth: row.auth },
  reminderTime: row.reminder_time,
  timezone: row.timezone,
  city: { name: row.city_name, lat: row.lat, lon: row.lon },
  lastSentLocalDate: row.last_sent_local_date,
});

/** D1-backed store. All SQL is parameterized. */
export function createD1Store(db: D1Database): SubscriptionStore & SubscriptionWriter {
  return {
    async upsert(body, lastSentLocalDate) {
      const { subscription, reminderTime, timezone, city } = body;
      await db
        .prepare(
          `INSERT INTO subscriptions
             (endpoint, p256dh, auth, reminder_time, timezone, city_name, lat, lon, last_sent_local_date)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
           ON CONFLICT (endpoint) DO UPDATE SET
             p256dh = excluded.p256dh,
             auth = excluded.auth,
             reminder_time = excluded.reminder_time,
             timezone = excluded.timezone,
             city_name = excluded.city_name,
             lat = excluded.lat,
             lon = excluded.lon,
             last_sent_local_date = excluded.last_sent_local_date,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
        )
        .bind(
          subscription.endpoint,
          subscription.keys.p256dh,
          subscription.keys.auth,
          reminderTime,
          timezone,
          city.name,
          city.lat,
          city.lon,
          lastSentLocalDate,
        )
        .run();
    },

    async remove(endpoint) {
      await db.prepare('DELETE FROM subscriptions WHERE endpoint = ?1').bind(endpoint).run();
    },

    async listTimezones() {
      const { results } = await db
        .prepare('SELECT DISTINCT timezone FROM subscriptions')
        .all<{ timezone: string }>();
      return results.map((row) => row.timezone);
    },

    async listDue(timezone, localDate, fromTime, toTime) {
      const { results } = await db
        .prepare(
          `SELECT * FROM subscriptions
            WHERE timezone = ?1
              AND reminder_time > ?2
              AND reminder_time <= ?3
              AND (last_sent_local_date IS NULL OR last_sent_local_date < ?4)`,
        )
        .bind(timezone, fromTime, toTime, localDate)
        .all<Row>();
      return results.map(toSubscription);
    },

    async markSent(endpoint, localDate) {
      await db
        .prepare('UPDATE subscriptions SET last_sent_local_date = ?2 WHERE endpoint = ?1')
        .bind(endpoint, localDate)
        .run();
    },
  };
}
