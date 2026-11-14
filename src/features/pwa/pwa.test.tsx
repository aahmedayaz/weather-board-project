import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InstallButton } from './components/InstallButton';
import { UpdateToast } from './components/UpdateToast';
import { listenForInstallPrompt, notifyUpdateAvailable } from './pwaStore';

describe('update toast', () => {
  it('appears when a new version is waiting and applies it on Reload', async () => {
    const applyUpdate = vi.fn(() => Promise.resolve());
    render(<UpdateToast />);
    expect(screen.queryByText(/A new version is available/)).not.toBeInTheDocument();

    act(() => {
      notifyUpdateAvailable(applyUpdate);
    });
    expect(screen.getByRole('status')).toHaveTextContent('A new version is available.');

    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(applyUpdate).toHaveBeenCalledOnce();
    expect(screen.queryByText(/A new version is available/)).not.toBeInTheDocument();
  });

  it('can be postponed with Later', async () => {
    const applyUpdate = vi.fn(() => Promise.resolve());
    render(<UpdateToast />);
    act(() => {
      notifyUpdateAvailable(applyUpdate);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(applyUpdate).not.toHaveBeenCalled();
    expect(screen.queryByText(/A new version is available/)).not.toBeInTheDocument();
  });
});

describe('install button', () => {
  it('stays hidden until the browser offers installation, then prompts once', async () => {
    const target = new EventTarget();
    listenForInstallPrompt(target as Window);
    render(<InstallButton />);
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();

    const prompt = vi.fn(() => Promise.resolve());
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    });
    act(() => {
      target.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true); // the browser's own mini-infobar is suppressed

    await userEvent.click(screen.getByRole('button', { name: 'Install app' }));
    expect(prompt).toHaveBeenCalledOnce();
    expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument();
  });
});
