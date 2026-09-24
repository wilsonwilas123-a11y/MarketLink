export function Page({
  title,
  accent,
  blurb,
}: {
  title: string;
  accent?: string;
  blurb: string;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 md:py-24">
      <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight md:text-5xl">
        {title}
        {accent ? <span className="block text-accent">{accent}</span> : null}
      </h1>
      <p className="mt-4 max-w-xl text-muted">{blurb}</p>
    </section>
  );
}
