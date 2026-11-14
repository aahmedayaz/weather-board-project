import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { lisbon, makeBundle } from '@/test/weatherFixtures';

import { weatherQueryOptions } from '../api/weatherQuery';

import { RefreshButton } from './RefreshButton';

describe('RefreshButton', () => {
  let fetchMock: Mock<() => Promise<Response>>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchMock = vi.fn(() => Promise.resolve(Response.json(makeBundle())));
    vi.stubGlobal('fetch', fetchMock);

    const client = new QueryClient();
    client.setQueryData(weatherQueryOptions(lisbon).queryKey, makeBundle());
    render(
      <QueryClientProvider client={client}>
        <RefreshButton coordinates={lisbon} />
      </QueryClientProvider>,
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** One second at a time: each countdown tick is scheduled after React commits the last. */
  async function tick(seconds: number) {
    for (let elapsed = 0; elapsed < seconds; elapsed += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
  }

  const user = () => userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
  const button = () => screen.getByRole('button', { name: /Refresh/ });

  it('refetches at most once per 10 seconds, with a visible countdown', async () => {
    await user().click(button());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/^Updated /)).toBeInTheDocument();

    expect(button()).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText('Refresh again in 10s')).toBeInTheDocument();

    await user().click(button()); // ignored during cooldown
    await tick(3);
    expect(screen.getByText('Refresh again in 7s')).toBeInTheDocument();
    await user().click(button());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await tick(7);
    expect(screen.queryByText(/Refresh again in/)).not.toBeInTheDocument();
    expect(button()).toHaveAttribute('aria-disabled', 'false');

    await user().click(button());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows "Refreshing…" while the request is in flight and keeps focus on the button', async () => {
    let resolve: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    await user().click(button());

    expect(button()).toHaveTextContent('Refreshing…');
    expect(button()).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent('Refreshing…');

    await act(async () => {
      resolve(Response.json(makeBundle()));
      await Promise.resolve();
    });
    expect(await screen.findByText(/^Updated /)).toBeInTheDocument();
  });
});
