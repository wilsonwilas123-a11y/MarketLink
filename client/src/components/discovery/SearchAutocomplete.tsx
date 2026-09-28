import { useEffect, useId, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthProvider';
import { searchParams } from '../../lib/discovery';
import type { ApiPage, FarmerSummary, Market, ProductCard } from '../../lib/types';

type SearchKind = 'products' | 'farmers' | 'markets';
const allKinds: SearchKind[] = ['products', 'farmers', 'markets'];

/** A page search field with live, cross-catalog suggestions as the user types. */
export function SearchAutocomplete({
  label,
  value,
  onChange,
  placeholder,
  className = '',
  kinds = allKinds,
  resultPath = '/products',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  kinds?: SearchKind[];
  resultPath?: string;
}) {
  const { api } = useAuth();
  const id = useId();
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(value.trim()), 200);
    return () => window.clearTimeout(timer);
  }, [value]);
  const enabled = query.length >= 2;
  const products = useQuery({
    queryKey: ['field-search', 'products', query], enabled: enabled && kinds.includes('products'), staleTime: 30_000,
    queryFn: () => api.get<ApiPage<ProductCard>>(`/products${searchParams({ q: query, limit: 4 })}`),
  });
  const farmers = useQuery({
    queryKey: ['field-search', 'farmers', query], enabled: enabled && kinds.includes('farmers'), staleTime: 30_000,
    queryFn: () => api.get<ApiPage<FarmerSummary>>(`/farmers${searchParams({ q: query, limit: 4 })}`),
  });
  const markets = useQuery({
    queryKey: ['field-search', 'markets', query], enabled: enabled && kinds.includes('markets'), staleTime: 30_000,
    queryFn: () => api.get<ApiPage<Market>>(`/markets${searchParams({ q: query, limit: 4 })}`),
  });
  const loading = (kinds.includes('products') && products.isFetching)
    || (kinds.includes('farmers') && farmers.isFetching)
    || (kinds.includes('markets') && markets.isFetching);
  const found = Boolean(
    (kinds.includes('products') && products.data?.data.length)
    || (kinds.includes('farmers') && farmers.data?.data.length)
    || (kinds.includes('markets') && markets.data?.data.length),
  );
  const showList = focused && value.trim().length >= 2;
  const closeSoon = () => window.setTimeout(() => setFocused(false), 120);
  const suggestions = (kind: SearchKind, rows: (ProductCard | FarmerSummary | Market)[] | undefined) => {
    if (!rows?.length) return null;
    const heading = kind === 'products' ? 'Produce' : kind === 'farmers' ? 'Farmers' : 'Markets';
    return <section key={kind}>
      <h3 className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">{heading}</h3>
      {rows.slice(0, 3).map((row) => {
        const href = kind === 'products' ? `/products/${row.id}` : kind === 'farmers' ? `/farmers/${row.id}` : `/markets/${row.id}`;
        const title = kind === 'farmers'
          ? (row as FarmerSummary).stall_name
          : kind === 'products'
            ? (row as ProductCard).name
            : (row as Market).name;
        const subtitle = kind === 'products'
          ? (row as ProductCard).farmer.stall_name
          : kind === 'farmers'
            ? (row as FarmerSummary).contact_person
            : `${(row as Market).city}, ${(row as Market).state}`;
        return <Link key={row.id} to={href} onClick={() => setFocused(false)} className="block rounded-xl px-3 py-2 text-sm hover:bg-elevated">
          <span className="block font-semibold">{title}</span><span className="text-xs text-muted">{subtitle}</span>
        </Link>;
      })}
    </section>;
  };

  return <div className="relative min-w-0">
    <label htmlFor={id} className="mb-1.5 block text-sm text-muted">{label}</label>
    <input id={id} value={value} onFocus={() => setFocused(true)} onBlur={closeSoon}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      onKeyDown={(event) => { if (event.key === 'Escape') setFocused(false); }}
      placeholder={placeholder} autoComplete="off"
      className={`h-11 w-full rounded-xl border border-line bg-elevated/75 px-3.5 text-primary outline-none transition placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/10 ${className}`} />
    {showList ? <div role="listbox" aria-label="Search suggestions" onMouseDown={(event) => event.preventDefault()}
      className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-line bg-white p-2 text-primary shadow-[0_18px_50px_rgba(10,35,25,.2)]">
      {loading ? <p className="px-3 py-2 text-sm text-muted">Searching…</p> : null}
      {!loading && !found ? <p className="px-3 py-3 text-sm text-muted">No matches yet.</p> : null}
      {kinds.includes('products') ? suggestions('products', products.data?.data) : null}
      {kinds.includes('farmers') ? suggestions('farmers', farmers.data?.data) : null}
      {kinds.includes('markets') ? suggestions('markets', markets.data?.data) : null}
      <Link to={`${resultPath}?q=${encodeURIComponent(value.trim())}`} onClick={() => setFocused(false)} className="mt-1 block border-t border-line px-3 py-2.5 text-sm font-semibold text-accent hover:bg-elevated">See all results for “{value.trim()}”</Link>
    </div> : null}
  </div>;
}
