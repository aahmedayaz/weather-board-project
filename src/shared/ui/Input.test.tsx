import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the input', () => {
    render(<Input label="City" />);
    expect(screen.getByRole('textbox', { name: 'City' })).toBeInTheDocument();
  });

  it('is valid and has no description by default', () => {
    render(<Input label="City" />);
    const input = screen.getByRole('textbox', { name: 'City' });
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('links the hint through aria-describedby without marking the field invalid', () => {
    render(<Input label="City" hint="For example, Lisbon or Tokyo." />);
    const input = screen.getByRole('textbox', { name: 'City' });
    expect(input).toHaveAccessibleDescription('For example, Lisbon or Tokyo.');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('marks the field invalid and links the inline error', () => {
    render(<Input label="City" error="Enter at least 2 characters." />);
    const input = screen.getByRole('textbox', { name: 'City' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter at least 2 characters.');
    expect(screen.getByText('Enter at least 2 characters.')).toBeVisible();
  });

  it('describes the field with both hint and error, hint first', () => {
    render(<Input label="City" hint="For example, Lisbon." error="Enter at least 2 characters." />);
    expect(screen.getByRole('textbox', { name: 'City' })).toHaveAccessibleDescription(
      'For example, Lisbon. Enter at least 2 characters.',
    );
  });

  it('keeps an aria-describedby passed by the caller', () => {
    render(
      <>
        <p id="external">Results update as you type.</p>
        <Input label="City" aria-describedby="external" error="Enter at least 2 characters." />
      </>,
    );
    expect(screen.getByRole('textbox', { name: 'City' })).toHaveAccessibleDescription(
      'Results update as you type. Enter at least 2 characters.',
    );
  });

  it('clears the invalid state when the error is resolved', () => {
    const { rerender } = render(<Input label="City" error="Enter at least 2 characters." />);
    rerender(<Input label="City" />);
    const input = screen.getByRole('textbox', { name: 'City' });
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText('Enter at least 2 characters.')).not.toBeInTheDocument();
  });

  it('treats an empty error string as no error', () => {
    render(<Input label="City" error="" />);
    expect(screen.getByRole('textbox', { name: 'City' })).not.toHaveAttribute('aria-invalid');
  });
});
