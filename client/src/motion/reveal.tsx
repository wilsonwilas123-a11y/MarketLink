import { useLayoutEffect, useRef, type ReactNode, type Ref } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from './preferences';
export { prefersReducedMotion, REDUCE_QUERY } from './preferences';

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
 * Lifts its direct children in, one after another, as the row scrolls into view.
 *
 * Targets `children` rather than the wrapper so a card list reveals as a list. ScrollTrigger
 * leaves off-screen content in its natural state until it is near view; context cleanup makes
 * filter changes and React Strict Mode safe. `clearProps` hands transforms back to CSS when done.
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

    let context: gsap.Context | undefined;
    let disposed = false;
    void import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
      if (disposed) return;
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        gsap.fromTo(el.children,
          { y, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration,
            stagger,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility',
            immediateRender: false,
            scrollTrigger: { trigger: el, start: 'top 92%', once: true },
          },
        );
      }, el);
    });

    return () => {
      disposed = true;
      context?.revert();
    };
  }, [revealKey, y, stagger, duration]);

  return (
    <Host ref={host as Ref<HTMLDivElement & HTMLUListElement>} className={className}>
      {children}
    </Host>
  );
}
