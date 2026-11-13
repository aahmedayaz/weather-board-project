import { Card, DashboardGrid } from '@/shared/ui';

import { AppShell } from './AppShell';

export function App() {
  return (
    <AppShell>
      <DashboardGrid>
        {/* Empty state until the search and weather features land. No placeholder data. */}
        <Card title="No city selected yet" className="md:col-span-2 xl:col-span-12">
          <p className="text-sm text-fg-muted">
            Search for a city to see its current conditions and forecast here.
          </p>
        </Card>
      </DashboardGrid>
    </AppShell>
  );
}
