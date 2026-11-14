import { useState } from 'react';

import type { City } from '@/shared/api/cities-contract';
import { Button } from '@/shared/ui';

import { isSameCity, MAX_FAVORITES } from '../store/favoritesStore';
import { getFavoritesStore, useFavorites } from '../store/useFavorites';

import { RemoveFavoriteDialog } from './RemoveFavoriteDialog';
import { StarIcon } from './StarIcon';

/**
 * Save / unsave the city on screen. Unsaving asks for confirmation; focus then returns to
 * this button (the Dialog restores focus to its trigger, which stays mounted here).
 */
export function FavoriteToggle({ city }: { city: City }) {
  const { cities } = useFavorites();
  const saved = cities.some((favorite) => isSameCity(favorite, city));
  const [limitHitFor, setLimitHitFor] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<City | null>(null);

  // Derived, not stored: the message belongs to the city it was shown for, and disappears
  // as soon as the list has room again.
  const showLimit = limitHitFor === city.id && !saved && cities.length >= MAX_FAVORITES;

  const toggle = () => {
    if (saved) {
      setConfirming(cities.find((favorite) => isSameCity(favorite, city)) ?? city);
      return;
    }
    const result = getFavoritesStore().add(city);
    setLimitHitFor(result.ok ? null : result.reason === 'limit' ? city.id : null);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button aria-pressed={saved} onClick={toggle} className={saved ? 'text-accent-text' : ''}>
        <StarIcon filled={saved} />
        {saved ? 'Saved' : 'Save'}
        <span className="sr-only"> {city.name} as a favourite</span>
      </Button>
      <p role="status" className="max-w-56 text-right text-xs text-danger-fg">
        {showLimit &&
          `You already have ${String(MAX_FAVORITES)} favourites. Remove one to add ${city.name}.`}
      </p>
      <RemoveFavoriteDialog
        city={confirming}
        onCancel={() => {
          setConfirming(null);
        }}
        onConfirm={(target) => {
          getFavoritesStore().remove(target.id);
          setConfirming(null);
        }}
      />
    </div>
  );
}
