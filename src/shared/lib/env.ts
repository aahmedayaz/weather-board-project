import { z } from 'zod';

/** Treat `VAR=` (empty in .env files) the same as an unset variable. */
const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

/**
 * Client-side environment. Everything here is inlined into the public bundle by Vite,
 * so only non-secret `VITE_*` values belong in this schema.
 */
export const EnvSchema = z.object({
  /** Public VAPID key for Web Push (the private key lives only in the worker). */
  VITE_VAPID_PUBLIC_KEY: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^[A-Za-z0-9_-]{80,100}$/, 'must be a base64url VAPID public key')
      .optional(),
  ),
  /** Origin of the push worker (worker/). Reminders are hidden when unset. */
  VITE_PUSH_WORKER_URL: z.preprocess(
    emptyToUndefined,
    z.url({ protocol: /^https?$/, error: 'must be an http(s) URL' }).optional(),
  ),
});

export type Env = z.infer<typeof EnvSchema>;

export class EnvError extends Error {
  override name = 'EnvError';
}

export function parseEnv(source: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    throw new EnvError(
      `Invalid environment variables:\n${z.prettifyError(result.error)}\n` +
        'Copy .env.example to .env.local and fill in the values.',
    );
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated env, parsed once on first use. Throws `EnvError` with every problem listed. */
export function getEnv(): Env {
  cached ??= parseEnv(import.meta.env);
  return cached;
}
