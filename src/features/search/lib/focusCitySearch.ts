/** There is one city search on the page; other features focus it through this id. */
export const CITY_SEARCH_INPUT_ID = 'city-search-input';

/** Moves keyboard focus to the city search field (e.g. from a "Search another city" action). */
export function focusCitySearch(): void {
  const input = document.getElementById(CITY_SEARCH_INPUT_ID);
  input?.focus();
  input?.scrollIntoView({ block: 'nearest' });
}
