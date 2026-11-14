/**
 * Animated weather icons: inline SVG + CSS keyframes (see `.wx-icon` in app/index.css).
 *
 * Why not Lottie: lottie-web adds ~250 KB minified (~65 KB gzipped) of player code before a
 * single animation, plus a JSON file per icon, and renders on the main thread. These icons are
 * a few hundred bytes of SVG each, animate only `transform`/`opacity` (compositor-friendly, no
 * layout or paint), pause when offscreen, and switch off entirely under
 * prefers-reduced-motion — all from CSS, with zero runtime cost.
 */
import { useCallback } from 'react';

import type { WeatherCondition } from '@/shared/api/weather-contract';
import { cn } from '@/shared/lib/cn';

const CLOUD = 'M7.5 18.5h9a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.6 11a3.75 3.75 0 0 0 .9 7.5Z';
const HIGH_CLOUD = 'M7.5 15h9a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.6 7.5 3.75 3.75 0 0 0 7.5 15Z';
const SUN_RAYS =
  'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4';

function glyph(condition: WeatherCondition, isDay: boolean) {
  switch (condition) {
    case 'clear':
      return isDay ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path data-anim="rays" d={SUN_RAYS} />
        </>
      ) : (
        <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" />
      );
    case 'partly-cloudy':
      return (
        <>
          <path data-anim="rays" d="M8 3v1.5M3 8h1.5M4.5 4.5l1 1M12 4.5l-1 1" />
          <path d="M5.6 10.3A3.5 3.5 0 0 1 11.3 6.6" />
          <path data-anim="drift" d={CLOUD} />
        </>
      );
    case 'cloudy':
      return <path data-anim="drift" d={CLOUD} />;
    case 'fog':
      return (
        <>
          <path data-anim="fog" d="M4 9h16M5 17h14" />
          <path data-anim="fog" data-delay="2" d="M3 13h18M8 21h8" />
        </>
      );
    case 'drizzle':
      return (
        <>
          <path data-anim="drift" d={HIGH_CLOUD} />
          <path data-anim="fall" d="M8 18v.5" />
          <path data-anim="fall" data-delay="2" d="M12 18v.5" />
          <path data-anim="fall" data-delay="1" d="M16 18v.5" />
        </>
      );
    case 'rain':
      return (
        <>
          <path data-anim="drift" d={HIGH_CLOUD} />
          <path data-anim="fall" d="M8 17.5l-1 3" />
          <path data-anim="fall" data-delay="2" d="M12 17.5l-1 3" />
          <path data-anim="fall" data-delay="1" d="M16 17.5l-1 3" />
        </>
      );
    case 'snow':
      return (
        <>
          <path data-anim="drift" d={HIGH_CLOUD} />
          <path data-anim="snow" d="M8 18v3M6.7 19.5h2.6" />
          <path data-anim="snow" data-delay="2" d="M12 18v3M10.7 19.5h2.6" />
          <path data-anim="snow" data-delay="1" d="M16 18v3M14.7 19.5h2.6" />
        </>
      );
    case 'thunderstorm':
      return (
        <>
          <path data-anim="drift" d={HIGH_CLOUD} />
          <path data-anim="flash" d="M12.5 15.5 10 19.5h3.5L11 23.5" />
        </>
      );
  }
}

// One observer for every icon: animations pause while an icon is offscreen.
let observer: IntersectionObserver | null = null;
function visibilityObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      // A DOM attribute, not React state: pausing never re-renders anything.
      entry.target.toggleAttribute('data-paused', !entry.isIntersecting);
    }
  });
  return observer;
}

/** Decorative: the condition is always also given as text next to it. */
export function ConditionIcon({
  condition,
  isDay = true,
  size = 24,
  className,
}: {
  condition: WeatherCondition;
  isDay?: boolean;
  size?: number;
  className?: string;
}) {
  const observe = useCallback((element: SVGSVGElement | null) => {
    const io = visibilityObserver();
    if (!element || !io) return;
    io.observe(element);
    return () => {
      io.unobserve(element);
    };
  }, []);

  return (
    <svg
      ref={observe}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-condition={condition}
      className={cn('wx-icon', className)}
    >
      {glyph(condition, isDay)}
    </svg>
  );
}
