import { Link, NavLink } from 'react-router-dom';
import { Glyph } from '../art/glyphs';
import { AccountSlot } from './AccountSlot';

const links = [
  { to: '/', label: 'Discover', end: true },
  { to: '/markets', label: 'Markets' },
  { to: '/products', label: 'Products' },
  { to: '/farmers', label: 'Farmers' },
  { to: '/orders', label: 'Orders' },
];

function linkClass({ isActive }: { isActive: boolean }) {
  return `shrink-0 border-b-2 px-1 pb-1 text-sm transition ${
    isActive ? 'border-accent text-primary' : 'border-transparent text-muted hover:text-primary'
  }`;
}

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-sheet/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent" aria-hidden>
            <Glyph name="leaf" size={18} />
          </span>
          MarketLink
        </NavLink>

        <nav aria-label="Primary" className="order-3 -mx-1 flex w-full gap-5 overflow-x-auto px-1 md:order-none md:w-auto md:overflow-visible">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Link to="/markets" aria-label="Search markets" className="text-muted hover:text-primary">
            <Glyph name="search" size={19} />
          </Link>
          <AccountSlot />
        </div>
      </div>
    </header>
  );
}
