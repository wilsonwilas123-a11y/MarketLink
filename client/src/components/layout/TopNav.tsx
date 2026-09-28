import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Glyph } from '../art/glyphs';
import { AccountSlot } from './AccountSlot';
import { cartEventName, readCart } from '../../lib/cart';
import { useAuth } from '../../auth/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { searchParams } from '../../lib/discovery';
import type { ApiPage, FarmerSummary, Market, ProductCard } from '../../lib/types';

const links = [
  { to: '/', label: 'Discover', end: true, icon: 'sprout' },
  { to: '/markets', label: 'Markets', icon: 'stall', end: false },
  { to: '/products', label: 'Products', icon: 'grid', end: false },
  { to: '/farmers', label: 'Farmers', icon: 'farm', end: false },
  { to: '/orders', label: 'Orders', icon: 'basket', end: false },
  { to: '/notifications', label: 'Alerts', icon: 'bell', end: false },
] as const;

function linkClass({ isActive }: { isActive: boolean }) {
  return `flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2.5 text-sm font-semibold transition-[background,color,box-shadow,transform] duration-200 ${
    isActive ? 'bg-accent text-on-block shadow-[0_8px_20px_rgba(33,106,73,0.20)]' : 'text-primary hover:bg-elevated'
  }`;
}

export function TopNav() {
  const { api, profile, status } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
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
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchText.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [searchText]);
  const canSearch = searchQuery.length >= 2;
  const products = useQuery({
    queryKey: ['nav-search', 'products', searchQuery],
    enabled: canSearch,
    staleTime: 30_000,
    queryFn: () => api.get<ApiPage<ProductCard>>(`/products${searchParams({ q: searchQuery, limit: 4 })}`),
  });
  const farmers = useQuery({
    queryKey: ['nav-search', 'farmers', searchQuery],
    enabled: canSearch,
    staleTime: 30_000,
    queryFn: () => api.get<ApiPage<FarmerSummary>>(`/farmers${searchParams({ q: searchQuery, limit: 4 })}`),
  });
  const markets = useQuery({
    queryKey: ['nav-search', 'markets', searchQuery],
    enabled: canSearch,
    staleTime: 30_000,
    queryFn: () => api.get<ApiPage<Market>>(`/markets${searchParams({ q: searchQuery, limit: 4 })}`),
  });
  const hasResults = Boolean(products.data?.data.length || farmers.data?.data.length || markets.data?.data.length);
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = searchText.trim();
    if (query) {
      setSearchOpen(false);
      navigate(`/products?q=${encodeURIComponent(query)}`);
    }
  }
  const showOrders = profile?.role === 'farmer'
    && (pathname === '/farmers/dashboard' || pathname.startsWith('/orders'));
  const visibleLinks = links.filter((link) => link.to !== '/orders' || showOrders);

  return (
    <header className="sticky top-0 z-40 px-2 pt-2">
      <div className="mx-auto flex max-w-[1720px] flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl border border-line bg-sheet/95 px-4 py-2.5 shadow-[0_10px_30px_rgba(21,39,29,0.10)] backdrop-blur-2xl md:px-6">
        <NavLink to="/" className="flex shrink-0 items-center gap-3 font-display text-xl font-extrabold tracking-tight">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent text-paper shadow-[0_4px_18px_rgba(33,106,73,0.18)]" aria-hidden>
            <Glyph name="leaf" size={21} />
          </span>
          MarketLink
        </NavLink>

        <nav aria-label="Primary" className="order-3 -mx-4 flex w-[calc(100%+2rem)] flex-nowrap gap-1 overflow-x-auto border-t border-line/50 px-3 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:order-none xl:mx-0 xl:w-auto xl:flex-1 xl:justify-center xl:overflow-visible xl:border-0 xl:px-0 xl:pt-0">
          {visibleLinks.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              <Glyph name={l.icon} size={18} />
              <span>{l.label}</span>
              {l.to === '/notifications' && unread ? <span aria-label={`${unread} unread`} className="h-2 w-2 rounded-full bg-danger" /> : null}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
          <div className="relative w-[min(46vw,17rem)] sm:w-64 xl:w-72">
            <form onSubmit={submitSearch} role="search" className="flex h-11 items-center gap-2 rounded-full border border-line bg-elevated/70 px-3 text-sm text-primary transition focus-within:border-accent/50 focus-within:bg-white">
              <Glyph name="search" size={19} />
              <label className="sr-only" htmlFor="global-market-search">Search markets, farmers or produce</label>
              <input id="global-market-search" value={searchText} onFocus={() => setSearchOpen(true)} onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)} onChange={(event) => { setSearchText(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }} placeholder="Search…" autoComplete="off" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
            </form>
            {searchOpen && searchText.trim().length >= 2 ? <div className="absolute right-0 top-[calc(100%+0.55rem)] z-50 max-h-[min(70vh,28rem)] w-[min(90vw,26rem)] overflow-y-auto rounded-2xl border border-line bg-white p-2 text-primary shadow-[0_18px_50px_rgba(10,35,25,.2)]" onMouseDown={(event) => event.preventDefault()}>
              {products.isFetching || farmers.isFetching || markets.isFetching ? <p className="px-3 py-2 text-sm text-muted">Searching…</p> : null}
              {!products.isFetching && !farmers.isFetching && !markets.isFetching && !hasResults ? <p className="px-3 py-3 text-sm text-muted">No matching markets, farmers, or produce.</p> : null}
              {products.data?.data.length ? <section><h2 className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">Produce</h2>{products.data.data.slice(0,3).map((item)=><Link key={item.id} to={`/products/${item.id}`} onClick={()=>setSearchOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-elevated"><span className="block font-semibold">{item.name}</span><span className="text-xs text-muted">{item.farmer.stall_name}</span></Link>)}</section> : null}
              {farmers.data?.data.length ? <section><h2 className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">Farmers</h2>{farmers.data.data.slice(0,3).map((item)=><Link key={item.id} to={`/farmers/${item.id}`} onClick={()=>setSearchOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-elevated"><span className="block font-semibold">{item.stall_name}</span><span className="text-xs text-muted">{item.contact_person}</span></Link>)}</section> : null}
              {markets.data?.data.length ? <section><h2 className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">Markets</h2>{markets.data.data.slice(0,3).map((item)=><Link key={item.id} to={`/markets/${item.id}`} onClick={()=>setSearchOpen(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-elevated"><span className="block font-semibold">{item.name}</span><span className="text-xs text-muted">{item.city}, {item.state}</span></Link>)}</section> : null}
              <button type="button" onClick={()=>{setSearchOpen(false);navigate(`/products?q=${encodeURIComponent(searchText.trim())}`);}} className="mt-1 w-full rounded-xl border-t border-line px-3 py-2.5 text-left text-sm font-semibold text-accent hover:bg-elevated">See produce results for “{searchText.trim()}”</button>
            </div> : null}
          </div>
          <Link to="/cart" aria-label={`Cart, ${cartCount} items`} className="relative grid h-11 w-11 place-items-center rounded-full text-primary transition hover:bg-elevated">
            <Glyph name="basket" size={22} />
            {cartCount > 0 ? <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-block">{cartCount}</span> : null}
          </Link>
          <AccountSlot />
        </div>
      </div>
    </header>
  );
}
