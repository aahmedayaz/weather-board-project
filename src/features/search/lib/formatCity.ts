import type { City } from '@/shared/api/cities-contract';

/** "Lisbon District, Portugal", or just the country when GeoDB has no region. */
export function formatCityDetail(city: City): string {
  return city.region ? `${city.region}, ${city.country}` : city.country;
}
