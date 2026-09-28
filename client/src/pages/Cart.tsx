import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Thumb } from '../components/art/Thumb';
import { useAuth } from '../auth/AuthProvider';
import { ApiError } from '../lib/api';
import { cartEventName, readCart, removeCartItem, updateCartItem, type CartSelection } from '../lib/cart';
import type { Order, ProductCard } from '../lib/types';
import { formatMinor } from '../utils/money';
import { localProductGlyph, localProductPhoto } from '../lib/productPhoto';

const pad = (n: number) => String(n).padStart(2, '0');
function localDate(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}
function shiftDate(date: string, offset: number) {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offset);
  return localDate(shifted);
}
function nextPickupDate(days: string[], start: string, cutoffMinutes: number, timezone: string) {
  const codes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const now = localParts(new Date(), timezone);
  const today = `${now.year}-${now.month}-${now.day}`;
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const daysLeft = 7 - ((weekday + 6) % 7);
  const nowMinutes = Number(now.hour) * 60 + Number(now.minute);
  const [hour, minute] = start.slice(0, 5).split(':').map(Number);
  const cutoffAt = (hour ?? 0) * 60 + (minute ?? 0) - cutoffMinutes;
  const cutoffDayOffset = Math.floor(cutoffAt / 1440);
  const cutoffMinuteOfDay = ((cutoffAt % 1440) + 1440) % 1440;
  for (let offset = 0; offset < daysLeft; offset++) {
    const date = shiftDate(today, offset);
    if (!days.includes(codes[new Date(`${date}T12:00:00Z`).getUTCDay()]!)) continue;
    const cutoffDate = shiftDate(date, cutoffDayOffset);
    if (cutoffDate > today || (cutoffDate === today && cutoffMinuteOfDay > nowMinutes)) return date;
  }
  return '';
}
export default function Cart() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [selections, setSelections] = useState<CartSelection[]>([]);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState('');
  useEffect(() => {
    const sync = () => setSelections(readCart());
    sync();
    window.addEventListener(cartEventName(), sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(cartEventName(), sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const cart = useQuery({
    queryKey: ['cart-products', selections],
    enabled: selections.length > 0,
    queryFn: async () => Promise.all(selections.map(async (selection) => {
      try {
        const product = await api.get<ProductCard>(`/products/${encodeURIComponent(selection.product_id)}`);
        return { selection, product };
      } catch {
        return { selection, product: null };
      }
    })),
  });
  const rows = cart.data ?? [];
  const totals = useMemo(() => {
    const amounts = new Map<string, number>();
    for (const row of rows) {
      if (!row.product) continue;
      const stock = row.product.quantity_available ?? 0;
      if (stock <= 0 || row.product.is_sold_out) continue;
      const qty = Math.min(row.selection.quantity, stock);
      amounts.set(row.product.farmer.currency,
        (amounts.get(row.product.farmer.currency) ?? 0) + row.product.price_minor * qty);
    }
    return amounts;
  }, [rows]);

  async function placeOrder() {
    if (placing || cart.isPending) return;
    setPlacing(true);
    setPlaceError('');
    const grouped = new Map<string, { marketId: string; products: ProductCard[]; selections: CartSelection[] }>();
    for (const row of rows) {
      const product = row.product;
      if (!product || product.is_sold_out || (product.quantity_available ?? 0) < 1) continue;
      if (!product.markets.some((market) => market.id === row.selection.market_id)) continue;
      const key = `${product.farmer.id}:${row.selection.market_id}`;
      const group = grouped.get(key) ?? { marketId: row.selection.market_id, products: [], selections: [] };
      group.products.push(product);
      group.selections.push({ ...row.selection, quantity: Math.min(row.selection.quantity, product.quantity_available ?? 0) });
      grouped.set(key, group);
    }
    const refs: string[] = [];
    try {
      if (!grouped.size) {
        setPlaceError('There are no available items to order. Remove unavailable items and try again.');
        return;
      }
      for (const group of grouped.values()) {
        const first = group.products[0]!;
        const market = first.markets.find((item) => item.id === group.marketId)!;
        const availableDays = first.farmer.operating_days.filter((day) => market.days.includes(day));
        const pickupStart = (first.farmer.pickup_window_start ?? market.opens_at ?? '09:00').slice(0, 5);
        const pickupEnd = (first.farmer.pickup_window_end ?? market.closes_at ?? '10:00').slice(0, 5);
        const pickupDate = nextPickupDate(availableDays, pickupStart, first.farmer.order_cutoff_minutes, market.timezone);
        if (!pickupDate) {
          setPlaceError(`No pickup day remains this week for ${first.farmer.stall_name} at ${market.name}.${refs.length ? ` Previously placed orders: ${refs.join(', ')}.` : ''}`);
          return;
        }
        const order = await api.post<Order>('/orders', {
          market_id: group.marketId,
          pickup_date: pickupDate,
          pickup_slot_start: pickupStart,
          pickup_slot_end: pickupEnd,
          items: group.selections.map((selection) => ({ product_id: selection.product_id, quantity: selection.quantity })),
        });
        refs.push(order.reference);
        for (const selection of group.selections) removeCartItem(selection.product_id, selection.market_id);
      }
      navigate('/orders', { state: { placed: refs } });
    } catch (error) {
      const requestId = error instanceof ApiError && typeof error.details === 'object' && error.details !== null
        ? (error.details as { request_id?: unknown }).request_id
        : null;
      const diagnostic = error instanceof ApiError && typeof error.details === 'object' && error.details !== null
        ? (error.details as { diagnostic?: unknown }).diagnostic
        : null;
      const reference = typeof requestId === 'string' ? ` Reference: ${requestId}.` : '';
      const detail = typeof diagnostic === 'string' && diagnostic ? ` ${diagnostic}` : '';
      setPlaceError(error instanceof Error ? `${error.message}${detail}${reference}${refs.length ? ` Previously placed: ${refs.join(', ')}` : ''}` : 'Could not place this order.');
    } finally {
      setPlacing(false);
    }
  }

  if (selections.length === 0) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm uppercase tracking-[0.16em] text-accent">Your basket</p>
        <h1 className="mt-2 font-display text-3xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-sm text-muted">Add produce from a local farmer and choose where you’ll pick it up.</p>
        <Link to="/products" className={`${buttonClass('primary', 'md')} mt-6`}>Browse produce</Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-12">
      <Link to="/products" className="text-sm text-muted hover:text-primary">← Continue shopping</Link>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-accent">Market pickup</p>
          <h1 className="font-display text-3xl font-bold">Your cart</h1>
        </div>
        <p className="text-sm text-muted">Payment is settled when you collect your order.</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          {cart.isPending ? <Card className="p-5 text-sm text-muted">Checking current stock…</Card> : null}
          {selections.map((selection) => {
            const row = rows.find((item) => item.selection.product_id === selection.product_id && item.selection.market_id === selection.market_id);
            const product = row?.product;
            if (!product) {
              return (
                <Card key={`${selection.product_id}:${selection.market_id}`} className="flex items-center justify-between gap-4 p-4">
                  <p className="text-sm text-muted">This product is no longer available.</p>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeCartItem(selection.product_id, selection.market_id)}>Remove</Button>
                </Card>
              );
            }
            const market = product.markets.find((item) => item.id === selection.market_id);
            const stock = product.quantity_available ?? 0;
            const available = stock > 0 && !product.is_sold_out;
            return (
              <Card key={`${selection.product_id}:${selection.market_id}`} className="flex flex-wrap items-center gap-4 p-4">
                <Link to={`/products/${product.id}`} className="shrink-0">
                  <Thumb src={product.image_urls[0]} fallbackSrc={localProductPhoto(product.name)} seed={product.id} category={product.category.slug} glyph={localProductGlyph(product.name)} className="h-20 w-20 rounded-xl" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={`/products/${product.id}`} className="font-semibold hover:text-accent">{product.name}</Link>
                  <p className="mt-1 text-xs text-muted">{product.farmer.stall_name} · {market ? `${market.name}, ${market.city}` : 'Pickup market unavailable'}</p>
                  <p className={`mt-1 text-xs ${available ? 'text-accent' : 'text-danger'}`}>{available ? `${stock} available` : 'No longer in stock'}</p>
                </div>
                <label className="text-xs text-muted">
                  Quantity
                  <input
                    type="number"
                    min="1"
                    max={stock || 1}
                    value={selection.quantity}
                    disabled={!available}
                    onChange={(event) => updateCartItem(selection.product_id, selection.market_id, Math.max(1, Math.min(stock || 1, Number(event.target.value) || 1)))}
                    className="mt-1 block h-9 w-20 rounded-lg border border-line bg-elevated px-2 text-center text-primary disabled:opacity-50"
                  />
                </label>
                <div className="min-w-24 text-right">
                  <p className="num font-semibold text-primary">{formatMinor(product.price_minor * selection.quantity, product.farmer.currency)}</p>
                  <p className="text-xs text-muted">{formatMinor(product.price_minor, product.farmer.currency)} / {product.unit}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeCartItem(selection.product_id, selection.market_id)}>Remove</Button>
              </Card>
            );
          })}
        </div>

        <Card className="h-fit p-5">
          <h2 className="font-display text-xl font-semibold">Pickup summary</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">Your items will be grouped by farmer at checkout. There is no delivery fee and no online payment.</p>
          <div className="mt-5 space-y-2 border-t border-line pt-4">
            {[...totals.entries()].map(([currency, amount]) => (
              <div key={currency} className="flex justify-between text-sm">
                <span className="text-muted">Subtotal ({currency})</span>
                <span className="num font-semibold">{formatMinor(amount, currency)}</span>
              </div>
            ))}
            {totals.size === 0 ? <p className="text-sm text-muted">No available items to subtotal.</p> : null}
          </div>
          {placeError ? <p role="alert" className="mt-4 text-sm text-danger">{placeError}</p> : null}
          <Button type="button" disabled={placing || cart.isPending || totals.size === 0} onClick={() => void placeOrder()} className="mt-5 w-full">
            {placing ? 'Placing order…' : 'Place order'}
          </Button>
          <p className="mt-3 text-center text-xs text-muted">We’ll choose the next available pickup slot. Pay when you collect.</p>
        </Card>
      </div>
    </section>
  );
}
