import { useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from './preferences';

export function LoadingDots({ className = '', dotClassName = 'h-1.5 w-1.5' }: {
  className?: string;
  dotClassName?: string;
}) {
  const host = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el || prefersReducedMotion()) return;
    let disposed = false;
    let tween: { kill(): void } | undefined;
    void import('gsap').then(({ default: gsap }) => {
      if (disposed) return;
      tween = gsap.fromTo(el.children,
        { y: 0, autoAlpha: 0.48, scale: 0.78 },
        { y: -3, autoAlpha: 1, scale: 1, duration: 0.46, stagger: 0.12, repeat: -1, yoyo: true, ease: 'sine.inOut' },
      );
    });
    return () => {
      disposed = true;
      tween?.kill();
    };
  }, []);

  return (
    <span ref={host} aria-hidden className={`inline-flex items-center gap-1.5 ${className}`}>
      {[0, 1, 2].map((dot) => <span key={dot} className={`${dotClassName} rounded-full bg-current`} />)}
    </span>
  );
}
