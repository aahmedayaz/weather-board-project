import { useCallback, useState } from 'react';

import { CitySearch, focusCitySearch, formatCityDetail, type City } from '@/features/search';
import { CurrentConditions, ForecastStrip } from '@/features/weather';
import { Card, DashboardGrid } from '@/shared/ui';

import { AppShell } from './AppShell';
import { readLastCity, saveLastCity } from './lastCity';

export function App() {
  // Lazy initializer: storage is read once, on mount — not on every render.
  const [city, setCity] = useState<City>(readLastCity);

  // Stable (no deps) so CitySearch's memoized rows keep skipping re-renders.
  const selectCity = useCallback((next: City) => {
    setCity(next);
    saveLastCity(next);
  }, []);

  return (
    <AppShell>
      <DashboardGrid>
        <Card title="Find a city" className="md:col-span-2 xl:col-span-4">
          <CitySearch onSelect={selectCity} />
        </Card>

        <CurrentConditions
          city={city}
          placeDetail={formatCityDetail(city)}
          onSearchAgain={focusCitySearch}
          className="md:col-span-2 xl:col-span-8"
        />

        <ForecastStrip
          city={city}
          onSearchAgain={focusCitySearch}
          className="md:col-span-2 xl:col-span-12"
        />
      </DashboardGrid>
    </AppShell>
  );
}
