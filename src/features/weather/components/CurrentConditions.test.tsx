import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { lisbon, makeBundle } from '@/test/weatherFixtures';

import { CurrentConditions } from './CurrentConditions';

function stubFetch(...responses: (Response | Error)[]) {
  const fetchMock = vi.fn(() => {
    const next = responses.length > 1 ? responses.shift() : responses[0];
    if (next === undefined) return Promise.reject(new Error('no response configured'));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next.clone());
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const apiError = (status: number, code: string) =>
  Response.json({ error: { code, message: code } }, { status });

function renderCurrent(onSearchAgain = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CurrentConditions
        city={lisbon}
        placeDetail="Lisbon District, Portugal"
        onSearchAgain={onSearchAgain}
      />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), onSearchAgain };
}

describe('CurrentConditions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    onlineManager.setOnline(true);
  });

  it('shows an announced skeleton while loading', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    );
    renderCurrent();
    const label = screen.getByText('Loading current conditions for Lisbon…');
    expect(label.closest('[role="status"]')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders conditions from the bundle', async () => {
    stubFetch(Response.json(makeBundle()));
    renderCurrent();
    expect(await screen.findByText('20°')).toBeInTheDocument(); // 19.6 rounded
    expect(screen.getByText('Partly cloudy')).toBeInTheDocument();
    expect(screen.getByText('18 km/h')).toBeInTheDocument(); // 5 m/s
    expect(screen.getByText('64%')).toBeInTheDocument();
  });

  it('offline (no response): explains and retries', async () => {
    const fetchMock = stubFetch(new TypeError('Failed to fetch'), Response.json(makeBundle()));
    const { user } = renderCurrent();

    expect(await screen.findByText('You’re offline')).toBeInTheDocument();
    expect(screen.getByText(/Couldn’t load current conditions for Lisbon/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // offline is never auto-retried

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('20°')).toBeInTheDocument();
  });

  it('offline (browser reports no network): shows the offline state without fetching', async () => {
    const fetchMock = stubFetch(Response.json(makeBundle()));
    onlineManager.setOnline(false);
    renderCurrent();
    expect(await screen.findByText('You’re offline')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      onlineManager.setOnline(true); // TanStack resumes the paused query on reconnect
    });
    expect(await screen.findByText('20°')).toBeInTheDocument();
  });

  it('rate limited: explains and does not retry automatically', async () => {
    const fetchMock = stubFetch(apiError(429, 'RATE_LIMITED'));
    renderCurrent();
    expect(await screen.findByText('Too many weather requests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('city not found: offers to search another city, without retrying', async () => {
    const fetchMock = stubFetch(apiError(404, 'NOT_FOUND'));
    const { user, onSearchAgain } = renderCurrent();

    expect(await screen.findByText('No weather found for Lisbon')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Search another city' }));
    expect(onSearchAgain).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('server problem: retries 3 times with backoff, then explains and offers a retry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = stubFetch(apiError(502, 'UPSTREAM_ERROR'));
    renderCurrent();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // first retry waits 1 s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500 + 2000 + 4000 + 100); // rest of 1 s + 2 s + 4 s
    });

    expect(await screen.findByText('Weather service problem')).toBeInTheDocument();
    expect(screen.getByText(/This is on our side, not yours/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
