import { handleRequest, parseAllowedOrigins } from './app';
import { fetchDailyForecast } from './forecast';
import { runReminders } from './reminders';
import { createWebPushSender } from './sender';
import { createD1Store } from './store';

export interface Env {
  DB: D1Database;
  /** Comma-separated allowlist, from wrangler.toml [env.*.vars]. */
  ALLOWED_ORIGINS: string;
  /** mailto: or https: contact for push services. */
  VAPID_SUBJECT: string;
  /** Secrets: `wrangler secret put VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY --env <env>`. */
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
}

export default {
  fetch(request, env) {
    return handleRequest(request, {
      store: createD1Store(env.DB),
      allowedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS),
      now: () => new Date(),
    });
  },

  /** Cron: every 5 minutes, send whatever is due in each subscriber's own time zone. */
  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      runReminders({
        now: new Date(controller.scheduledTime),
        store: createD1Store(env.DB),
        sender: createWebPushSender({
          subject: env.VAPID_SUBJECT,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        }),
        forecast: (lat, lon, timezone) => fetchDailyForecast(lat, lon, timezone),
      }).then((summary) => {
        console.log(JSON.stringify({ event: 'reminders', ...summary }));
      }),
    );
  },
} satisfies ExportedHandler<Env>;
