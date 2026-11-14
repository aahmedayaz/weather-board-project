import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import { memo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { lisbon, makeBundle } from '@/test/weatherFixtures';

import { weatherQueryOptions } from '../api/weatherQuery';

import type * as ForecastDayModule from './ForecastDay';
import { ForecastStrip } from './ForecastStrip';

/**
 * Measurement behind `ForecastDay = memo(...)`.
 * The mock counts every render of a day row and can serve it with or without React.memo
 * (`probe.memo`), so the same scenario is measured both ways.
 */
const probe = vi.hoisted(() => ({ renders: new Map<string, number>(), memo: true }));

vi.mock('./ForecastDay', async (importOriginal) => {
  const actual = await importOriginal<typeof ForecastDayModule>();
  function CountingDay(props: ForecastDayModule.ForecastDayProps) {
    probe.renders.set(props.day.date, (probe.renders.get(props.day.date) ?? 0) + 1);
    return actual.ForecastDayRow(props);
  }
  const MemoizedCountingDay = memo(CountingDay);
  return {
    ...actual,
    get ForecastDay() {
      return probe.memo ? MemoizedCountingDay : CountingDay;
    },
  };
});

const queryKey = weatherQueryOptions(lisbon).queryKey;
const totalRenders = () => [...probe.renders.values()].reduce((sum, count) => sum + count, 0);

function renderStrip(client: QueryClient) {
  render(
    <QueryClientProvider client={client}>
      <ForecastStrip city={lisbon} onSearchAgain={vi.fn()} />
    </QueryClientProvider>,
  );
}

/** Mounts with data, applies `update`, returns how many day rows re-rendered. */
async function measure(withMemo: boolean, update: (client: QueryClient) => void): Promise<number> {
  probe.memo = withMemo;
  probe.renders.clear();
  const client = new QueryClient();
  client.setQueryData(queryKey, makeBundle());
  renderStrip(client);
  const afterMount = totalRenders();
  // TanStack batches observer notifications on a timer; an async act flushes them.
  await act(async () => {
    update(client);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return totalRenders() - afterMount;
}

/** A refetch where only Monday (day 3) changed. */
const oneDayChanges = (client: QueryClient) => {
  const next = makeBundle();
  const monday = next.daily[2];
  if (monday) monday.maxC = 25;
  client.setQueryData(queryKey, next);
};
/** A refetch that returns deep-equal data. */
const nothingChanges = (client: QueryClient) => {
  client.setQueryData(queryKey, makeBundle());
};

describe('ForecastStrip', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('no network in this test'))),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    probe.memo = true;
  });

  it('measured: memo cuts day re-renders from 5 to 1 when a refetch changes one day', async () => {
    const withoutMemo = await measure(false, oneDayChanges);
    document.body.innerHTML = '';
    const withMemo = await measure(true, oneDayChanges);

    expect({ withoutMemo, withMemo }).toEqual({ withoutMemo: 5, withMemo: 1 });
  });

  it('measured: an identical refetch re-renders no days at all, with or without memo', async () => {
    // Structural sharing keeps the selected slice's reference, so the strip itself doesn't
    // re-render — this case doesn't need memo, the one above does.
    expect(await measure(false, nothingChanges)).toBe(0);
    document.body.innerHTML = '';
    expect(await measure(true, nothingChanges)).toBe(0);
  });

  it('labels the location’s today as "Today" and lists five days', () => {
    const client = new QueryClient();
    client.setQueryData(queryKey, makeBundle());
    renderStrip(client);

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent(/^Today/);
    expect(items[1]).toHaveTextContent('Rain');
    expect(items[1]).toHaveTextContent('80%');
    expect(screen.getByText('Weather data: OpenWeatherMap')).toBeInTheDocument();
  });

  it('wraps the production row in React.memo', async () => {
    const actual = await vi.importActual<typeof ForecastDayModule>('./ForecastDay');
    expect(actual.ForecastDay).toHaveProperty('$$typeof', Symbol.for('react.memo'));
  });
});
