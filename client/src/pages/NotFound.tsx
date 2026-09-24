import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="font-display text-5xl font-bold text-accent">404</p>
      <h1 className="mt-3 font-display text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted">
        That link does not lead anywhere. Start from the market list.
      </p>
      <Link
        to="/markets"
        className="mt-8 inline-flex h-10 items-center rounded-full bg-accent px-5 font-semibold text-ink"
      >
        Browse markets
      </Link>
    </section>
  );
}
