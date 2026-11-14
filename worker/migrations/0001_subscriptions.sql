-- One row per browser push subscription (the endpoint is unique per device/browser).
CREATE TABLE subscriptions (
  endpoint             TEXT PRIMARY KEY,
  p256dh               TEXT NOT NULL,
  auth                 TEXT NOT NULL,
  -- Local wall-clock time of the reminder, HH:mm in 5-minute steps.
  reminder_time        TEXT NOT NULL CHECK (reminder_time GLOB '[0-2][0-9]:[0-5][05]'),
  -- IANA zone, e.g. Asia/Karachi. Due-ness is computed in this zone (DST-safe).
  timezone             TEXT NOT NULL,
  city_name            TEXT NOT NULL,
  lat                  REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lon                  REAL NOT NULL CHECK (lon BETWEEN -180 AND 180),
  -- Local calendar date (YYYY-MM-DD) of the last successful send; NULL = never.
  last_sent_local_date TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- The cron groups work by zone, then filters by time and last send.
CREATE INDEX subscriptions_due ON subscriptions (timezone, reminder_time, last_sent_local_date);
