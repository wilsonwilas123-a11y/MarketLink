import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { Button, buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { Input } from '../components/ui/Input';
import { Thumb } from '../components/art/Thumb';
import { useProduct, useProducts } from '../lib/products';
import type { ProductCard, ProductCategory } from '../lib/types';
import { useAuth } from '../auth/AuthProvider';
import { addToCart } from '../lib/cart';
import { formatMajor, formatMinor } from '../utils/money';
import { productPriceInCurrency, useExchangeRates, type ExchangeRates } from '../lib/exchangeRates';
import { localProductGlyph, localProductPhoto } from '../lib/productPhoto';
import { currencyForCountry } from '../lib/countries';
import { FavoriteToggle } from '../components/FavoriteToggle';
import { Reveal } from '../motion/reveal';
import { SearchAutocomplete } from '../components/discovery/SearchAutocomplete';

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

function ProductTile({
  product,
  market,
  currency,
  rates,
  photo,
}: {
  product: ProductCard;
  market: ProductCard['markets'][number] | undefined;
  currency: string;
  rates?: ExchangeRates;
  photo?: string;
}) {
  const [added, setAdded] = useState(false);
  const available = !product.is_sold_out && (product.quantity_available ?? 0) > 0;
  const convertedPrice = productPriceInCurrency(product, currency, rates);
  const productHref = `/products/${product.id}?${new URLSearchParams({
    ...(market ? { market_id: market.id } : {}),
    currency,
  }).toString()}`;

  function add() {
    if (!market || !available) return;
    addToCart({ product_id: product.id, market_id: market.id, quantity: 1 });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <Card className="group relative overflow-hidden transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_20px_48px_rgba(21,39,29,0.14)]">
      <div className="absolute right-3 top-3 z-10"><FavoriteToggle type="product" id={product.id} /></div>
      <Link to={productHref} className="block overflow-hidden">
        <Thumb
          src={photo}
          seed={product.id}
          category={product.category.slug}
          glyph={localProductGlyph(product.name)}
          glyphSize={50}
          className="aspect-[4/3] w-full"
          imgClass="transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </Link>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={productHref} className="text-lg font-semibold leading-snug hover:text-accent">
            {product.name}
          </Link>
          {product.is_organic ? <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent">Organic</span> : null}
        </div>
        <p className="mt-1 truncate text-sm text-muted">{product.farmer.stall_name}</p>
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <span className="num text-lg font-semibold text-primary">{convertedPrice === null
            ? formatMinor(product.price_minor, product.farmer.currency)
            : formatMajor(convertedPrice, currency)}</span>
          <span className="text-sm text-muted">/ {product.unit}</span>
        </div>
        <p className={`mt-2 text-sm ${available ? 'text-accent' : 'text-muted'}`}>
          {available ? `${product.quantity_available} available` : 'Sold out this week'}
        </p>
        <p className="mt-1 truncate text-sm text-muted">
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
  const { api, profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const currency = (params.get('currency') ?? currencyForCountry(profile?.country)).toUpperCase();
  const [searchDraft, setSearchDraft] = useState(q);
  const [minDraft, setMinDraft] = useState(params.get('min') ?? '');
  const [maxDraft, setMaxDraft] = useState(params.get('max') ?? '');
  const [priceError, setPriceError] = useState('');
  const exchangeRates = useExchangeRates();
  useEffect(() => setSearchDraft(q), [q]);
  useEffect(() => {
    setMinDraft(params.get('min') ?? '');
    setMaxDraft(params.get('max') ?? '');
  }, [params]);

  const page = Math.max(1, integerParam(params.get('page')) ?? 1);
  const sort = (params.get('sort') as 'popular' | 'price_low' | 'price_high' | 'newest') || 'popular';
  const filters = useMemo(() => ({
    q: q || undefined,
    category: params.get('category') || undefined,
    marketId: params.get('market_id') || undefined,
    inStockOnly: params.get('in_stock_only') === 'true',
    sort: sort === 'price_low' || sort === 'price_high' ? 'popular' : sort,
    page,
    limit: 100,
  }), [q, params, page, sort]);
  const products = useProducts(filters);
  const categories = useQuery({ queryKey: ['product-categories'], queryFn: () => api.get<ProductCategory[]>('/categories'), staleTime: 300_000 });
  const rows = products.data?.data ?? [];
  const minPrice = params.has('min') ? Number(params.get('min')) : undefined;
  const maxPrice = params.has('max') ? Number(params.get('max')) : undefined;
  const visibleRows = useMemo(() => {
    let result = rows.filter((product) => {
      const price = productPriceInCurrency(product, currency, exchangeRates.data);
      if (price === null) return true;
      return (minPrice === undefined || price >= minPrice) && (maxPrice === undefined || price <= maxPrice);
    });
    if (sort === 'price_low' || sort === 'price_high') {
      result = [...result].sort((a, b) => {
        const aPrice = productPriceInCurrency(a, currency, exchangeRates.data);
        const bPrice = productPriceInCurrency(b, currency, exchangeRates.data);
        if (aPrice === null) return bPrice === null ? 0 : 1;
        if (bPrice === null) return -1;
        return sort === 'price_low' ? aPrice - bPrice : bPrice - aPrice;
      });
    }
    return result;
  }, [rows, currency, exchangeRates.data, minPrice, maxPrice, sort]);
  const productPhotos = useMemo(() => {
    const used = new Set<string>();
    const photoKey = (candidate: string) => candidate.split('?')[0] ?? candidate;
    return new Map(visibleRows.map((product) => {
      const candidates = [product.image_urls[0], localProductPhoto(product.name)]
        .filter((photo): photo is string => typeof photo === 'string' && photo.length > 0);
      const photo = candidates.find((candidate) => !used.has(photoKey(candidate)));
      if (photo) used.add(photoKey(photo));
      return [product.id, photo] as const;
    }));
  }, [visibleRows]);
  const imageRows = visibleRows.filter((product) => Boolean(productPhotos.get(product.id)));
  const total = minPrice !== undefined || maxPrice !== undefined
    ? visibleRows.length
    : products.data?.meta.total ?? 0;

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
    setPriceError('');
    patch({
      min: minDraft || undefined,
      max: maxDraft || undefined,
    });
  }

  function clearFilters() {
    setSearchDraft('');
    setMinDraft('');
    setMaxDraft('');
    setPriceError('');
    setParams(new URLSearchParams({ currency: currencyForCountry(profile?.country) }), { replace: true });
  }

  return (
    <section className="mx-auto w-full max-w-[1720px] px-4 py-7 sm:px-6 lg:px-7 md:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">MarketLink catalogue</p>
          <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">Fresh Produce</h1>
          <p className="mt-2 max-w-xl text-sm text-muted">Shop this week’s harvest from approved local farmers. Choose a market and collect your order there.</p>
        </div>
        <Link to="/cart" className={buttonClass('ghost', 'sm')}>View cart</Link>
      </header>

      <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-[252px_minmax(0,1fr)] xl:gap-6">
        <aside className="h-fit space-y-5 self-start rounded-3xl border border-line bg-surface p-5 shadow-[0_8px_30px_rgba(21,39,29,0.05)]" aria-label="Product filters">
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
                  <span aria-hidden="true" className="ml-auto text-lg leading-none">›</span>
                </Chip>
              ))}
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <label htmlFor="product-currency" className="text-sm font-semibold">Price currency</label>
            <select
              id="product-currency"
              value={currency}
              onChange={(event) => patch({ currency: event.target.value, min: undefined, max: undefined })}
              className="mt-2 h-10 w-full rounded-xl border border-line bg-elevated px-3 text-sm text-primary outline-none focus:border-accent"
            >
              {CURRENCIES.map(([code, name]) => <option key={code} value={code}>{code} · {name}</option>)}
            </select>
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              Converted using daily reference rates from{' '}
              <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="underline underline-offset-2">ExchangeRate-API</a>.
              {exchangeRates.isPending ? ' Loading rates…' : exchangeRates.isError ? ' Rates are unavailable; prices are shown in each seller’s currency.' : ''}
            </p>
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
              <SearchAutocomplete label="Search products or farmers" value={searchDraft} onChange={setSearchDraft} placeholder="Tomatoes, ugu, a farmer…" />
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

          <div className="mt-4 flex items-center justify-end text-sm text-muted">
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
          ) : imageRows.length === 0 ? (
            <Card className="mt-4 p-10 text-center">
              <h2 className="font-display text-xl font-semibold">No product photos available</h2>
              <p className="mt-2 text-sm text-muted">Try another filter to find products with photos.</p>
            </Card>
          ) : (
            <>
              <Reveal className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3" y={18} stagger={0.045}>
                {imageRows.map((product) => {
                  const requestedMarket = params.get('market_id');
                  const market = product.markets.find((entry) => entry.id === requestedMarket)
                    ?? product.markets[0];
                  return <ProductTile key={product.id} product={product} market={market} currency={currency} rates={exchangeRates.data} photo={productPhotos.get(product.id)} />;
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
  const { profile } = useAuth();
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const product = useProduct(id);
  const exchangeRates = useExchangeRates();
  const currency = (searchParams.get('currency') ?? currencyForCountry(profile?.country)).toUpperCase();
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

  if (product.isPending) return <div className="w-full px-0 py-12 text-muted">Loading product…</div>;
  if (product.isError || !item) return (
    <section className="w-full px-0 py-16 text-center">
      <h1 className="font-display text-2xl font-bold">Product unavailable</h1>
      <p className="mt-2 text-sm text-muted">This listing may have been removed or the server is offline.</p>
      <Link to={`/products?currency=${currency}`} className={`${buttonClass('ghost', 'sm')} mt-5`}>Back to produce</Link>
    </section>
  );

  const stock = item.quantity_available ?? 0;
  const canAdd = stock > 0 && !item.is_sold_out && Boolean(marketId);
  const convertedPrice = productPriceInCurrency(item, currency, exchangeRates.data);
  function add() {
    if (!canAdd) return;
    addToCart({ product_id: item!.id, market_id: marketId, quantity });
    setAdded(true);
    window.setTimeout(() => navigate('/cart'), 500);
  }

  return (
    <section className="w-full px-0 py-8 md:py-12">
      <Link to={`/products?currency=${currency}`} className="text-sm text-muted hover:text-primary">← Fresh Produce</Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <Thumb
          src={item.image_urls[0]}
          fallbackSrc={localProductPhoto(item.name)}
          seed={item.id}
          category={item.category.slug}
          glyph={localProductGlyph(item.name)}
          glyphSize={96}
          className="aspect-square w-full rounded-2xl md:aspect-[5/4]"
        />
      <div className="flex flex-col justify-center">
          <div className="flex items-center justify-between gap-3"><p className="text-sm text-accent">{item.category.name} · {item.farmer.stall_name}</p><FavoriteToggle type="product" id={item.id} /></div>
          <h1 className="mt-2 font-display text-3xl font-bold md:text-4xl">{item.name}</h1>
          <p className="mt-4 text-2xl font-semibold text-primary">{convertedPrice === null
            ? formatMinor(item.price_minor, item.farmer.currency)
            : formatMajor(convertedPrice, currency)} <span className="text-sm font-normal text-muted">/ {item.unit}</span></p>
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
