import { useLayoutEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../motion/preferences';
import { Button } from '../ui/Button';


export function StateNote({
  label,
  body,
  retry,
}: {
  label: string;
  body: string;
  retry?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/70 px-4 py-3">
      <p className="text-sm">
        <span className="font-medium text-primary">{label}</span>
        <span className="text-muted"> — {body}</span>
      </p>
      {retry ? (
        <Button size="sm" variant="ghost" onClick={retry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** A rail or grid that is still filling in, holding its height so the page cannot jump. */
export function SkeletonRow({
  count,
  className = '',
  itemClass = 'h-24 rounded-2xl border border-line bg-surface/50',
}: {
  count: number;
  className?: string;
  itemClass?: string;
}) {
  const host = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = host.current;
    if (!el || prefersReducedMotion()) return;
    let disposed = false;
    let tween: { kill(): void } | undefined;
    void import('gsap').then(({ default: gsap }) => {
      if (disposed) return;
      tween = gsap.fromTo(el.children,
        { opacity: 0.55 },
        { opacity: 0.94, duration: 0.72, stagger: 0.1, repeat: -1, yoyo: true, ease: 'sine.inOut' },
      );
    });
    return () => {
      disposed = true;
      tween?.kill();
    };
  }, [count]);

  return (
    <div ref={host} className={className} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={itemClass} />
      ))}
    </div>
  );
}
