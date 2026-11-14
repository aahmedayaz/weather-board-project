import { useCallback, useState } from 'react';

import { FavoritesPanel, FavoriteToggle } from '@/features/favorites';
import { InstallButton, OfflineBanner, UpdateToast } from '@/features/pwa';
import { ReminderCard } from '@/features/push';
import { CitySearch, focusCitySearch, formatCityDetail, type City } from '@/features/search';
import { CurrentConditions, ForecastStrip, usePrefetchWeather } from '@/features/weather';
import { Card, DashboardGrid } from '@/shared/ui';

import { AppShell } from './AppShell';
import { readLastCity, saveLastCity } from './lastCity';

export function App({ initialCity }: { initialCity?: City }) {
  // Lazy initializer: storage is read once, on mount — not on every render.
  const [city, setCity] = useState<City>(() => initialCity ?? readLastCity());
  const prefetchWeather = usePrefetchWeather();

  // Stable (no deps) so memoized children (search rows) keep skipping re-renders.
  const selectCity = useCallback((next: City) => {
    setCity(next);
    saveLastCity(next);
  }, []);

  // Layout: at 1280 px the left 4 columns hold search + the favourites sidebar and the right
  // 8 hold the weather. Below that, DOM order applies: search, favourite chips, weather.
  return (
    <AppShell headerActions={<InstallButton />}>
      <OfflineBanner />
      <DashboardGrid>
        <Card title="Find a city" className="md:col-span-2 xl:col-span-4 xl:row-start-1">
          <CitySearch onSelect={selectCity} />
        </Card>

        <FavoritesPanel
          activeCity={city}
          onSelect={selectCity}
          onPrefetch={prefetchWeather}
          onListEmptied={focusCitySearch}
          className="md:col-span-2 xl:col-span-4 xl:row-start-2 xl:self-start"
        />

        <CurrentConditions
          city={city}
          placeDetail={formatCityDetail(city)}
          onSearchAgain={focusCitySearch}
          extraActions={<FavoriteToggle city={city} />}
          className="md:col-span-2 xl:col-span-8 xl:col-start-5 xl:row-start-1"
        />

        <ForecastStrip
          city={city}
          onSearchAgain={focusCitySearch}
          className="md:col-span-2 xl:col-span-8 xl:col-start-5 xl:row-start-2"
        />

        <ReminderCard city={city} className="md:col-span-2 xl:col-span-4 xl:row-start-3" />
      </DashboardGrid>
      <UpdateToast />
    </AppShell>
  );
}
