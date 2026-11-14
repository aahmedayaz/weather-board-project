/**
 * Re-render audit (React Profiler). Renders the real app, performs the interactions below and
 * records which dashboard regions commit. Run `npx vitest run src/app/renderAudit` to print
 * the table; the assertions pin the expected (minimal) set of regions per interaction.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { makeBundle } from '@/test/weatherFixtures';

import { App } from './App';
import { AppProviders } from './AppProviders';
import { startRecording, stopRecording, type RenderSample } from './renderProfile';

const cities = [
  { id: 1, name: 'Lisbon', region: 'Lisbon District', country: 'Portugal', lat: 38.72, lon: -9.13 },
  {
    id: 2,
    name: 'Lisburn',
    region: 'Northern Ireland',
    country: 'United Kingdom',
    lat: 54.52,
    lon: -6.05,
  },
];

interface Row {
  interaction: string;
  regions: Record<string, { commits: number; ms: number }>;
}
const rows: Row[] = [];

/**
 * A sample with ~0 ms actual duration is React reporting a scheduled update that bailed out
 * (nothing rendered) — e.g. an external-store notification with an unchanged snapshot.
 * Those are counted as "bail-outs", not renders.
 */
const BAILOUT_MS = 0.05;
const bailouts: Record<string, number> = {};

function tally(samples: RenderSample[], interaction: string): Row['regions'] {
  const regions: Row['regions'] = {};
  for (const sample of samples) {
    if (sample.actualDuration < BAILOUT_MS) {
      const key = `${interaction}: ${sample.region}`;
      bailouts[key] = (bailouts[key] ?? 0) + 1;
      continue;
    }
    const entry = (regions[sample.region] ??= { commits: 0, ms: 0 });
    entry.commits += 1;
    entry.ms += sample.actualDuration;
  }
  return regions;
}

async function measure(interaction: string, run: () => Promise<void>) {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50)); // let earlier work settle
  });
  startRecording();
  await run();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 200)); // debounce + query notify
  });
  const regions = tally(stopRecording(), interaction);
  rows.push({ interaction, regions });
  return Object.keys(regions).sort();
}

describe('render audit', () => {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('/api/cities')) return Promise.resolve(Response.json({ cities }));
    return Promise.resolve(Response.json(makeBundle()));
  });
  let user: ReturnType<typeof userEvent.setup>;

  beforeAll(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  // A fresh app per interaction (the shared setup unmounts after every test).
  beforeEach(async () => {
    window.localStorage.clear();
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );
    user = userEvent.setup();
    // Wait until weather has rendered (humidity is unique on the page).
    await screen.findByText('64%');
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    const names = ['Header', 'Search', 'Favorites', 'Current', 'Forecast'];
    const lines = rows.map(
      (row) =>
        `| ${row.interaction.padEnd(26)} | ${names
          .map((name) => {
            const region = row.regions[name];
            return region ? `${String(region.commits)} (${region.ms.toFixed(1)} ms)` : '—';
          })
          .map((cell) => cell.padEnd(12))
          .join(' | ')} |`,
    );
    console.info(
      [
        `| Interaction                | ${names.map((name) => name.padEnd(12)).join(' | ')} |`,
        `| -------------------------- | ${names.map(() => '-'.repeat(12)).join(' | ')} |`,
        ...lines,
        '',
        `Bail-outs (update scheduled, nothing rendered): ${JSON.stringify(bailouts)}`,
      ].join('\n'),
    );
  });

  it('typing in search re-renders only the search region', async () => {
    const regions = await measure('Search typing ("lis")', async () => {
      await user.type(screen.getByRole('combobox', { name: 'City' }), 'lis');
      await screen.findAllByRole('option');
    });
    expect(regions).toEqual(['Search']);
  });

  it('a weather refresh re-renders only the current-conditions card', async () => {
    const calls = fetchMock.mock.calls.length;
    const regions = await measure('Weather refresh', async () => {
      await user.click(screen.getByRole('button', { name: /^Refresh/ }));
      await waitFor(() => {
        expect(fetchMock.mock.calls.length).toBeGreaterThan(calls);
      });
    });
    // Same data back → structural sharing keeps every selected slice; only the refresh
    // button (inside Current) changes state.
    expect(regions).toEqual(['Current']);
  });

  it('toggling a favourite re-renders only the toggle and the favourites panel', async () => {
    const regions = await measure('Favourite toggle (save)', async () => {
      await user.click(screen.getByRole('button', { name: /as a favourite$/ }));
      await screen.findByRole('list', { name: 'Favourite cities' });
    });
    expect(regions).toEqual(['Current', 'Favorites']);
  });

  it('switching theme re-renders only the header controls', async () => {
    const regions = await measure('Theme switch (dark)', async () => {
      await user.click(screen.getByRole('button', { name: 'Dark theme' }));
    });
    expect(regions).toEqual(['Header']);
  });

  it('switching units re-renders only regions that display units', async () => {
    const regions = await measure('Units switch (°F)', async () => {
      await user.click(screen.getByRole('button', { name: '°F' }));
    });
    expect(regions).toEqual(['Current', 'Forecast', 'Header']);
  });
});
