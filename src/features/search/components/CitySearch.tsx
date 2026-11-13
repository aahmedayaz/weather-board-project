import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { CITY_QUERY_MIN, type City } from '@/shared/api/cities-contract';
import { Banner, Input, VisuallyHidden } from '@/shared/ui';
import { SpinnerIcon } from '@/shared/ui/icons';

import { CitySearchError } from '../api/searchCities';
import { useCitySearch } from '../hooks/useCitySearch';

import { CityOption } from './CityOption';
import { RetryCountdown } from './RetryCountdown';

const SearchFormSchema = z.object({
  query: z.string().trim().min(1, 'Enter a city name to search.'),
});
type SearchFormValues = z.input<typeof SearchFormSchema>;

const NO_CITIES: City[] = [];

type View =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'results'; cities: City[]; refreshing: boolean }
  | { kind: 'empty' }
  | { kind: 'rate-limited'; retryAfterSeconds: number }
  | { kind: 'network-error' }
  | { kind: 'unavailable' };

export interface CitySearchProps {
  /** Called with the chosen city. Pass a stable function (e.g. a state setter). */
  onSelect: (city: City) => void;
}

export function CitySearch({ onSelect }: CitySearchProps) {
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(SearchFormSchema),
    // First validation on blur; once touched, re-validate on change so a fixed error clears
    // as you type (plain 'onBlur' would keep it until the next blur).
    mode: 'onTouched',
    defaultValues: { query: '' },
  });
  const rawQuery = useWatch({ control, name: 'query' });

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const search = useCitySearch(rawQuery, open);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();
  const optionIdPrefix = useId();
  const optionId = (city: City) => `${optionIdPrefix}-city-${String(city.id)}`;

  // ---- Derived view: one place decides which state the popup shows. -------------------
  let view: View;
  if (rawQuery.trim().length < CITY_QUERY_MIN) {
    view = { kind: 'idle' };
  } else if (search.isError) {
    const error = search.error;
    if (error instanceof CitySearchError && error.kind === 'rate-limited') {
      view = { kind: 'rate-limited', retryAfterSeconds: error.retryAfterSeconds };
    } else if (error instanceof CitySearchError && error.kind === 'network') {
      view = { kind: 'network-error' };
    } else {
      view = { kind: 'unavailable' };
    }
  } else if (search.data === undefined) {
    view = { kind: 'loading' };
  } else if (search.data.length === 0) {
    view = search.isPlaceholderData ? { kind: 'loading' } : { kind: 'empty' };
  } else {
    view = { kind: 'results', cities: search.data, refreshing: search.isPlaceholderData };
  }

  const cities = view.kind === 'results' ? view.cities : NO_CITIES;
  const activeCity = cities[activeIndex];
  const listboxVisible = open && view.kind === 'results';
  const popupVisible = open && view.kind !== 'idle';

  // ---- Actions ---------------------------------------------------------------------------
  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  // Stable across keystrokes (setValue and the setters are stable; onSelect must be too),
  // so memoized rows are not re-rendered just because the parent did.
  const selectCity = useCallback(
    (city: City) => {
      setValue('query', city.name, { shouldValidate: true });
      setOpen(false);
      setActiveIndex(-1);
      onSelect(city);
    },
    [setValue, onSelect],
  );

  const retry = () => {
    inputRef.current?.focus(); // the retry button unmounts with the error, so keep focus home
    void search.refetch();
  };

  const moveActive = (nextIndex: number) => {
    const city = cities[nextIndex];
    if (!city) return;
    setActiveIndex(nextIndex);
    document.getElementById(optionId(city))?.scrollIntoView({ block: 'nearest' });
  };

  // Click outside closes the popup. (Blur alone is not enough: a click inside the popup —
  // e.g. on "Try again" — must not close it, and some browsers don't focus buttons on click.)
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapperRef.current?.contains(event.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const field = register('query');

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (cities.length === 0) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const from = activeIndex === -1 && step === -1 ? 0 : activeIndex;
        moveActive((from + step + cities.length) % cities.length);
        return;
      }
      case 'Enter':
        if (listboxVisible && activeCity) {
          event.preventDefault();
          selectCity(activeCity);
        }
        return; // otherwise the form submits (and validates)
      case 'Escape':
        if (open) {
          event.preventDefault();
          close();
        } else if (rawQuery !== '') {
          event.preventDefault();
          setValue('query', '');
        }
        return;
    }
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    void field.onBlur(event); // react-hook-form: validate on blur
    // Keyboard focus moved somewhere outside the combobox (e.g. Tab) → close.
    const next = event.relatedTarget;
    if (next instanceof Node && !wrapperRef.current?.contains(next)) close();
  }

  const onValidSubmit = () => {
    // Enter without an active option: take the top match if there is one.
    const first = cities[0];
    if (listboxVisible && first) selectCity(first);
    else setOpen(true);
  };

  // ---- Screen-reader summary (one polite announcement per state change) ----------------
  let announcement = '';
  if (popupVisible && view.kind === 'results' && !view.refreshing) {
    const count = view.cities.length;
    announcement = `${String(count)} ${count === 1 ? 'city' : 'cities'} found. Use up and down arrows to choose.`;
  } else if (popupVisible && view.kind === 'empty') {
    announcement = `No cities match ${search.query}.`;
  }

  return (
    <form role="search" noValidate onSubmit={(event) => void handleSubmit(onValidSubmit)(event)}>
      <div ref={wrapperRef}>
        <Input
          {...field}
          ref={(element) => {
            field.ref(element);
            inputRef.current = element;
          }}
          label="City"
          placeholder="Search for a city"
          hint={`Type at least ${String(CITY_QUERY_MIN)} letters, then use ↑ ↓ and Enter to pick a city.`}
          {...(errors.query?.message ? { error: errors.query.message } : {})}
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-expanded={listboxVisible}
          aria-controls={listboxVisible ? listboxId : undefined}
          aria-activedescendant={listboxVisible && activeCity ? optionId(activeCity) : undefined}
          onChange={(event) => {
            void field.onChange(event);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          inputAddon={
            popupVisible && (
              <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg bg-surface shadow-overlay">
                {view.kind === 'results' && (
                  <div
                    id={listboxId}
                    role="listbox"
                    aria-label="City suggestions"
                    aria-busy={view.refreshing}
                    className="relative max-h-80 overflow-y-auto p-1"
                  >
                    {view.refreshing && (
                      <SpinnerIcon className="absolute top-3 right-3 animate-spin text-fg-muted" />
                    )}
                    {view.cities.map((city, index) => (
                      <CityOption
                        key={city.id}
                        city={city}
                        index={index}
                        optionId={optionId(city)}
                        active={index === activeIndex}
                        onSelect={selectCity}
                        onActivate={setActiveIndex}
                      />
                    ))}
                  </div>
                )}

                {view.kind === 'loading' && (
                  <p
                    role="status"
                    className="flex items-center gap-2 px-3 py-3 text-sm text-fg-muted"
                  >
                    <SpinnerIcon className="animate-spin" />
                    Searching for “{rawQuery.trim()}”…
                  </p>
                )}

                {view.kind === 'empty' && (
                  <div className="px-3 py-3 text-sm">
                    <p className="font-medium text-fg">No cities match “{search.query}”.</p>
                    <p className="mt-0.5 text-fg-muted">
                      Check the spelling, try just the first few letters, or search for a nearby
                      larger city.
                    </p>
                  </div>
                )}

                {view.kind === 'rate-limited' && (
                  <Banner tone="warning" title="Too many searches right now" className="m-1">
                    City search allows about one request per second.{' '}
                    <VisuallyHidden>
                      Retrying automatically in {view.retryAfterSeconds} seconds.
                    </VisuallyHidden>
                    <RetryCountdown
                      key={search.errorUpdatedAt}
                      seconds={view.retryAfterSeconds}
                      onRetry={() => void search.refetch()}
                    />
                  </Banner>
                )}

                {view.kind === 'network-error' && (
                  <Banner
                    tone="error"
                    title="Couldn’t reach city search"
                    action={{ label: 'Try again', onAction: retry }}
                    className="m-1"
                  >
                    Check your internet connection, then try again.
                  </Banner>
                )}

                {view.kind === 'unavailable' && (
                  <Banner
                    tone="error"
                    title="City search is unavailable right now"
                    action={{ label: 'Try again', onAction: retry }}
                    className="m-1"
                  >
                    This is on our side, not yours. Try again in a moment.
                  </Banner>
                )}
              </div>
            )
          }
        />
      </div>
      <VisuallyHidden role="status" aria-live="polite">
        {announcement}
      </VisuallyHidden>
    </form>
  );
}
