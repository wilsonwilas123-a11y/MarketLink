import { useLayoutEffect, useRef } from 'react';
import { Glyph } from '../components/art/glyphs';
import { prefersReducedMotion } from './preferences';

export function LoadingScreen({ label = 'Loading MarketLink…' }: { label?: string }) {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || prefersReducedMotion()) return;
    let disposed = false;
    let context: { revert(): void } | undefined;
    void import('gsap').then(({ default: gsap }) => {
      if (disposed) return;
      context = gsap.context(() => {
        gsap.fromTo('[data-loader-produce]',
          { y: 7, rotation: -8, scale: 0.88 },
          {
            y: -5,
            rotation: 7,
            scale: 1,
            duration: 1.05,
            stagger: { each: 0.18, from: 'center' },
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut',
          },
        );
        gsap.fromTo('[data-loader-soil]',
          { scaleX: 0.78, autoAlpha: 0.55 },
          { scaleX: 1, autoAlpha: 1, duration: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut' },
        );
        gsap.fromTo('[data-loader-progress]',
          { xPercent: -130 },
          { xPercent: 300, duration: 1.9, repeat: -1, ease: 'power1.inOut' },
        );
      }, el);
    });
    return () => {
      disposed = true;
      context?.revert();
    };
  }, []);

  return (
    <section ref={root} className="grid min-h-[42vh] place-items-center px-5 py-16" role="status" aria-live="polite">
      <div className="flex flex-col items-center text-center">
        <span className="relative flex h-[5.5rem] items-end justify-center gap-2 pb-3" aria-hidden>
          <span data-loader-produce className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Glyph name="tomato" size={27} />
          </span>
          <span data-loader-produce className="grid h-[3.5rem] w-[3.5rem] place-items-center rounded-[20px] bg-accent text-on-block shadow-[0_10px_28px_rgba(33,106,73,.2)]">
            <Glyph name="sprout" size={32} />
          </span>
          <span data-loader-produce className="grid h-11 w-11 place-items-center rounded-2xl bg-[#fff2dc] text-[#a9661d]">
            <Glyph name="carrot" size={27} />
          </span>
          <span data-loader-soil className="absolute bottom-1 left-1/2 h-1 w-24 -translate-x-1/2 origin-center rounded-full bg-accent/25" />
        </span>
        <p className="mt-6 font-display text-lg font-semibold text-primary">MarketLink</p>
        <p className="mt-1 text-sm text-muted">{label}</p>
        <span aria-hidden className="mt-4 h-1 w-24 overflow-hidden rounded-full bg-accent/10">
          <span data-loader-progress className="block h-full w-1/3 rounded-full bg-accent" />
        </span>
      </div>
    </section>
  );
}
