import { Link, useParams } from 'react-router-dom';
import { StateNote } from '../components/discovery/StateNote';
import { OpenState, TradingDays } from '../components/discovery/pieces';
import { Avatar } from '../components/ui/Avatar';
import { ApiError } from '../lib/api';
import { daysPhrase, useMarket } from '../lib/discovery';
import type { RosterFarmer } from '../lib/types';
import { Reveal } from '../motion/reveal';
import { FavoriteToggle } from '../components/FavoriteToggle';


function RosterRow({ farmer }: { farmer: RosterFarmer }) {
  return (
    <li className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-[2px] bg-elevated">
        <Avatar src={farmer.logo_url} size={40} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold">{farmer.stall_name}</p>
        <p className="truncate text-xs text-muted">
          {farmer.contact_person}
          {farmer.stall_ref ? ` · pitch ${farmer.stall_ref}` : ''}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="num text-xs text-muted">
          {farmer.rating_count > 0 ? (
            <>
              <span className="text-primary">{farmer.rating_avg.toFixed(1)}</span>
              <span> / 5 · {farmer.rating_count}</span>
            </>
          ) : (
            'no ratings yet'
          )}
        </span>
        <span className="text-xs text-muted">{daysPhrase(farmer.days)}</span>
      </div>
    </li>
  );
}

export default function MarketDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: market, isPending, error } = useMarket(id);

  if (isPending) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <p className="text-sm text-muted">Loading the market…</p>
      </div>
    );
  }

  if (error || !market) {
    // The server answers 404 for a market that is gone and for one that was never active, so
    // there is nothing truer to say here than that this address has no market.
    const missing = error instanceof ApiError && error.code === 'not_found';
    return (
      <div className="mx-auto max-w-5xl px-4 py-16">
        <StateNote
          label={missing ? 'No market at that address' : 'This market did not load'}
          body={
            missing
              ? 'It may have closed, or the link may be from an older listing.'
              : 'Give it another try, or go back to the list.'
          }
        />
        <Link
          to="/markets"
          className="mt-4 inline-block text-sm text-primary underline decoration-line underline-offset-2 hover:decoration-accent"
        >
          All markets
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-20">
      <header className="mx-auto max-w-5xl px-4 pt-10">
        <Link to="/markets" className="text-sm text-muted transition-colors hover:text-primary">
          All markets
        </Link>

        <Reveal className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="font-display text-4xl font-semibold leading-[1.05] md:text-5xl">
              {market.name}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {market.address} · {market.city}, {market.state}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <FavoriteToggle type="market" id={market.id} />
            <OpenState open={market.is_open_now} />
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${market.lat},${market.lng}`} target="_blank" rel="noreferrer" className="text-xs text-muted underline decoration-line underline-offset-2 hover:text-primary">Get directions</a>
          </div>
        </Reveal>

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-5">
          <TradingDays
            days={market.operating_days}
            opensAt={market.opens_at}
            closesAt={market.closes_at}
          />
          <p className="num text-sm text-muted">
            <span className="text-primary">{market.farmers.length}</span>{' '}
            {market.farmers.length === 1 ? 'farm' : 'farms'} ·{' '}
            <span className="text-primary">{market.product_count}</span> products listed this week
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pt-10">
        <h2 className="font-display text-lg font-bold">Who trades here</h2>
        <p className="mt-1 text-sm text-muted">
          Approved farms only, in the order of the name they list under. A farm’s own days can be
          narrower than the market’s.
        </p>

        {market.farmers.length === 0 ? (
          <p className="mt-5 rounded-[3px] border border-line bg-surface px-4 py-3 text-sm text-muted">
            No stall has published a pitch at this market yet. The market’s own hours above are
            still correct.
          </p>
        ) : (
          <Reveal as="ul" className="mt-4" y={8} stagger={0.03}>
            {market.farmers.map((farmer) => (
              <RosterRow key={farmer.id} farmer={farmer} />
            ))}
          </Reveal>
        )}
      </section>
    </div>
  );
}
