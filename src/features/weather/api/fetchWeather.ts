import { ApiErrorResponseSchema } from '@/shared/api/api-error';
import {
  WeatherBundleSchema,
  type Coordinates,
  type WeatherBundle,
} from '@/shared/api/weather-contract';

/** What the UI needs to know about a failure — each kind has its own message and action. */
export type WeatherErrorKind = 'offline' | 'rate-limited' | 'not-found' | 'server';

export class WeatherError extends Error {
  override name = 'WeatherError';
  readonly kind: WeatherErrorKind;
  /** HTTP status from /api/weather, or null when the request never got a response. */
  readonly status: number | null;

  constructor(kind: WeatherErrorKind, message: string, status: number | null = null) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

/** Kind of any thrown value; unknown errors are treated as server problems. */
export function weatherErrorKind(error: unknown): WeatherErrorKind {
  return error instanceof WeatherError ? error.kind : 'server';
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * GET /api/weather. Validates the bundle with Zod and maps every failure to a WeatherError:
 * no response → offline; 429 → rate-limited; 400/404 → not-found; 5xx or bad body → server.
 * Aborts are rethrown untouched so TanStack Query can drop superseded requests quietly.
 */
export async function fetchWeather(
  { lat, lon }: Coordinates,
  signal: AbortSignal,
): Promise<WeatherBundle> {
  let response: Response;
  try {
    response = await fetch(`/api/weather?lat=${String(lat)}&lon=${String(lon)}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new WeatherError('offline', 'No response from the weather service.');
  }

  const body = await readJson(response);

  if (response.ok) {
    const bundle = WeatherBundleSchema.safeParse(body);
    if (!bundle.success) {
      throw new WeatherError('server', 'Unexpected weather response.', response.status);
    }
    return bundle.data;
  }

  const apiError = ApiErrorResponseSchema.safeParse(body);
  const message = apiError.success
    ? apiError.data.error.message
    : `HTTP ${String(response.status)}`;
  if (response.status === 429) throw new WeatherError('rate-limited', message, 429);
  if (response.status === 404 || response.status === 400) {
    throw new WeatherError('not-found', message, response.status);
  }
  throw new WeatherError('server', message, response.status);
}
