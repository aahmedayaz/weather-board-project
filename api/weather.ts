import { handleWeatherRequest } from './_lib/weather-handler.js';

/** Vercel Function (Web signature). Logic lives in _lib/weather-handler.ts. */
export function GET(request: Request): Promise<Response> {
  return handleWeatherRequest(request, { env: process.env, fetch });
}
