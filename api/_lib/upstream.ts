/** Shared helpers for calling third-party APIs from Vercel Functions. */

export const UPSTREAM_TIMEOUT_MS = 5_000;

export type UpstreamFailure =
  | { kind: 'network' }
  | { kind: 'http'; status: number; retryAfterSeconds: number | null }
  | { kind: 'invalid-response' };

export type UpstreamResult = { ok: true; data: unknown } | { ok: false; failure: UpstreamFailure };

function parseRetryAfter(header: string | null): number | null {
  const seconds = Number(header);
  if (header === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(Math.ceil(seconds), 300);
}

/**
 * GET a JSON resource. Never throws: network errors, timeouts, non-2xx responses and
 * unparseable bodies all come back as a typed failure.
 */
export async function fetchJson(
  fetchImpl: typeof fetch,
  url: URL,
  signal: AbortSignal,
  headers: Record<string, string> = {},
): Promise<UpstreamResult> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json', ...headers },
      signal: AbortSignal.any([signal, AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)]),
    });
  } catch {
    return { ok: false, failure: { kind: 'network' } };
  }

  if (!response.ok) {
    return {
      ok: false,
      failure: {
        kind: 'http',
        status: response.status,
        retryAfterSeconds: parseRetryAfter(response.headers.get('Retry-After')),
      },
    };
  }

  try {
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, failure: { kind: 'invalid-response' } };
  }
}
