import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(initial: string, delayMs?: number) {
    return renderHook(({ value, delay }) => useDebouncedValue(value, delay), {
      initialProps: { value: initial, delay: delayMs },
    });
  }

  it('returns the initial value immediately', () => {
    const { result } = setup('lis');
    expect(result.current).toBe('lis');
  });

  it('defaults to a 150 ms delay', () => {
    const { result, rerender } = setup('l');
    rerender({ value: 'li', delay: undefined });

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(result.current).toBe('l');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('li');
  });

  it('emits only the last value of a burst', () => {
    const { result, rerender } = setup('l');
    for (const value of ['li', 'lis', 'lisb']) {
      rerender({ value, delay: undefined });
      act(() => {
        vi.advanceTimersByTime(100); // each keystroke lands before the 150 ms window ends
      });
    }
    expect(result.current).toBe('l');

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe('lisb');
  });

  it('respects a custom delay', () => {
    const { result, rerender } = setup('a', 500);
    rerender({ value: 'ab', delay: 500 });
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe('a');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('ab');
  });

  it('does not update after unmount', () => {
    const { result, rerender, unmount } = setup('a');
    rerender({ value: 'ab', delay: undefined });
    unmount();
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe('a');
    expect(vi.getTimerCount()).toBe(0);
  });
});
