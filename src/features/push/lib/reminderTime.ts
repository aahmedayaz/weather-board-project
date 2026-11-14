import { z } from 'zod';

/** Same rule as the worker: HH:mm, 24 h, minutes in 5-minute steps (the cron runs every 5). */
export const ReminderTimeSchema = z
  .string()
  .trim()
  .min(1, 'Choose a time for your reminder.')
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Enter a time like 07:30.')
  .refine(
    (time) => Number(time.slice(3)) % 5 === 0,
    'Choose a time in 5-minute steps, like 07:30 or 07:35.',
  );

export const DEFAULT_REMINDER_TIME = '07:30';
