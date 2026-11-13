import { handleCitiesRequest } from './_lib/cities-handler.js';

/** Vercel Function (Web signature). Logic lives in _lib/cities-handler.ts. */
export function GET(request: Request): Promise<Response> {
  return handleCitiesRequest(request, { env: process.env, fetch });
}
