import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { RequireAuth } from '../auth/RequireAuth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { readCart, removeCartItem, type CartSelection } from '../lib/cart';
import type { Order, ProductCard } from '../lib/types';
import { formatMinor } from '../utils/money';

type Group = { key: string; marketId: string; selections: CartSelection[]; products: ProductCard[] };
const pad = (n: number) => String(n).padStart(2, '0');
function localDate(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function nextValidDate(days: string[]) {
  const codes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const today = new Date(); const mondayOffset = (today.getDay() + 6) % 7;
  for (let i = 0; i < 7 - mondayOffset; i++) {
    const day = new Date(); day.setDate(day.getDate() + i);
    if (days.includes(codes[day.getDay()]!)) return localDate(day);
  }
  return '';
}
function endOfTradingWeek() { const today = new Date(); today.setDate(today.getDate() + 6 - ((today.getDay() + 6) % 7)); return localDate(today); }
function validPickupDates(days: string[]) {
  const codes = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const mondayOffset = (new Date().getDay() + 6) % 7;
  return Array.from({ length: 7 - mondayOffset }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return days.includes(codes[date.getDay()]!) ? localDate(date) : null;
  }).filter((date): date is string => date !== null);
}
function pickupSlots(startValue: string | null | undefined, endValue: string | null | undefined) {
  const startText = (startValue ?? '09:00').slice(0, 5);
  const endText = (endValue ?? '10:00').slice(0, 5);
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return (hours ?? 9) * 60 + (minutes ?? 0);
  };
  const from = toMinutes(startText);
  const until = toMinutes(endText);
  if (until <= from) return [];
  const slots: { start: string; end: string }[] = [];
  for (let time = from; time < until; time += 30) {
    const next = Math.min(time + 30, until);
    slots.push({ start: `${pad(Math.floor(time / 60))}:${pad(time % 60)}`, end: `${pad(Math.floor(next / 60))}:${pad(next % 60)}` });
  }
  return slots;
}

