import { useLayoutEffect, useRef, type ReactNode, type Ref } from 'react';
import gsap from 'gsap';

/**
 * The motion layer.
 *
 * GSAP rather than CSS keyframes because these screens animate *data*, not decoration: a rail
 * of markets arrives when the query resolves, so the timing has to be started from code that
 * knows when that happened, and a tween interrupted by a new filter has to be killed rather
 * than left finishing over rows that are already gone.
 *
 * Everything here moves content that is already in the DOM at its final position, and only
 * `transform` and `opacity`. A tween therefore cannot cause the reflow it is drawing over.
 */

export const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether to hold still.
 *
 * A missing `matchMedia` answers yes rather than no: an environment that cannot report the
 * preference — a server render, a test runner — has no display that needs the animation, and
 * the cost of guessing wrong is only that something appears without a fade.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(REDUCE_QUERY).matches;
}

export interface RevealProps {
  children: ReactNode;
  className?: string;
  /** The host tag, so a revealed list can stay a `ul` rather than becoming a div of `li`s. */
  as?: 'div' | 'ul';
  /** Pixels each child rises from. */
  y?: number;
  /** Seconds between children. */
  stagger?: number;
  duration?: number;
  /** Change this to replay the entrance — a filter that swapped the rows should answer. */
  revealKey?: string | number;
}

/**
 * Lifts its direct children in, one after another.
 *
 * Targets `children` rather than the wrapper so a card list reveals as a list. `clearProps`
 * hands the transform back to CSS when the tween ends, which is what keeps a later hover
 * transform from fighting an entrance that has already finished.
 */
export function Reveal({
  children,
  className,
  as: Host = 'div',
  y = 14,
  stagger = 0.05,
  duration = 0.5,
  revealKey,
}: RevealProps) {
  const host = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el || prefersReducedMotion()) return;

    const tween = gsap.from(el.children, {
      y,
      opacity: 0,
      duration,
      stagger,
      ease: 'power3.out',
      clearProps: 'transform,opacity',
    });

    // Jump to the end before dropping it, so an interrupted entrance leaves children visible.
    return () => {
      tween.progress(1).kill();
    };
  }, [revealKey, y, stagger, duration]);

  return (
    <Host ref={host as Ref<HTMLDivElement & HTMLUListElement>} className={className}>
      {children}
    </Host>
  );
}
