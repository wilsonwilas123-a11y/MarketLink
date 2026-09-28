import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { prefersReducedMotion } from './preferences';

/** A short, reusable entrance for real route changes. */
export function RouteTransition({ path, enabled = true, children }: {
  path: string;
  enabled?: boolean;
  children: ReactNode;
}) {
  const scope = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = scope.current;
    if (!root || !enabled || prefersReducedMotion()) return;

    let disposed = false;
    let context: { revert(): void } | undefined;
    void import('gsap').then(({ default: gsap }) => {
      if (disposed) return;
      context = gsap.context(() => {
        const timeline = gsap.timeline({ defaults: { overwrite: 'auto' } });
        timeline
          .fromTo(root.querySelector('[data-route-content]'),
            { autoAlpha: 0, y: 14 },
            { autoAlpha: 1, y: 0, duration: 0.42, ease: 'power3.out', clearProps: 'transform,opacity,visibility' },
          )
          .fromTo(root.querySelector('[data-route-progress]'),
            { scaleX: 0, autoAlpha: 1 },
            { scaleX: 1, duration: 0.38, ease: 'power2.inOut' },
            0,
          )
          .to(root.querySelector('[data-route-progress]'), {
            autoAlpha: 0,
            duration: 0.18,
            ease: 'power1.out',
            clearProps: 'all',
          }, '-=0.08');
      }, root);
    });

    return () => {
      disposed = true;
      context?.revert();
    };
  }, [path, enabled]);

  return (
    <div ref={scope} className="relative">
      <span
        aria-hidden
        data-route-progress
        className="pointer-events-none absolute inset-x-0 top-0 z-40 h-0.5 origin-left scale-x-0 bg-accent opacity-0"
      />
      <div data-route-content>{children}</div>
    </div>
  );
}
