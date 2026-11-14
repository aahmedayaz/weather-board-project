import { Suspense, useCallback, useState } from 'react';

import { FavoritesPanel, FavoriteToggle } from '@/features/favorites';
import { InstallButton, OfflineBanner, UpdateToast } from '@/features/pwa';
import { DisplaySettings } from '@/features/settings';
import { isPushConfigured, ReminderCard } from '@/features/push';
import { CitySearch, focusCitySearch, formatCityDetail, type City } from '@/features/search';
import { CurrentConditions, ForecastStrip, usePrefetchWeather } from '@/features/weather';
import { Card, DashboardGrid, Skeleton } from '@/shared/ui';

import { AppShell } from './AppShell';
import { ProfiledRegion } from './ProfiledRegion';
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

  // Layout: at 1280 px the left 4 columns stack search, the favourites sidebar and the daily
  // reminder; the right 8 hold the weather. Below that, DOM order applies: search, favourite
  // chips, weather, reminder.
  return (
    <AppShell
      headerActions={
        <ProfiledRegion id="Header">
          <InstallButton />
          <DisplaySettings />
        </ProfiledRegion>
      }
    >
      <OfflineBanner />
      <DashboardGrid>
        <ProfiledRegion id="Search">
          <Card title="Find a city" className="md:col-span-2 xl:col-span-4 xl:row-start-1">
            <CitySearch onSelect={selectCity} />
          </Card>
        </ProfiledRegion>

        <ProfiledRegion id="Favorites">
          <FavoritesPanel
            activeCity={city}
            onSelect={selectCity}
            onPrefetch={prefetchWeather}
            onListEmptied={focusCitySearch}
            className="md:col-span-2 xl:col-span-4 xl:row-start-2 xl:self-start"
          />
        </ProfiledRegion>

        <ProfiledRegion id="Current">
          <CurrentConditions
            city={city}
            placeDetail={formatCityDetail(city)}
            onSearchAgain={focusCitySearch}
            extraActions={<FavoriteToggle city={city} />}
            className="md:col-span-2 xl:col-span-8 xl:col-start-5 xl:row-start-1"
          />
        </ProfiledRegion>

        <ProfiledRegion id="Forecast">
          <ForecastStrip
            city={city}
            onSearchAgain={focusCitySearch}
            // Spans rows 2–3 so the left column (favourites, then reminders) stacks with
            // normal spacing instead of row 3 starting below the forecast; self-start keeps
            // the card its natural height rather than stretching it.
            className="md:col-span-2 xl:col-span-8 xl:col-start-5 xl:row-span-2 xl:row-start-2 xl:self-start"
          />
        </ProfiledRegion>

        {isPushConfigured() && (
          <Suspense
            fallback={
              <Card title="Daily reminder" className="md:col-span-2 xl:col-span-4 xl:row-start-3">
                <Skeleton className="h-11 w-48" />
              </Card>
            }
          >
            <ReminderCard city={city} className="md:col-span-2 xl:col-span-4 xl:row-start-3" />
          </Suspense>
        )}
      </DashboardGrid>
      <UpdateToast />
    </AppShell>
  );
}
