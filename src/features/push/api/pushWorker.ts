import { z } from 'zod';

const OkSchema = z.object({ ok: z.literal(true) });
const ErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

export class PushWorkerError extends Error {
  override name = 'PushWorkerError';
}

export interface SubscribeRequest {
  subscription: PushSubscriptionJSON;
  reminderTime: string;
  timezone: string;
  city: { name: string; lat: number; lon: number };
}

async function post(workerUrl: string, path: string, body: unknown): Promise<void> {
  let response: Response;
  try {
    response = await fetch(new URL(path, workerUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new PushWorkerError('Couldn’t reach the reminder service. Check your connection.');
  }
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // handled below
  }
  if (response.ok && OkSchema.safeParse(json).success) return;
  const parsed = ErrorSchema.safeParse(json);
  throw new PushWorkerError(
    parsed.success
      ? `The reminder service refused the request (${parsed.data.error.code}).`
      : `The reminder service failed (HTTP ${String(response.status)}).`,
  );
}

export const registerReminder = (workerUrl: string, body: SubscribeRequest) =>
  post(workerUrl, '/subscribe', body);

export const unregisterReminder = (workerUrl: string, endpoint: string) =>
  post(workerUrl, '/unsubscribe', { endpoint });
