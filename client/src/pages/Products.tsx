import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Button, buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { Input } from '../components/ui/Input';
import { Thumb } from '../components/art/Thumb';
import { useMarketList, WEEK } from '../lib/discovery';
import { useProduct, useProducts } from '../lib/products';
import type { ProductCard, ProductCategory, Weekday } from '../lib/types';
import { useAuth } from '../auth/AuthProvider';
import { addToCart } from '../lib/cart';
import { formatMinor, minorUnitDigits } from '../utils/money';
import { localProductGlyph, localProductPhoto } from '../lib/productPhoto';
import { FavoriteToggle } from '../components/FavoriteToggle';
import { Reveal } from '../motion/reveal';

const CURRENCIES = [
  ['NGN', 'Nigerian naira'], ['GHS', 'Ghanaian cedi'], ['KES', 'Kenyan shilling'],
  ['ZAR', 'South African rand'], ['XOF', 'West African CFA franc'], ['XAF', 'Central African CFA franc'],
  ['UGX', 'Ugandan shilling'], ['TZS', 'Tanzanian shilling'], ['RWF', 'Rwandan franc'],
  ['EGP', 'Egyptian pound'], ['MAD', 'Moroccan dirham'], ['ETB', 'Ethiopian birr'],
  ['BWP', 'Botswana pula'], ['ZMW', 'Zambian kwacha'], ['MZN', 'Mozambican metical'],
] as const;

function integerParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function ProductTile({ product, market }: { product: ProductCard; market: ProductCard['markets'][number] | undefined }) {
  const [added, setAdded] = useState(false);
  const available = !product.is_sold_out && (product.quantity_available ?? 0) > 0;

  function add() {
    if (!market || !available) return;
    addToCart({ product_id: product.id, market_id: market.id, quantity: 1 });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <Card className="group relative overflow-hidden transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_20px_48px_rgba(21,39,29,0.14)]">
      <div className="absolute right-3 top-3 z-10"><FavoriteToggle type="product" id={product.id} /></div>
      <Link to={`/products/${product.id}${market ? `?market_id=${encodeURIComponent(market.id)}` : ''}`} className="block overflow-hidden">
        <Thumb
          src={product.image_urls[0] ?? localProductPhoto(product.name)}
          seed={product.id}
          category={product.category.slug}
          glyph={localProductGlyph(product.name)}
          glyphSize={50}
          className="aspect-[4/3] w-full"
          imgClass="transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </Link>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/products/${product.id}${market ? `?market_id=${encodeURIComponent(market.id)}` : ''}`} className="font-semibold leading-snug hover:text-accent">
            {product.name}
          </Link>
          {product.is_organic ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-accent">Organic</span> : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted">{product.farmer.stall_name}</p>
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <span className="num font-semibold text-primary">{formatMinor(product.price_minor, product.farmer.currency)}</span>
          <span className="text-xs text-muted">/ {product.unit}</span>
        </div>
        <p className={`mt-2 text-xs ${available ? 'text-accent' : 'text-muted'}`}>
          {available ? `${product.quantity_available} available` : 'Sold out this week'}
        </p>
        <p className="mt-1 truncate text-xs text-muted">
          {market ? `${market.name} · ${market.city}` : 'Pickup market not listed'}
        </p>
        <Button
          type="button"
          size="sm"
          className="mt-3 w-full"
          disabled={!market || !available}
          onClick={add}
        >
          {added ? 'Added to cart' : 'Add to cart'}
        </Button>
      </div>
    </Card>
  );
}

export default function Products() {
  const { api } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const currency = (params.get('currency') ?? 'NGN').toUpperCase();
  const [searchDraft, setSearchDraft] = useState(q);
  const [minDraft, setMinDraft] = useState(params.get('min') ?? '');
  const [maxDraft, setMaxDraft] = useState(params.get('max') ?? '');
  const [priceError, setPriceError] = useState('');
  useEffect(() => setSearchDraft(q), [q]);
  useEffect(() => {
    setMinDraft(params.get('min') ?? '');
    setMaxDraft(params.get('max') ?? '');
  }, [params]);

  const page = Math.max(1, integerParam(params.get('page')) ?? 1);
  const filters = useMemo(() => ({
    q: q || undefined,
    category: params.get('category') || undefined,
    marketId: params.get('market_id') || undefined,
    day: (params.get('day') as Weekday | null) ?? undefined,
    currency,
    minPriceMinor: integerParam(params.get('min_price_minor')),
    maxPriceMinor: integerParam(params.get('max_price_minor')),
    inStockOnly: params.get('in_stock_only') === 'true',
    sort: (params.get('sort') as 'popular' | 'price_low' | 'price_high' | 'newest') || 'popular',
    page,
  }), [q, params, currency, page]);
  const products = useProducts(filters);
  const markets = useMarketList({});
  const categories = useQuery({ queryKey: ['product-categories'], queryFn: () => api.get<ProductCategory[]>('/categories'), staleTime: 300_000 });
  const rows = products.data?.data ?? [];
  const total = products.data?.meta.total ?? 0;

  function patch(next: Record<string, string | undefined>) {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === '') merged.delete(key);
      else merged.set(key, value);
    }
    if (!('page' in next)) merged.delete('page');
    setParams(merged, { replace: true });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    patch({ q: searchDraft.trim() || undefined });
  }

  function applyPrice(event: FormEvent) {
    event.preventDefault();
    const parse = (raw: string) => raw.trim() === '' ? undefined : Number(raw);
    const min = parse(minDraft);
    const max = parse(maxDraft);
    if ((min !== undefined && (!Number.isFinite(min) || min < 0)) ||
        (max !== undefined && (!Number.isFinite(max) || max < 0))) {
      setPriceError('Enter a valid amount in the selected currency.');
      return;
    }
    if (min !== undefined && max !== undefined && min > max) {
      setPriceError('Minimum price must not exceed maximum price.');
      return;
    }
    const factor = 10 ** minorUnitDigits(currency);
    setPriceError('');
    patch({
      min_price_minor: min === undefined ? undefined : String(Math.round(min * factor)),
      max_price_minor: max === undefined ? undefined : String(Math.round(max * factor)),
      min: minDraft || undefined,
      max: maxDraft || undefined,
    });
  }

  function clearFilters() {
    setSearchDraft('');
    setMinDraft('');
    setMaxDraft('');
    setPriceError('');
    setParams(new URLSearchParams('currency=NGN'), { replace: true });
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">MarketLink catalogue</p>
          <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">Fresh Produce</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Shop this week’s harvest from approved local farmers. Choose a market and collect your order there.</p>
        </div>
        <Link to="/cart" className={buttonClass('ghost', 'sm')}>View cart</Link>
      </header>

      <div className="mt-7 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit space-y-5 self-start rounded-2xl border border-line bg-surface p-4" aria-label="Product filters">
          <div>
            <h2 className="font-display text-lg font-semibold">Categories</h2>
            <div className="mt-3 flex flex-wrap gap-2 lg:flex-col">
              {(categories.data ?? []).map((category) => (
                <Chip
                  key={category.slug}
                  active={params.get('category') === category.slug}
                  className="justify-start lg:w-full"
                  onClick={() => patch({ category: params.get('category') === category.slug ? undefined : category.slug })}
                >
                  {category.name}
                </Chip>
              ))}
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <label htmlFor="product-day" className="text-sm font-semibold">Market day</label>
            <select
              id="product-day"
              value={params.get('day') ?? ''}
              onChange={(event) => patch({ day: event.target.value || undefined })}
              className="mt-2 h-10 w-full rounded-xl border border-line bg-elevated px-3 text-sm text-primary outline-none focus:border-accent"
            >
              <option value="">Any day</option>
              {WEEK.map((day) => <option key={day.code} value={day.code}>{day.label}</option>)}
            </select>
          </div>

          <div className="border-t border-line pt-4">
            <label htmlFor="product-market" className="text-sm font-semibold">Pickup market</label>
            <select
              id="product-market"
              value={params.get('market_id') ?? ''}
              onChange={(event) => patch({ market_id: event.target.value || undefined })}
              className="mt-2 h-10 w-full rounded-xl border border-line bg-elevated px-3 text-sm text-primary outline-none focus:border-accent"
            >
              <option value="">All markets</option>
              {(markets.data?.data ?? []).map((market) => (
                <option key={market.id} value={market.id}>{market.name} · {market.city}</option>
              ))}
            </select>
          </div>

          <div className="border-t border-line pt-4">
            <label htmlFor="product-currency" className="text-sm font-semibold">Price currency</label>
            <select
              id="product-currency"
              value={currency}
              onChange={(event) => patch({ currency: event.target.value, min: undefined, max: undefined, min_price_minor: undefined, max_price_minor: undefined })}
              className="mt-2 h-10 w-full rounded-xl border border-line bg-elevated px-3 text-sm text-primary outline-none focus:border-accent"
            >
              {CURRENCIES.map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
            </select>
            <form onSubmit={applyPrice} className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Input label="Min" type="number" min="0" step="any" value={minDraft} onChange={(e) => setMinDraft(e.target.value)} placeholder="0" />
                <Input label="Max" type="number" min="0" step="any" value={maxDraft} onChange={(e) => setMaxDraft(e.target.value)} placeholder="Any" />
              </div>
              {priceError ? <p role="alert" className="text-xs text-danger">{priceError}</p> : null}
              <Button type="submit" size="sm" className="w-full">Apply price</Button>
            </form>
          </div>

          <label className="flex items-center gap-2 border-t border-line pt-4 text-sm">
            <input
              type="checkbox"
              checked={params.get('in_stock_only') === 'true'}
              onChange={(event) => patch({ in_stock_only: event.target.checked ? 'true' : undefined })}
              className="accent-accent"
            />
            In stock this week
          </label>
          <button type="button" onClick={clearFilters} className="text-sm text-muted underline decoration-line underline-offset-4 hover:text-primary">Clear filters</button>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <form onSubmit={submitSearch} className="flex min-w-[min(100%,20rem)] flex-1 gap-2">
              <Input label="Search products or farmers" value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} placeholder="Tomatoes, ugu, a farmer…" />
              <Button type="submit" size="sm" className="mt-[1.55rem]">Search</Button>
            </form>
            <label className="text-sm text-muted">
              Sort by
              <select
                value={params.get('sort') ?? 'popular'}
                onChange={(event) => patch({ sort: event.target.value })}
                className="ml-2 h-10 rounded-xl border border-line bg-elevated px-3 text-sm text-primary outline-none focus:border-accent"
              >
                <option value="popular">Popular</option>
                <option value="price_low">Price: low to high</option>
                <option value="price_high">Price: high to low</option>
                <option value="newest">Recently added</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <p>{products.isPending ? 'Loading produce…' : `${total} ${total === 1 ? 'product' : 'products'}`}</p>
            {products.data?.meta.total ? <p>Prices in {currency}</p> : null}
          </div>

          {products.isError ? (
            <Card className="mt-4 p-6 text-sm text-muted">
              We couldn’t load products right now. Check your connection and try again.
              <Button type="button" size="sm" variant="ghost" className="ml-3" onClick={() => void products.refetch()}>Retry</Button>
            </Card>
          ) : products.isPending ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading products">
              {Array.from({ length: 6 }, (_, index) => <Card key={index} className="h-[23rem] animate-pulse bg-elevated"><span className="sr-only">Loading product</span></Card>)}
            </div>
          ) : rows.length === 0 ? (
            <Card className="mt-4 p-10 text-center">
              <h2 className="font-display text-xl font-semibold">No products match those filters</h2>
              <p className="mt-2 text-sm text-muted">Try another market, currency, or category.</p>
              <Button type="button" variant="ghost" size="sm" className="mt-4" onClick={clearFilters}>Show all produce</Button>
            </Card>
          ) : (
            <>
              <Reveal className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" y={18} stagger={0.045}>
                {rows.map((product) => {
                  const requestedMarket = params.get('market_id');
                  const requestedDay = params.get('day');
                  const market = product.markets.find((entry) => entry.id === requestedMarket)
                    ?? (requestedDay ? product.markets.find((entry) => entry.days.includes(requestedDay)) : undefined)
                    ?? product.markets[0];
                  return <ProductTile key={product.id} product={product} market={market} />;
                })}
              </Reveal>
              {(page * (products.data?.meta.limit ?? 24)) < total ? (
                <div className="mt-6 text-center">
                  <Button type="button" variant="ghost" onClick={() => patch({ page: String(page + 1) })}>Load more</Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function ProductDetail() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const product = useProduct(id);
  const [quantity, setQuantity] = useState(1);
  const [marketId, setMarketId] = useState(searchParams.get('market_id') ?? '');
  const [added, setAdded] = useState(false);
  const item = product.data;
  useEffect(() => {
    if (item && !item.markets.some((market) => market.id === marketId)) {
      const requested = searchParams.get('market_id');
      setMarketId(item.markets.some((market) => market.id === requested) ? requested! : item.markets[0]?.id ?? '');
    }
  }, [item, marketId, searchParams]);

  if (product.isPending) return <div className="mx-auto max-w-6xl px-4 py-12 text-muted">Loading product…</div>;
  if (product.isError || !item) return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Product unavailable</h1>
      <p className="mt-2 text-sm text-muted">This listing may have been removed or the server is offline.</p>
      <Link to="/products" className={`${buttonClass('ghost', 'sm')} mt-5`}>Back to produce</Link>
    </section>
  );

  const stock = item.quantity_available ?? 0;
  const canAdd = stock > 0 && !item.is_sold_out && Boolean(marketId);
  function add() {
    if (!canAdd) return;
    addToCart({ product_id: item!.id, market_id: marketId, quantity });
    setAdded(true);
    window.setTimeout(() => navigate('/cart'), 500);
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <Link to="/products" className="text-sm text-muted hover:text-primary">← Fresh Produce</Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <Thumb
          src={item.image_urls[0] ?? localProductPhoto(item.name)}
          seed={item.id}
          category={item.category.slug}
          glyph={localProductGlyph(item.name)}
          glyphSize={96}
          className="aspect-square w-full rounded-2xl md:aspect-[5/4]"
        />
      <div className="flex flex-col justify-center">
          <div className="flex items-center justify-between gap-3"><p className="text-sm text-accent">{item.category.name} · {item.farmer.stall_name}</p><FavoriteToggle type="product" id={item.id} /></div>
          <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">{item.name}</h1>
          <p className="mt-4 text-2xl font-semibold text-primary">{formatMinor(item.price_minor, item.farmer.currency)} <span className="text-sm font-normal text-muted">/ {item.unit}</span></p>
          {item.description ? <p className="mt-4 leading-relaxed text-muted">{item.description}</p> : null}
          {item.is_organic ? <p className="mt-4 inline-flex w-fit rounded-full bg-accent-soft px-3 py-1 text-sm text-accent">Organic</p> : null}
          <p className={`mt-5 text-sm ${canAdd ? 'text-accent' : 'text-muted'}`}>
            {canAdd ? `${stock} available this week` : 'Currently sold out'}
          </p>
          <label htmlFor="pickup-market" className="mt-5 text-sm text-muted">Pickup market</label>
          <select
            id="pickup-market"
            value={marketId}
            onChange={(event) => setMarketId(event.target.value)}
            className="mt-2 h-11 rounded-xl border border-line bg-elevated px-3 text-primary outline-none focus:border-accent"
          >
            {item.markets.length === 0 ? <option value="">No pickup market listed</option> : null}
            {item.markets.map((market) => <option key={market.id} value={market.id}>{market.name} · {market.city}</option>)}
          </select>
          <div className="mt-5 flex items-end gap-3">
            <Input label="Quantity" type="number" min="1" max={stock} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(stock || 1, Number(event.target.value) || 1)))} className="max-w-28" />
            <Button type="button" className="flex-1" disabled={!canAdd} onClick={add}>{added ? 'Added to cart' : 'Add to cart'}</Button>
          </div>
          <Link to={`/farmers/${item.farmer.id}`} className="mt-5 text-sm text-muted underline decoration-line underline-offset-4">Visit {item.farmer.stall_name}</Link>
        </div>
      </div>
    </section>
  );
}
