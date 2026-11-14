import { z } from 'zod';

const base64url = z.string().regex(/^[A-Za-z0-9_-]+$/, 'must be base64url');

/** What `PushSubscription.toJSON()` produces. */
export const PushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/, error: 'endpoint must be an https URL' }).max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: base64url.min(80).max(100), // 65-byte uncompressed P-256 point → 87 chars
    auth: base64url.min(16).max(32), // 16-byte secret → 22 chars
  }),
});
export type PushSubscriptionJson = z.infer<typeof PushSubscriptionSchema>;

/** HH:mm, 24-hour, minutes in 5-minute steps (00, 05 … 55) — the cron runs every 5 min. */
export const ReminderTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5][05]$/, 'reminder time must be HH:mm in 5-minute steps');

/** A real IANA zone name the runtime can format in (rejects "UTC+5", "Mars/Base", …). */
export const TimeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((zone) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone });
      return zone.includes('/') || zone === 'UTC';
    } catch {
      return false;
    }
  }, 'timezone must be an IANA zone such as Asia/Karachi');

export const CitySchema = z.object({
  name: z.string().trim().min(1).max(100),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

export const SubscribeBodySchema = z.object({
  subscription: PushSubscriptionSchema,
  reminderTime: ReminderTimeSchema,
  timezone: TimeZoneSchema,
  city: CitySchema,
});
export type SubscribeBody = z.infer<typeof SubscribeBodySchema>;

export const UnsubscribeBodySchema = z.object({
  endpoint: PushSubscriptionSchema.shape.endpoint,
});