function CheckoutContent() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [selections, setSelections] = useState<CartSelection[]>([]);
  const [schedule, setSchedule] = useState<Record<string, { date: string; start: string; end: string }>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => setSelections(readCart()), []);
  const query = useQuery({
    queryKey: ['checkout-products', selections], enabled: selections.length > 0,
    queryFn: async () => Promise.all(selections.map(async (selection) => ({ selection, product: await api.get<ProductCard>(`/products/${selection.product_id}`) }))),
  });
  const groups = useMemo(() => {
    const byKey = new Map<string, Group>();
    for (const row of query.data ?? []) {
      const key = `${row.product.farmer.id}:${row.selection.market_id}`;
      const group = byKey.get(key) ?? { key, marketId: row.selection.market_id, selections: [], products: [] };
      group.selections.push(row.selection); group.products.push(row.product); byKey.set(key, group);
    }
    return [...byKey.values()];
  }, [query.data]);
  useEffect(() => {
    setSchedule((old) => {
      const next = { ...old };
      for (const group of groups) if (!next[group.key]) {
        const p = group.products[0]!;
        const market = p.markets.find((m) => m.id === group.marketId);
        const slots = pickupSlots(p.farmer.pickup_window_start ?? market?.opens_at, p.farmer.pickup_window_end ?? market?.closes_at);
        const firstSlot = slots[0] ?? { start: '09:00', end: '09:30' };
        next[group.key] = { date: nextValidDate([...p.farmer.operating_days].filter((d) => market?.days.includes(d))), ...firstSlot };
      }
      return next;
    });
  }, [groups]);

  async function place() {
    setBusy(true); setMessage('');
    const refs: string[] = [];
    try {
      for (const group of groups) {
        const timing = schedule[group.key];
        if (!timing) continue;
        const allowedDays = [...group.products[0]!.farmer.operating_days].filter((day) => group.products[0]!.markets.find((m) => m.id === group.marketId)?.days.includes(day));
        const dateDay = timing.date ? ['sun','mon','tue','wed','thu','fri','sat'][new Date(`${timing.date}T12:00:00`).getDay()] : undefined;
        const first = group.products[0]!;
        const market = first.markets.find((entry) => entry.id === group.marketId);
        const validSlots = pickupSlots(first.farmer.pickup_window_start ?? market?.opens_at, first.farmer.pickup_window_end ?? market?.closes_at);
        const validTime = validSlots.some((slot) => slot.start === timing.start && slot.end === timing.end);
        if (!timing.date || !allowedDays.includes(dateDay ?? '') || timing.date < localDate(new Date()) || timing.date > endOfTradingWeek() || !validTime) {
          setMessage('Choose an available pickup date and time during the current trading week for this farmer and market.'); setBusy(false); return;
        }
        const order = await api.post<Order>('/orders', {
          market_id: group.marketId, pickup_date: timing.date, pickup_slot_start: timing.start, pickup_slot_end: timing.end,
          items: group.selections.map((s) => ({ product_id: s.product_id, quantity: s.quantity })),
        });
        refs.push(order.reference);
        for (const s of group.selections) removeCartItem(s.product_id, s.market_id);
      }
      navigate(refs.length === 1 ? `/orders/${encodeURIComponent(refs[0]!)}` : '/orders', { state: { placed: refs } });
    } catch (err) {
      setMessage(err instanceof Error ? `${err.message}${refs.length ? ` Previously placed: ${refs.join(', ')}` : ''}` : 'Could not place this order.');
    } finally { setBusy(false); }
  }

  if (!selections.length) return <section className="mx-auto max-w-2xl px-4 py-16 text-center"><h1 className="font-display text-3xl font-bold">Your cart is empty</h1><Link className="mt-4 inline-block text-accent" to="/products">Browse produce</Link></section>;
  return <section className="mx-auto max-w-4xl px-4 py-8 md:py-12">
    <Link to="/cart" className="text-sm text-muted">← Back to cart</Link><h1 className="mt-3 font-display text-3xl font-bold">Choose pickup</h1>
    <p className="mt-2 text-sm text-muted">Orders are placed separately for each farmer and market. Pay the farmer when you collect.</p>
    {query.isPending ? <Card className="mt-6 p-5">Loading current listings…</Card> : null}
    <div className="mt-6 space-y-4">{groups.map((g) => {
      const first = g.products[0]!; const market = first.markets.find((m) => m.id === g.marketId); const time = schedule[g.key];
      const total = g.products.reduce((sum, p, i) => sum + p.price_minor * g.selections[i]!.quantity, 0);
      return <Card key={g.key} className="p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs uppercase tracking-wide text-accent">Pickup location</p><h2 className="mt-1 font-semibold">{market?.name ?? 'Market unavailable'}</h2><p className="text-sm text-muted">{market?.city} · {first.farmer.stall_name}</p></div><p className="num font-semibold">{formatMinor(total, first.farmer.currency)}</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-muted">Pickup date
            <select value={time?.date ?? ''} onChange={(e) => setSchedule((s) => ({ ...s, [g.key]: { ...time!, date: e.target.value } }))} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-primary">
              {validPickupDates([...first.farmer.operating_days].filter((day) => market?.days.includes(day))).map((date) => <option key={date} value={date}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</option>)}
            </select>
            {time && !time.date ? <span className="mt-1 block text-danger">No available pickup day remains this week.</span> : null}
          </label>
          <label className="text-xs text-muted">Pickup time
            <select value={time ? `${time.start}|${time.end}` : ''} onChange={(e) => { const [start, end] = e.target.value.split('|'); if (start && end) setSchedule((s) => ({ ...s, [g.key]: { ...time!, start, end } })); }} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-primary">
              {pickupSlots(first.farmer.pickup_window_start ?? market?.opens_at, first.farmer.pickup_window_end ?? market?.closes_at).map((slot) => <option key={slot.start} value={`${slot.start}|${slot.end}`}>{slot.start}–{slot.end}</option>)}
            </select>
            <span className="mt-1 block">Select a 30-minute slot within the listed pickup window.</span>
          </label>
        </div><ul className="mt-4 space-y-1 text-sm text-muted">{g.products.map((p, i) => <li key={p.id}>{g.selections[i]!.quantity} × {p.name}</li>)}</ul>
      </Card>;
    })}</div>
    {message ? <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">{message}</p> : null}
    <Card className="mt-5 flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="font-semibold">Pay at pickup</p><p className="text-sm text-muted">No online payment or delivery charge.</p></div><Button disabled={busy || !groups.length || query.isPending} onClick={() => void place()}>{busy ? 'Placing order…' : 'Place pickup order'}</Button></Card>
  </section>;
}
export default function Checkout() { return <RequireAuth><CheckoutContent /></RequireAuth>; }
