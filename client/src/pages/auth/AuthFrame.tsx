import type { ReactNode } from 'react';

/**
 * The shared frame for the three auth screens.
 *
 * Single column and narrow on purpose: a sign-in form does not need a marketing panel beside
 * it, and the split screen is the shape every generated login page reaches for.
 */
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
  return (
    <section className="mx-auto w-full max-w-md px-4 py-12 md:py-16">
      <h1 className="font-display text-3xl font-bold leading-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted">{note}</p>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">{children}</div>
      {footer ? <p className="mt-5 text-sm text-muted">{footer}</p> : null}
    </section>
  );
}

/** One line, at the top of the form, saying the submit did not happen and what to change. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {children}
    </p>
  );
}

/** Shown in place of every auth form when the build has no Supabase project. */
export function AuthUnavailable() {
  return (
    <div className="space-y-3 text-sm">
      <p className="text-primary">No Supabase project is set for this build, so there is nothing to sign in to.</p>
      <p className="text-muted">
        Put the project URL and anon key in <code className="text-accent">client/.env</code> as
        VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, and the same URL plus the service-role key in{" "}
        <code className="text-accent">server/.env</code>. Restart the dev server.
      </p>
      <p className="text-muted">
        Browsing markets, stalls and prices needs none of that and keeps working.
      </p>
    </div>
  );
}
