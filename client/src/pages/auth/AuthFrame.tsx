import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { prefersReducedMotion } from '../../motion/reveal';
import { CircularSpinner } from '../../components/ui/CircularSpinner';

/** Large-format first screen: real local farm photography, clear product purpose and the form. */
export function AuthFrame({
  title,
  note,
  children,
  footer,
}: {
  title: string;
  note: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const frame = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const root = frame.current;
    if (!root || prefersReducedMotion()) return;
    const context = gsap.context(() => {
      gsap.from('[data-auth-copy] > *', {
        y: 22,
        opacity: 0,
        duration: 0.65,
        stagger: 0.1,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
      gsap.from('[data-auth-form]', {
        y: 22,
        opacity: 0,
        duration: 0.7,
        delay: 0.14,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
    }, root);
    return () => context.revert();
  }, []);

  return (
    <section ref={frame} className="auth-page relative isolate grid min-h-[100svh] overflow-hidden bg-sheet lg:grid-cols-2">
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex w-full items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <Link to="/signin" className="flex items-center gap-2.5 font-display text-[18px] font-extrabold tracking-tight text-primary lg:text-white">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-accent text-paper shadow-[0_8px_18px_rgba(33,106,73,.22)] lg:bg-white/15 lg:backdrop-blur-sm">
            <LeafMark />
          </span>
          MarketLink
        </Link>
        <Link to="/markets" className="rounded-full px-4 py-2 text-sm font-semibold text-body transition hover:bg-white/80 hover:text-accent lg:text-white/90 lg:hover:bg-white/15 lg:hover:text-white">
          Browse markets <span aria-hidden>↗</span>
        </Link>
      </header>

      <div className="relative z-10 hidden min-h-[100svh] lg:block">
        <div data-auth-copy className="auth-story relative flex h-full min-h-[100svh] flex-col justify-between overflow-hidden bg-ink p-10 pb-14 text-paper xl:p-14 xl:pb-16">
          <img src="/img/farmers/auth-farmer.webp" alt="A Nigerian woman harvesting fresh leafy vegetables on a farm" className="absolute inset-0 h-full w-full object-cover object-[58%_center]" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-ink/25" />
          <div className="relative z-10 flex items-center gap-2 pt-16 text-xs font-semibold uppercase tracking-[.16em] text-paper/85">
            <span className="h-2 w-2 rounded-full bg-accent-lift shadow-[0_0_16px_rgba(194,231,207,.9)]" />
            Grown close. Found here.
          </div>
          <div className="relative z-10 max-w-[640px]">
            <h1 className="max-w-[13ch] font-display text-[clamp(2.25rem,4vw,4.6rem)] font-extrabold leading-[1.02] tracking-[-.055em] text-paper">
              Good food has a <span className="text-accent-lift">shorter journey.</span>
            </h1>
            <p className="mt-5 max-w-[48ch] text-[15px] leading-relaxed text-paper/85 sm:text-base">
              Meet the farmers behind your food, see what is fresh this week, and reserve it for pickup at a market near you.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <span className="auth-float-chip">Local farms</span>
              <span className="auth-float-chip auth-float-chip-delay">Fresh this week</span>
              <span className="auth-float-chip auth-float-chip-late">Pay at pickup</span>
            </div>
          </div>
        </div>

      </div>

      <div className="flex min-h-[100svh] items-center justify-center px-5 pb-8 pt-24 sm:px-8 lg:px-12 lg:pt-24">
        <div data-auth-form className="mx-auto w-full max-w-[560px] py-2 lg:py-10">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-[.16em] text-accent">Your local food community</p>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-[-.04em] text-primary sm:text-4xl">{title}</h2>
            <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-body">{note}</p>
          </div>
          {children}
          {footer ? <p className="mt-6 text-center text-sm text-body">{footer}</p> : null}
          <p className="mt-8 text-center text-xs text-muted">MarketLink connects local farms and market communities.</p>
        </div>
      </div>
    </section>
  );
}

export function GoogleButton({ onClick, loading = false }: { onClick: () => void; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-busy={loading || undefined}
      className="group flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl border border-line bg-white px-5 text-sm font-semibold text-primary shadow-[0_3px_12px_rgba(21,39,29,.035)] transition duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_10px_24px_rgba(21,39,29,.09)] disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none"
    >
      {loading ? <CircularSpinner className="text-accent" /> : <GoogleMark />}
      {loading ? 'Connecting to Google…' : 'Continue with Google'}
    </button>
  );
}

export function AuthDivider() {
  return <div className="my-5 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[.14em] text-muted"><span className="h-px flex-1 bg-line" />Or continue with email<span className="h-px flex-1 bg-line" /></div>;
}

function LeafMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[22px] w-[22px] fill-none stroke-current" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 3.5C11.2 3.2 5.1 6.4 5.1 12.3c0 3.1 2.2 5.3 5.1 5.3 6.1 0 9.8-6.2 10.3-14.1Z"/><path d="M3.5 21c2.4-5 6.2-8.7 11.8-11.8"/></svg>;
}

function GoogleMark() {
  return <svg viewBox="0 0 48 48" aria-hidden="true" className="h-[19px] w-[19px]"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.75 7.18l7.73 6C44.43 37.96 46.98 31.9 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.6.28-3.14.77-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.44-4.88 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>;
}

/** One line, at the top of the form, saying the submit did not happen and what to change. */
export function FormAlert({ children }: { children: ReactNode }) {
  return <p role="alert" className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{children}</p>;
}

/** Shown in place of every auth form when the build has no Supabase project. */
export function AuthUnavailable() {
  return (
    <div className="space-y-3 rounded-2xl border border-warn/25 bg-white/80 p-5 text-sm shadow-sm">
      <p className="font-semibold text-primary">Authentication needs your Supabase project keys.</p>
      <p className="text-body">Add <code className="text-accent">VITE_SUPABASE_URL</code> and <code className="text-accent">VITE_SUPABASE_ANON_KEY</code> to <code className="text-accent">client/.env</code>, then restart the client.</p>
      <p className="text-muted">To enable Google, add its OAuth client ID and secret in Supabase → Authentication → Sign In / Providers → Google. Add your local and deployed site URLs to Supabase’s redirect URL allow list. Never put the Google client secret or Supabase service-role key in the client.</p>
    </div>
  );
}
