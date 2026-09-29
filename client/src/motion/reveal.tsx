import { useLayoutEffect, useRef, type ReactNode, type Ref } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from './preferences';
export { prefersReducedMotion, REDUCE_QUERY } from './preferences';



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
