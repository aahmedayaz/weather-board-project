import { useState } from 'react';

import { CitySearch, formatCityDetail, type City } from '@/features/search';
import { Card, DashboardGrid } from '@/shared/ui';

import { AppShell } from './AppShell';

export function App() {
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  return (
    <AppShell>
      <DashboardGrid>
        <Card title="Find a city" className="md:col-span-2 xl:col-span-5">
          {/* setSelectedCity is a stable setter → CitySearch's row memoization holds. */}
          <CitySearch onSelect={setSelectedCity} />
        </Card>

        {selectedCity ? (
          <Card title={selectedCity.name} className="md:col-span-2 xl:col-span-7">
            <p className="text-sm text-fg-muted">{formatCityDetail(selectedCity)}</p>
            <p className="mt-2 numeric text-sm text-fg-muted">
              {selectedCity.lat.toFixed(4)}, {selectedCity.lon.toFixed(4)}
            </p>
          </Card>
        ) : (
          <Card title="No city selected yet" className="md:col-span-2 xl:col-span-7">
            <p className="text-sm text-fg-muted">
              Search for a city to see its current conditions and forecast here.
            </p>
          </Card>
        )}
      </DashboardGrid>
    </AppShell>
  );
}
