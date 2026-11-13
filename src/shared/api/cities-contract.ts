/**
 * Contract for GET /api/cities, shared by the Vercel function (api/) and the client.
 * This file must only import `zod`: it is compiled for both the browser and Node.
 */
import { z } from 'zod';

export const CITY_QUERY_MIN = 2;
export const CITY_QUERY_MAX = 60;

export const CityQuerySchema = z
  .string()
  .trim()
  .min(CITY_QUERY_MIN, `Enter at least ${String(CITY_QUERY_MIN)} characters.`)
  .max(CITY_QUERY_MAX, `Use at most ${String(CITY_QUERY_MAX)} characters.`);

export const CitySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  region: z.string().nullable(),
  country: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type City = z.infer<typeof CitySchema>;

export const CitiesResponseSchema = z.object({ cities: z.array(CitySchema) });
export type CitiesResponse = z.infer<typeof CitiesResponseSchema>;

export const ApiErrorCodeSchema = z.enum([
  'INVALID_QUERY',
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
