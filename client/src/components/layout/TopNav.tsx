import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Glyph } from '../art/glyphs';
import { AccountSlot } from './AccountSlot';
import { cartEventName, readCart } from '../../lib/cart';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';

const links = [
  { to: '/', label: 'Discover', end: true },
  { to: '/markets', label: 'Markets' },
  { to: '/products', label: 'Products' },
  { to: '/farmers', label: 'Farmers' },
  { to: '/orders', label: 'Orders' },
  { to: '/notifications', label: 'Alerts' },
];

function linkClass({ isActive }: { isActive: boolean }) {
  return `shrink-0 rounded-full px-3 py-2 text-[13px] font-semibold transition-colors ${
    isActive ? 'bg-elevated text-accent' : 'text-muted hover:bg-elevated/65 hover:text-primary'
  }`;
}

export function TopNav() {
  const { api, profile, status } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    const update = () => setCartCount(readCart().reduce((sum, item) => sum + item.quantity, 0));
    update();
    window.addEventListener(cartEventName(), update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(cartEventName(), update);
      window.removeEventListener('storage', update);
    };
  }, []);
  const notices = useQuery({ queryKey: ['notifications', profile?.id], enabled: status === 'ready', queryFn: () => api.get<{ id:string; read_at:string|null }[]>('/notifications') });
  const unread = notices.data?.filter((item) => !item.read_at).length ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line/75 bg-sheet/90 shadow-[0_8px_32px_rgba(21,39,29,0.08)] backdrop-blur-2xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 md:px-6">
        <NavLink to="/" className="flex shrink-0 items-center gap-2.5 font-display text-lg font-extrabold tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-paper shadow-[0_4px_18px_rgba(33,106,73,0.14)]" aria-hidden>
            <Glyph name="leaf" size={18} />
          </span>
          MarketLink
        </NavLink>

        <nav aria-label="Primary" className="order-3 -mx-4 flex w-[calc(100%+2rem)] flex-nowrap gap-1 overflow-x-auto border-t border-line/50 px-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:order-none md:mx-0 md:w-auto md:flex-1 md:justify-center md:overflow-visible md:border-0 md:px-0 md:pt-0">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.to === '/notifications' && unread ? `${l.label} · ${unread}` : l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <Link to="/markets" aria-label="Search markets" className="grid h-10 w-10 place-items-center rounded-xl text-muted transition hover:bg-elevated hover:text-primary">
            <Glyph name="search" size={19} />
          </Link>
          <Link to="/cart" aria-label={`Cart, ${cartCount} items`} className="relative grid h-10 w-10 place-items-center rounded-xl text-muted transition hover:bg-elevated hover:text-primary">
            <Glyph name="basket" size={19} />
            {cartCount > 0 ? <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-block">{cartCount}</span> : null}
          </Link>
          <AccountSlot />
        </div>
      </div>
    </header>
  );
}
