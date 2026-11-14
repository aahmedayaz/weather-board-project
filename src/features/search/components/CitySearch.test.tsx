import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { memo } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { City } from '@/shared/api/cities-contract';

import type * as CityOptionModule from './CityOption';
import { CitySearch } from './CitySearch';

/**
 * Render counting: every render of a row body is tallied per city id. The mock wraps the real
 * row body in React.memo exactly like production does, so a tally that stays flat proves the
 * parent hands rows referentially stable props (cities, callbacks, ids). The last test checks
 * production really wraps the row in React.memo.
 */
const renders = vi.hoisted(() => new Map<number, number>());

vi.mock('./CityOption', async (importOriginal) => {
  const actual = await importOriginal<typeof CityOptionModule>();
  function CountingRow(props: CityOptionModule.CityOptionProps) {
    renders.set(props.city.id, (renders.get(props.city.id) ?? 0) + 1);
    return actual.CityOptionRow(props);
  }
  return { ...actual, CityOption: memo(CountingRow) };
});

const cities: City[] = [
  { id: 1, name: 'Lisbon', region: 'Lisbon District', country: 'Portugal', lat: 38.72, lon: -9.13 },
  {
    id: 2,
    name: 'Lisburn',
    region: 'Northern Ireland',
    country: 'United Kingdom',
    lat: 54.52,
    lon: -6.05,
  },
  {
    id: 3,
    name: 'Lismore',
    region: 'New South Wales',
    country: 'Australia',
    lat: -28.81,
    lon: 153.28,
  },
];

function mockFetch() {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = new URL(typeof input === 'string' ? input : '', 'http://localhost');
    if (url.searchParams.get('q') === 'lis') return Promise.resolve(Response.json({ cities }));
    return new Promise<Response>(() => undefined); // later queries stay in flight
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderSearch(onSelect = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CitySearch onSelect={onSelect} />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), combobox: screen.getByRole('combobox', { name: 'City' }) };
}

describe('CitySearch', () => {
  beforeEach(() => {
    renders.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not re-render result rows while the user keeps typing', async () => {
    const fetchMock = mockFetch();
    const { user, combobox } = renderSearch();

    await user.type(combobox, 'lis');
    expect(await screen.findAllByRole('option')).toHaveLength(3);
    const baseline = new Map(renders);

    await user.type(combobox, 'bon');

    // The next query is in flight and the previous rows are still shown (placeholder data)…
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/cities?q=lisbon', expect.anything());
    });
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    // …and 3 keystrokes + a debounce + a new query re-rendered zero rows.
    expect(renders).toEqual(baseline);
  });

  it('re-renders only the rows whose active state changes on arrow keys', async () => {
    mockFetch();
    const { user, combobox } = renderSearch();
    await user.type(combobox, 'lis');
    await screen.findAllByRole('option');

    const before = new Map(renders);
    await user.keyboard('{ArrowDown}'); // nothing → Lisbon
    expect(renders.get(1)).toBe((before.get(1) ?? 0) + 1);
    expect(renders.get(2)).toBe(before.get(2));
    expect(renders.get(3)).toBe(before.get(3));

    await user.keyboard('{ArrowDown}'); // Lisbon → Lisburn
    expect(renders.get(1)).toBe((before.get(1) ?? 0) + 2);
    expect(renders.get(2)).toBe((before.get(2) ?? 0) + 1);
    expect(renders.get(3)).toBe(before.get(3));
    expect(combobox).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('option', { name: /Lisburn/ }).id,
    );
  });

  it('selects the active option with Enter', async () => {
    mockFetch();
    const onSelect = vi.fn();
    const { user, combobox } = renderSearch(onSelect);
    await user.type(combobox, 'lis');
    await screen.findAllByRole('option');

    await user.keyboard('{ArrowDown}{Enter}');

    expect(onSelect).toHaveBeenCalledWith(cities[0]);
    expect(combobox).toHaveValue('Lisbon');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  describe('empty-field validation', () => {
    const errorText = /Enter a city name to search\./;

    it('does not complain when the field is merely clicked in and out', async () => {
      mockFetch();
      const { user, combobox } = renderSearch();
      await user.click(combobox);
      await user.tab();
      expect(combobox).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByText(errorText)).not.toBeInTheDocument();
    });

    it('stays quiet while typing and clearing, then explains on blur', async () => {
      mockFetch();
      const { user, combobox } = renderSearch();
      await user.type(combobox, 'li');
      await user.clear(combobox);
      expect(screen.queryByText(errorText)).not.toBeInTheDocument(); // still focused

      await user.tab();
      expect(combobox).toHaveAttribute('aria-invalid', 'true');
      expect(combobox).toHaveAccessibleDescription(errorText);
    });

    it('clears the error as soon as the user is back in the field', async () => {
      mockFetch();
      const { user, combobox } = renderSearch();
      await user.type(combobox, 'li');
      await user.clear(combobox);
      await user.tab();
      expect(screen.getByText(errorText)).toBeInTheDocument();

      await user.click(combobox);
      expect(screen.queryByText(errorText)).not.toBeInTheDocument();
      expect(combobox).not.toHaveAttribute('aria-invalid');
    });

    it('shows the error when Enter is pressed on an empty field', async () => {
      mockFetch();
      const { user, combobox } = renderSearch();
      await user.click(combobox);
      await user.keyboard('{Enter}');
      expect(combobox).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('wraps the production row in React.memo', async () => {
    const actual = await vi.importActual<typeof CityOptionModule>('./CityOption');
    expect(actual.CityOption).toHaveProperty('$$typeof', Symbol.for('react.memo'));
  });
});
