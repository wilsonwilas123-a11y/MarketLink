import { NavLink } from 'react-router-dom';
import { AccountSlot } from './AccountSlot';

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/markets', label: 'Markets' },
  { to: '/products', label: 'Products' },
  { to: '/farmers', label: 'Farmers' },
  { to: '/orders', label: 'Orders' },
  { to: '/about', label: 'About' },
];

function linkClass({ isActive }: { isActive: boolean }) {
  return `shrink-0 rounded-full px-3 py-2 text-sm transition ${
    isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:text-primary'
  }`;
}

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-base/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <NavLink to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3c-4 0-7 3-7 7 0 5 7 11 7 11s7-6 7-11c0-4-3-7-7-7zm0 9a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </span>
          MarketLink
        </NavLink>

        <nav aria-label="Primary" className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 md:order-none md:w-auto md:overflow-visible">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <AccountSlot />
        </div>
      </div>
    </header>
  );
}
