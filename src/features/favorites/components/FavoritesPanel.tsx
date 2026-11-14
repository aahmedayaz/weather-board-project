import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';

import type { City } from '@/shared/api/cities-contract';
import { cn } from '@/shared/lib/cn';
import { Banner, Card } from '@/shared/ui';

import { isSameCity, MAX_FAVORITES } from '../store/favoritesStore';
import { getFavoritesStore, useFavorites } from '../store/useFavorites';

import { CloseIcon } from './StarIcon';

// Loaded on first use: the confirmation Dialog isn't needed for the first render.
const RemoveFavoriteDialog = lazy(() =>
  import('./RemoveFavoriteDialog').then((module) => ({ default: module.RemoveFavoriteDialog })),
);

export interface FavoritesPanelProps {
  activeCity: City;
  /** Must be stable. */
  onSelect: (city: City) => void;
  /** Warm the cache for a city the user is about to pick (hover / keyboard focus). */
  onPrefetch: (city: City) => void;
  /** Where focus goes when the last favourite is removed (e.g. the city search). */
  onListEmptied: () => void;
  className?: string;
}

/**
 * Quick access: horizontal, scrollable chips on phones; a vertical sidebar list at 1280 px.
 * Every chip is two real buttons (select, remove), so it all works by keyboard.
 */
export function FavoritesPanel({
  activeCity,
  onSelect,
  onPrefetch,
  onListEmptied,
  className,
}: FavoritesPanelProps) {
  const { cities, persistent } = useFavorites();
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [confirming, setConfirming] = useState<City | null>(null);
  // Where focus goes after a confirmed removal. A ref (set in the handler, consumed after the
  // commit) instead of state: no extra render, and the effect runs after the Dialog's own
  // cleanup has lifted `inert` from the page — an inert element can't take focus.
  const pendingFocus = useRef<{ kind: 'chip'; id: string } | { kind: 'emptied' } | null>(null);
  const idPrefix = useId();
  const selectButtonId = (city: City) => `${idPrefix}-select-${String(city.id)}`;

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target.kind === 'emptied') onListEmptied();
    else document.getElementById(target.id)?.focus();
  });

  const confirmRemoval = (city: City) => {
    const index = cities.findIndex((saved) => saved.id === city.id);
    // Sensible next focus: the chip that slides into its place, else the previous one,
    // else (list now empty) the city search.
    const next = cities[index + 1] ?? cities[index - 1];
    pendingFocus.current = next ? { kind: 'chip', id: selectButtonId(next) } : { kind: 'emptied' };
    getFavoritesStore().remove(city.id);
    setConfirming(null);
  };

  return (
    <Card
      title="Favourites"
      description={`${String(cities.length)} of ${String(MAX_FAVORITES)}`}
      className={className}
    >
      {!persistent && !noticeDismissed && (
        <Banner
          tone="warning"
          title="Favourites won’t be saved"
          action={{
            label: 'Dismiss',
            onAction: () => {
              setNoticeDismissed(true);
            },
          }}
          className="mb-3"
        >
          This browser is blocking storage (for example in a private window), so favourites last
          only until you close this tab.
        </Banner>
      )}

      {cities.length === 0 ? (
        <p className="text-sm text-fg-muted">
          No favourites yet. Use <span className="font-medium text-fg">Save</span> on a city’s
          weather to keep it here for quick access.
        </p>
      ) : (
        <ul
          aria-label="Favourite cities"
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 xl:flex-col xl:overflow-visible"
        >
          {cities.map((city) => {
            const active = isSameCity(city, activeCity);
            return (
              <li
                key={city.id}
                className={cn(
                  'flex shrink-0 items-stretch rounded-md border xl:w-full',
                  active ? 'border-accent bg-surface-muted' : 'border-line',
                )}
              >
                <button
                  id={selectButtonId(city)}
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => {
                    onSelect(city);
                  }}
                  onPointerEnter={() => {
                    onPrefetch(city);
                  }}
                  onFocus={() => {
                    onPrefetch(city);
                  }}
                  className="flex min-h-11 min-w-0 flex-1 flex-col justify-center rounded-l-md px-3 py-1.5 text-left md:pointer-fine:min-h-9"
                >
                  <span className="truncate text-sm font-medium text-fg">{city.name}</span>
                  <span className="hidden truncate text-xs text-fg-muted xl:block">
                    {city.region ? `${city.region}, ${city.country}` : city.country}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${city.name} from favourites`}
                  onClick={() => {
                    setConfirming(city);
                  }}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-r-md text-fg-muted hover:bg-surface-muted hover:text-fg md:pointer-fine:min-h-9 md:pointer-fine:min-w-9"
                >
                  <CloseIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {confirming && (
        <Suspense fallback={null}>
          <RemoveFavoriteDialog
            city={confirming}
            onCancel={() => {
              setConfirming(null); // Dialog returns focus to the × that opened it
            }}
            onConfirm={confirmRemoval}
          />
        </Suspense>
      )}
    </Card>
  );
}
