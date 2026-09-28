import { Card } from '../components/ui/Card';
import { FRESH_THIS_WEEK } from '../lib/showcase';

export function About() {
  const creditedPhotos = FRESH_THIS_WEEK.filter((product) => product.photoCredit);

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <p className="text-sm text-accent">Local food. Stronger communities.</p>
      <h1 className="mt-1 font-display text-3xl font-bold md:text-4xl">About MarketLink</h1>
      <p className="mt-3 max-w-3xl text-muted">
        MarketLink helps shoppers discover African farmers and neighborhood markets, see what
        produce is available, and reserve it for a convenient pickup.
      </p>
      <div className="mt-7 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <h2 className="font-semibold">For shoppers</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Compare nearby markets, browse seasonal produce, follow favorite stalls, and keep
            track of pickup orders in one place.
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">For farmers</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Share your stall location and market days, keep weekly stock up to date, and prepare
            customer reservations for pickup.
          </p>
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">For markets</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Help local stalls become easier to find with market details, maps, trading schedules,
            and clear pickup information.
          </p>
        </Card>
      </div>
      <Card className="mt-5 p-5">
        <h2 className="font-semibold">How it works</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Choose a market and farmer, reserve available items, then collect your order at the
          selected market. Payment is arranged in person at pickup. MarketLink does not provide
          delivery or process online payments.
        </p>
      </Card>
      {creditedPhotos.length > 0 ? (
        <Card className="mt-5 p-5">
          <h2 className="font-semibold">Photo credits</h2>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-muted">
            {creditedPhotos.map((product) => (
              <li key={product.key}>
                {product.name} photo by {product.photoCredit!.author.split(' · ')[0]},{' '}
                <a
                  className="text-accent underline underline-offset-2"
                  href={product.photoCredit!.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  Wikimedia Commons
                </a>
                . Resized for the carousel. Licensed under{' '}
                <a
                  className="text-accent underline underline-offset-2"
                  href="https://creativecommons.org/licenses/by-sa/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY-SA 4.0
                </a>
                .
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <p className="mt-6 text-xs text-muted">
        MarketLink brings local growers and neighborhood market communities together. Use the
        Contact page for help with the marketplace or a scheduled pickup.
      </p>
    </section>
  );
}
export function Contact() {
  const team = import.meta.env.VITE_CONTACT_TEAM_NAME || 'MarketLink Team';
  const email = import.meta.env.VITE_CONTACT_EMAIL;
  const phone = import.meta.env.VITE_CONTACT_PHONE;
  const address = import.meta.env.VITE_CONTACT_ADDRESS;
  const latText = import.meta.env.VITE_CONTACT_LAT?.trim();
  const lngText = import.meta.env.VITE_CONTACT_LNG?.trim();
  const lat = Number(latText);
  const lng = Number(lngText);
  const hasPin = Boolean(latText && lngText) && Number.isFinite(lat) && Number.isFinite(lng);
  return <section className="mx-auto max-w-5xl px-4 py-8 md:py-12">
    <p className="text-sm text-accent">We’re here to help</p><h1 className="mt-1 font-display text-3xl font-bold">Contact {team}</h1>
    <p className="mt-2 max-w-2xl text-sm text-muted">Questions about a pickup or a stall? Reach the MarketLink team using the public contact details below.</p>
    <div className="mt-6 grid gap-5 md:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)]">
      <Card className="space-y-5 p-5"><div><h2 className="font-semibold">Contact details</h2>
        {email ? <p className="mt-3 text-sm"><span className="text-muted">Email</span><br/><a className="text-accent underline" href={`mailto:${email}`}>{email}</a></p> : <p className="mt-3 text-sm text-muted">Team email has not been configured yet.</p>}
        {phone ? <p className="mt-3 text-sm"><span className="text-muted">Phone</span><br/><a className="text-accent underline" href={`tel:${phone}`}>{phone}</a></p> : null}
        {address ? <p className="mt-3 text-sm"><span className="text-muted">Address</span><br/><span>{address}</span></p> : <p className="mt-3 text-sm text-muted">Team address has not been configured yet.</p>}
      </div><div className="border-t border-line pt-4"><h2 className="font-semibold">Help with an order</h2><p className="mt-2 text-sm leading-relaxed text-muted">Keep your order reference handy. For a pickup that is already scheduled, contact the farmer through the market roster as well.</p></div>
        {!email || !address || !hasPin ? <p className="rounded-lg bg-elevated p-3 text-xs text-muted">The MarketLink team is still setting up its public contact details. For order help, open your order details and contact the farmer through the market roster.</p> : null}</Card>
      <Card className="overflow-hidden p-2"><h2 className="px-3 pt-3 font-semibold">Team location</h2>{hasPin ? <><iframe title={`${team} map location`} loading="lazy" referrerPolicy="no-referrer" className="mt-3 h-80 w-full rounded-xl border-0" src={`https://www.google.com/maps?q=${lat},${lng}&output=embed`} /><div className="flex justify-between gap-3 px-3 py-3 text-xs"><span className="text-muted">{address || `${lat}, ${lng}`}</span><a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noreferrer" className="shrink-0 text-accent underline">Directions</a></div></> : <div className="mt-3 grid h-80 place-items-center rounded-xl bg-elevated p-6 text-center text-sm text-muted">The team’s map pin will appear here once its public location is available.</div>}</Card>
    </div>
  </section>;
}
export { default as Orders } from './Orders';
