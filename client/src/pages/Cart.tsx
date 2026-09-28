import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, buttonClass } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Thumb } from '../components/art/Thumb';
import { useAuth } from '../auth/AuthProvider';
import { cartEventName, readCart, removeCartItem, updateCartItem, type CartSelection } from '../lib/cart';
import type { ProductCard } from '../lib/types';
import { formatMinor } from '../utils/money';
import { localProductGlyph, localProductPhoto } from '../lib/productPhoto';

export default function Cart() {
  const { api } = useAuth();
  const [selections, setSelections] = useState<CartSelection[]>([]);
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
                  <Thumb src={product.image_urls[0] ?? localProductPhoto(product.name)} seed={product.id} category={product.category.slug} glyph={localProductGlyph(product.name)} className="h-20 w-20 rounded-xl" />
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
          <Link to="/checkout" className={`${buttonClass('primary', 'md', 'mt-5 w-full')} ${totals.size === 0 ? 'pointer-events-none opacity-45' : ''}`} aria-disabled={totals.size === 0}>
            Choose pickup time
          </Link>
          <p className="mt-3 text-center text-xs text-muted">Farmers confirm availability before pickup.</p>
        </Card>
      </div>
    </section>
  );
}
