/**
 * Error body returned by every /api/* function. Shared by the server (api/) and the client.
 * Only imports `zod` and uses `.js` specifiers so it compiles for the browser and for Node.
 */
import { z } from 'zod';

export const ApiErrorCodeSchema = z.enum([
  'INVALID_QUERY',
  'INVALID_COORDINATES',
  'NOT_FOUND',
  'RATE_LIMITED',
  'UPSTREAM_ERROR',
  'UPSTREAM_UNAVAILABLE',
  'SERVER_MISCONFIGURED',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    retryAfterSeconds: z.number().int().positive().optional(),
  }),
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
