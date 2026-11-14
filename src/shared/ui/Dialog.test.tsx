import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './Button';
import { Dialog } from './Dialog';

function ConfirmRemoval({
  onConfirm = vi.fn(),
  focusConfirm = false,
}: {
  onConfirm?: () => void;
  focusConfirm?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
  };
  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
        }}
      >
        Remove Lisbon
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title="Remove Lisbon from favorites?"
        description="You can add it again from search."
        {...(focusConfirm ? { initialFocusRef: confirmRef } : {})}
        actions={
          <>
            <Button onClick={close}>Cancel</Button>
            <Button
              ref={confirmRef}
              variant="danger"
              onClick={() => {
                onConfirm();
                close();
              }}
            >
              Remove
            </Button>
          </>
        }
      />
    </>
  );
}

async function openDialog() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Remove Lisbon' }));
  return user;
}

describe('Dialog', () => {
  it('is a labelled, described modal dialog', async () => {
    render(<ConfirmRemoval />);
    await openDialog();
    const dialog = screen.getByRole('dialog', { name: 'Remove Lisbon from favorites?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('You can add it again from search.');
  });

  it('moves focus to the first action (Cancel) on open', async () => {
    render(<ConfirmRemoval />);
    await openDialog();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('honours initialFocusRef', async () => {
    render(<ConfirmRemoval focusConfirm />);
    await openDialog();
    expect(screen.getByRole('button', { name: 'Remove' })).toHaveFocus();
  });

  it('traps Tab and Shift+Tab inside the dialog', async () => {
    render(<ConfirmRemoval />);
    const user = await openDialog();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const remove = screen.getByRole('button', { name: 'Remove' });

    await user.tab();
    expect(remove).toHaveFocus();
    await user.tab(); // wraps forward
    expect(cancel).toHaveFocus();
    await user.tab({ shift: true }); // wraps backward
    expect(remove).toHaveFocus();
  });

  it('makes the page behind the dialog inert while open', async () => {
    const { container } = render(<ConfirmRemoval />);
    await openDialog();
    expect(container).toHaveAttribute('inert');
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { container } = render(<ConfirmRemoval />);
    const user = await openDialog();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container).not.toHaveAttribute('inert');
    expect(screen.getByRole('button', { name: 'Remove Lisbon' })).toHaveFocus();
  });

  it('returns focus to the trigger after confirming', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmRemoval onConfirm={onConfirm} />);
    const user = await openDialog();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Lisbon' })).toHaveFocus();
  });
});
