import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Glyph } from '../art/glyphs';
import { AccountSlot } from './AccountSlot';
import { Avatar } from '../ui/Avatar';
import { homeFor } from '../../auth/paths';
import { cartEventName, readCart } from '../../lib/cart';
import { useAuth } from '../../auth/AuthProvider';
import { localAvatarEventName, readLocalAvatar } from '../../lib/localAvatar';
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

const SEARCH_HISTORY_KEY = 'marketlink.search-history.v1';
const POPULAR_SEARCHES = ['Tomatoes', 'Plantain', 'Yam'];

function readSearchHistory(): string[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(SEARCH_HISTORY_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').slice(0, 6)
      : [];
  } catch {
    return [];
  }
}

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
  const [searchHistory, setSearchHistory] = useState<string[]>(readSearchHistory);
  const searchInput = useRef<HTMLInputElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);
  useEffect(() => setMobileMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!profile) { setLocalAvatar(null); return; }
    const update = () => setLocalAvatar(readLocalAvatar(profile.id));
    update();
    const eventName = localAvatarEventName();
    window.addEventListener(eventName, update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener(eventName, update);
      window.removeEventListener('storage', update);
    };
  }, [profile?.id]);
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
    runSearch(searchText);
  }
  function rememberSearch(value: string) {
    const query = value.trim();
    if (!query) return;
    const nextHistory = [query, ...searchHistory.filter((item) => item.toLocaleLowerCase() !== query.toLocaleLowerCase())].slice(0, 6);
    setSearchHistory(nextHistory);
    try {
      window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistory));
    } catch {
      // Search still works if this browser blocks local storage.
    }
  }
  function runSearch(value: string) {
    const query = value.trim();
    if (!query) return;
    rememberSearch(query);
    setSearchText(query);
    setSearchOpen(false);
    navigate(`/products?q=${encodeURIComponent(query)}`);
  }
  function clearSearchHistory() {
    setSearchHistory([]);
    try {
      window.localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {
      // Clearing the visible list still works if this browser blocks local storage.
    }
  }
  const showOrders = profile?.role === 'farmer'
    && (pathname === '/farmers/dashboard' || pathname.startsWith('/orders'));
  const visibleLinks = links.filter((link) => link.to !== '/orders' || showOrders);

  const mobileTabs = [
    { to: '/', label: 'Home', icon: 'sprout' as const, end: true },
    { to: '/markets', label: 'Markets', icon: 'stall' as const },
    { to: '/products', label: 'Produce', icon: 'grid' as const },
    { to: '/farmers', label: 'Farmers', icon: 'farm' as const },
  ];

  return <>
    <header className="sticky top-0 z-40 px-2 pt-2 sm:px-3 sm:pt-3">
      <div className="relative mx-auto flex max-w-[1720px] flex-wrap items-center gap-x-2 gap-y-2 rounded-2xl border border-line bg-sheet/95 px-3 py-2.5 shadow-[0_10px_30px_rgba(21,39,29,0.10)] backdrop-blur-2xl sm:gap-x-4 sm:px-4 md:px-6 xl:flex-nowrap">
        <NavLink to="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-extrabold tracking-tight sm:gap-3 sm:text-xl">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-accent text-paper shadow-[0_4px_18px_rgba(33,106,73,0.18)] sm:h-11 sm:w-11" aria-hidden><Glyph name="leaf" size={21} /></span>MarketLink
        </NavLink>
        <button type="button" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen} aria-controls="mobile-primary-navigation" onClick={() => setMobileMenuOpen((open) => !open)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-white text-primary transition hover:bg-elevated xl:hidden">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">{mobileMenuOpen ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}</svg>
        </button>
        <nav aria-label="Primary" className="hidden flex-nowrap gap-1 xl:flex xl:flex-1 xl:justify-center">
          {visibleLinks.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}><Glyph name={l.icon} size={18} /><span>{l.label}</span>{l.to === '/notifications' && unread ? <span aria-label={`${unread} unread`} className="h-2 w-2 rounded-full bg-danger" /> : null}</NavLink>)}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 xl:hidden">
          <Link to="/notifications" aria-label={`Alerts${unread ? `, ${unread} unread` : ''}`} className="relative grid h-10 w-10 place-items-center rounded-full text-primary transition hover:bg-elevated"><Glyph name="bell" size={21} />{unread ? <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-sheet bg-danger" /> : null}</Link>
          <Link to={profile ? homeFor(profile.role) : '/signin'} aria-label={profile ? `Account: ${profile.full_name}` : 'Sign in'} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-elevated text-sm font-semibold text-primary">
            {profile ? <Avatar src={localAvatar ?? profile.avatar_url} size={34} /> : <Avatar size={28} />}
          </Link>
        </div>

        <div className="relative order-4 w-full xl:order-none xl:w-72" onMouseLeave={() => setSearchOpen(false)}>
          <form onSubmit={submitSearch} role="search" className="flex h-12 items-center gap-2 rounded-full border border-line bg-elevated/70 px-3.5 text-sm text-primary transition focus-within:border-accent/50 focus-within:bg-white sm:px-4 xl:h-11">
            <Glyph name="search" size={20} /><label className="sr-only" htmlFor="global-market-search">Search markets, farmers or produce</label>
            <input ref={searchInput} id="global-market-search" value={searchText} onFocus={() => setSearchOpen(true)} onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)} onChange={(event) => { setSearchText(event.target.value); setSearchOpen(true); }} onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }} placeholder="Search products, markets, or farmers…" autoComplete="off" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted" />
            <button type="button" aria-label="Show recent searches" aria-expanded={searchOpen} onMouseEnter={() => setSearchOpen(true)} onFocus={() => setSearchOpen(true)} onClick={() => setSearchOpen(true)} className="group grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-on-block transition-colors hover:bg-accent/90"><svg aria-hidden="true" viewBox="0 0 24 24" className={`h-4 w-4 transition-transform duration-300 motion-reduce:transition-none ${searchOpen ? 'rotate-90' : 'group-hover:rotate-90 group-active:rotate-180'}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h10M18 7h2M4 17h2m4 0h10M14 5v4M8 15v4" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg></button>
          </form>
          {searchOpen ? <div className="search-panel-slide absolute right-0 top-[calc(100%+0.55rem)] z-50 max-h-[min(70vh,28rem)] w-[min(90vw,26rem)] overflow-y-auto rounded-2xl border border-line bg-white p-2 text-primary shadow-[0_18px_50px_rgba(10,35,25,.2)]" onMouseDown={(event) => event.preventDefault()}>
            {searchText.trim().length >= 2 ? <>
              {products.isFetching || farmers.isFetching || markets.isFetching ? <p className="px-3 py-2 text-sm text-muted">Searching…</p> : null}
              {!products.isFetching && !farmers.isFetching && !markets.isFetching && !hasResults ? <p className="px-3 py-3 text-sm text-muted">No matching markets, farmers, or produce.</p> : null}
              {products.data?.data.length ? <section><h2 className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">Produce</h2>{products.data.data.slice(0, 3).map((item) => <Link key={item.id} to={`/products/${item.id}`} onClick={() => { rememberSearch(searchText); setSearchOpen(false); }} className="block rounded-xl px-3 py-2 text-sm hover:bg-elevated"><span className="block font-semibold">{item.name}</span><span className="text-xs text-muted">{item.farmer.stall_name}</span></Link>)}</section> : null}
              {farmers.data?.data.length ? <section><h2 className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">Farmers</h2>{farmers.data.data.slice(0, 3).map((item) => <Link key={item.id} to={`/farmers/${item.id}`} onClick={() => { rememberSearch(searchText); setSearchOpen(false); }} className="block rounded-xl px-3 py-2 text-sm hover:bg-elevated"><span className="block font-semibold">{item.stall_name}</span><span className="text-xs text-muted">{item.contact_person}</span></Link>)}</section> : null}
              {markets.data?.data.length ? <section><h2 className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">Markets</h2>{markets.data.data.slice(0, 3).map((item) => <Link key={item.id} to={`/markets/${item.id}`} onClick={() => { rememberSearch(searchText); setSearchOpen(false); }} className="block rounded-xl px-3 py-2 text-sm hover:bg-elevated"><span className="block font-semibold">{item.name}</span><span className="text-xs text-muted">{item.city}, {item.state}</span></Link>)}</section> : null}
              <button type="button" onClick={() => runSearch(searchText)} className="mt-1 w-full rounded-xl border-t border-line px-3 py-2.5 text-left text-sm font-semibold text-accent hover:bg-elevated">See all results for “{searchText.trim()}”</button>
            </> : <>
              {searchHistory.length ? <section>
                <div className="flex items-center justify-between px-3 pb-1 pt-2"><h2 className="text-[10px] font-bold uppercase tracking-wider text-muted">Recent searches</h2><button type="button" onClick={clearSearchHistory} className="text-xs font-semibold text-accent hover:underline">Clear</button></div>
                {searchHistory.map((item) => <button key={item} type="button" onClick={() => runSearch(item)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-primary hover:bg-elevated"><Glyph name="search" size={15} className="shrink-0 text-muted" /><span className="truncate">{item}</span></button>)}
              </section> : <p className="px-3 pb-2 pt-3 text-sm text-muted">No recent searches yet. Try a popular search below.</p>}
              <section>
                <h2 className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">Popular searches</h2>
                <div className="flex flex-wrap gap-2 px-3 pb-2 pt-1">{POPULAR_SEARCHES.map((item) => <button key={item} type="button" onClick={() => runSearch(item)} className="rounded-full border border-line bg-elevated/70 px-3 py-1.5 text-xs font-semibold text-primary transition hover:border-accent/40 hover:bg-accent-soft">{item}</button>)}</div>
              </section>
            </>}
          </div> : null}
        </div>

        <div className="ml-auto hidden shrink-0 items-center gap-2 xl:flex">
          <Link to="/cart" aria-label={`Cart, ${cartCount} items`} className="relative grid h-11 w-11 place-items-center rounded-full text-primary transition hover:bg-elevated"><Glyph name="basket" size={22} />{cartCount > 0 ? <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-block">{cartCount}</span> : null}</Link>
          <AccountSlot />
        </div>

        {mobileMenuOpen ? <div id="mobile-primary-navigation" className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 rounded-2xl border border-line bg-white p-2 shadow-[0_16px_42px_rgba(21,39,29,.18)] xl:hidden"><nav aria-label="Mobile primary" className="grid gap-1">
          {visibleLinks.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition ${isActive ? 'bg-accent-soft text-accent' : 'text-primary hover:bg-elevated'}`}><Glyph name={l.icon} size={19} /><span>{l.label}</span>{l.to === '/notifications' && unread ? <span className="ml-auto rounded-full bg-danger px-2 py-0.5 text-xs text-white">{unread} new</span> : null}</NavLink>)}
          <NavLink to="/cart" className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-semibold transition ${isActive ? 'bg-accent-soft text-accent' : 'text-primary hover:bg-elevated'}`}><Glyph name="basket" size={19} /><span>Cart</span>{cartCount ? <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-xs text-on-block">{cartCount}</span> : null}</NavLink>
        </nav></div> : null}
      </div>
    </header>
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-sheet/95 px-2 pt-2 shadow-[0_-8px_28px_rgba(21,39,29,.09)] backdrop-blur-xl [padding-bottom:max(env(safe-area-inset-bottom),0.5rem)] xl:hidden">
      {mobileTabs.map((tab) => <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition ${isActive ? 'text-accent' : 'text-muted'}`}><Glyph name={tab.icon} size={20} /><span>{tab.label}</span></NavLink>)}
      <NavLink to="/cart" aria-label={`Cart${cartCount ? `, ${cartCount} items` : ''}`} className={({ isActive }) => `relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition ${isActive ? 'text-accent' : 'text-muted'}`}><span className="relative"><Glyph name="basket" size={20} />{cartCount ? <span className="absolute -right-2 -top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-accent px-1 text-[9px] text-white">{cartCount}</span> : null}</span><span>Cart</span></NavLink>
    </nav>
  </>;
}
