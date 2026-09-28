import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { RequireAuth } from '../auth/RequireAuth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import type { Order } from '../lib/types';
import type { OrderItem } from '../lib/types';
import type { ProductCard } from '../lib/types';
import { formatMinor } from '../utils/money';
import { addToCart } from '../lib/cart';

const labels: Record<Order['status'], string> = { placed: 'Order placed', accepted: 'Farmer confirmed', preparing: 'Preparing', ready_for_pickup: 'Ready for pickup', completed: 'Completed', cancelled: 'Cancelled' };
const steps: Order['status'][] = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'completed'];
function ReviewForm({ orderId, item, saved }: { orderId: string; item: OrderItem; saved: () => void }) {
  const { api } = useAuth(); const [rating, setRating] = useState(5); const [body, setBody] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api.post(`/orders/${orderId}/reviews`, { product_id: item.product_id, rating, body: body.trim() || null }); saved(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not submit review.'); }
    finally { setBusy(false); }
  }
  return item.reviewed ? <p className="text-xs text-accent">Thanks for reviewing this product.</p> : <form onSubmit={(e) => void submit(e)} className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr_auto]"><label className="text-xs text-muted">Rating<select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="mt-1 block h-9 w-full rounded-lg border border-line bg-elevated px-2 text-primary">{[5,4,3,2,1].map((n) => <option key={n} value={n}>{n} star{n>1?'s':''}</option>)}</select></label><label className="text-xs text-muted">Your review<input value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="How was it? (optional)" className="mt-1 block h-9 w-full rounded-lg border border-line bg-elevated px-3 text-primary" /></label><Button type="submit" size="sm" className="self-end" loading={busy}>{busy ? 'Saving…' : 'Review'}</Button>{error ? <p role="alert" className="text-xs text-danger sm:col-span-3">{error}</p> : null}</form>;
}
function OrderItemsPanel({ order, onUpdated, isCustomer }: { order: Order; onUpdated: () => Promise<unknown>; isCustomer: boolean }) {
  const { api } = useAuth();
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<{ product_id: string; quantity: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editable = isCustomer && ['placed', 'accepted'].includes(order.status) && new Date(order.cutoff_at).getTime() > Date.now();
  const available = useQuery({
    queryKey: ['order-edit-products', order.farmer.id, order.market.id],
    enabled: editing,
    queryFn: () => api.get<{ data: ProductCard[] }>(`/products?farmer_id=${order.farmer.id}&market_id=${order.market.id}&in_stock_only=true&limit=50`),
  });
  function beginEdit() { setItems(order.items.map(({ product_id, quantity }) => ({ product_id, quantity }))); setError(''); setEditing(true); }
  function quantity(id: string, value: number) { setItems((current) => current.map((item) => item.product_id === id ? { ...item, quantity: value } : item)); }
  async function save() {
    const next = items.filter((item) => item.quantity > 0);
    if (!next.length) { setError('Keep at least one item, or cancel the whole order.'); return; }
    setBusy(true); setError('');
    try { await api.patch(`/orders/${order.id}/items`, { items: next }); setItems(next); setEditing(false); await onUpdated(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update the order.'); }
    finally { setBusy(false); }
  }
  return <div className="mt-6 space-y-3 border-t border-line pt-5">
    <div className="flex items-center justify-between"><h2 className="font-semibold">Order items</h2>{editable && !editing ? <Button size="sm" variant="ghost" onClick={beginEdit}>Change items</Button> : null}</div>
    {order.items.map((item) => <div key={item.product_id}><div className="flex justify-between gap-4 text-sm"><span>{item.quantity} × {item.name}</span><span className="num">{formatMinor(item.price_minor * item.quantity, order.currency)}</span></div>{isCustomer&&order.status === 'completed' ? <ReviewForm orderId={order.id} item={item} saved={() => void onUpdated()} /> : null}</div>)}
    {editing ? <div className="rounded-xl border border-line bg-elevated/40 p-4"><p className="text-sm font-medium">Adjust quantities</p><div className="mt-3 space-y-2">{items.map((item) => {const detail=order.items.find((line)=>line.product_id===item.product_id);const live=available.data?.data.find((product)=>product.id===item.product_id);return <label key={item.product_id} className="flex items-center justify-between gap-3 text-sm"><span>{detail?.name??live?.name??'Product'} <span className="text-xs text-muted">(0 removes it)</span></span><input aria-label={`Quantity for ${detail?.name??live?.name??'product'}`} type="number" min="0" max="100" value={item.quantity} onChange={(e)=>quantity(item.product_id,Number(e.target.value))} className="h-9 w-20 rounded-lg border border-line bg-surface px-2 text-right"/></label>;})}</div>
      <div className="mt-4"><p className="text-sm font-medium">Add another item from this farmer</p>{available.isPending?<p className="mt-2 text-xs text-muted">Loading available products…</p>:null}<div className="mt-2 flex flex-wrap gap-2">{available.data?.data.filter((product)=>!items.some((item)=>item.product_id===product.id&&item.quantity>0)).map((product)=><Button key={product.id} type="button" size="sm" variant="ghost" onClick={()=>setItems((current)=>[...current,{product_id:product.id,quantity:1}])}>+ {product.name}</Button>)}</div>{available.isError?<p className="mt-2 text-xs text-muted">Could not load more products; you can still adjust the items above.</p>:null}</div>
      {error?<p role="alert" className="mt-3 text-sm text-danger">{error}</p>:null}<div className="mt-4 flex flex-wrap gap-2"><Button size="sm" loading={busy} onClick={()=>void save()}>{busy?'Saving…':'Save changes'}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={()=>setEditing(false)}>Cancel edit</Button></div></div>:null}
  </div>;
}
function OrdersContent() {
  const { api, profile } = useAuth(); const { reference } = useParams(); const location = useLocation(); const navigate = useNavigate(); const [notice, setNotice] = useState('');
  const detail = useQuery({ queryKey: ['order', reference], enabled: Boolean(reference), queryFn: () => api.get<Order>(`/orders/reference/${encodeURIComponent(reference!)}`) });
  const list = useQuery({ queryKey: ['orders'], enabled: !reference, queryFn: () => api.get<{data: Order[]; meta: {total:number}}>('/orders') });
  const reorderProducts = useQuery({
    queryKey: ['order-reorder-products', detail.data?.id],
    enabled: Boolean(reference && profile?.role === 'customer' && detail.data?.status === 'completed'),
    queryFn: async () => Promise.all((detail.data?.items ?? []).map(async (item) => {
      try { return await api.get<ProductCard>(`/products/${item.product_id}`); }
      catch { return null; }
    })),
  });
  function reorder(order: Order) {
    let added = 0;
    for (const product of reorderProducts.data ?? []) {
      if (!product || product.is_sold_out || !product.quantity_available ||
          !product.markets.some((market) => market.id === order.market.id)) continue;
      const old = order.items.find((item) => item.product_id === product.id);
      const quantity = Math.min(old?.quantity ?? 1, product.quantity_available);
      if (quantity > 0) { addToCart({ product_id: product.id, market_id: order.market.id, quantity }); added++; }
    }
    if (added) navigate('/cart');
    else setNotice('None of these items are available for pickup at that market right now.');
  }
  async function cancel(order: Order) { try { const updated = await api.post<Order>(`/orders/${order.id}/cancel`); await detail.refetch(); await list.refetch(); setNotice(`Order ${updated.reference} cancelled.`); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not cancel this order.'); } }
  if (reference) {
    const order = detail.data;
    if (detail.isPending) return <div className="mx-auto max-w-3xl px-4 py-12 text-muted">Loading order…</div>;
    if (!order) return <div className="mx-auto max-w-3xl px-4 py-12"><p role="alert">{detail.error instanceof Error ? detail.error.message : 'Order not found.'}</p><Link to="/orders" className="mt-4 inline-block text-accent">All orders</Link></div>;
    const current = steps.indexOf(order.status);
    return <section className="mx-auto max-w-3xl px-4 py-8 md:py-12"><Link to="/orders" className="text-sm text-muted">← All orders</Link><Card className="mt-5 p-5 md:p-7"><p className="text-sm text-accent">Order {order.reference}</p><h1 className="mt-1 font-display text-3xl font-bold">{labels[order.status]}</h1><p className="mt-2 text-sm text-muted">{order.farmer.stall_name} · {order.market.name}, {order.market.city}</p>
      <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-5">{steps.map((step, i) => <div key={step} className={`rounded-xl border p-3 text-center text-xs ${current >= i ? 'border-accent/50 bg-accent/10 text-primary' : 'border-line text-muted'}`}><span className="block text-lg">{current >= i ? '✓' : '○'}</span>{labels[step]}</div>)}</div>
      {order.status === 'cancelled' ? <p className="mt-4 text-sm text-muted">This order was cancelled.</p> : null}
      <OrderItemsPanel order={order} onUpdated={() => detail.refetch()} isCustomer={profile?.role==='customer'} /><div className="mt-4 flex justify-between border-t border-line pt-3 font-semibold"><span>Total at pickup</span><span className="num">{formatMinor(order.subtotal_minor, order.currency)}</span></div>
      <p className="mt-5 text-sm text-muted">Pickup {order.pickup_date}, {order.pickup_slot_start.slice(0,5)}–{order.pickup_slot_end.slice(0,5)} · Pay in person</p>
      <a className="mt-2 inline-block text-sm text-accent underline" href={`https://www.google.com/maps/dir/?api=1&destination=${order.market.lat},${order.market.lng}`} target="_blank" rel="noreferrer">Directions to pickup market</a>
      {profile?.role === 'customer' && order.status === 'completed' ? <Button className="mt-5" disabled={reorderProducts.isPending || reorderProducts.isError} onClick={() => reorder(order)}>{reorderProducts.isPending ? 'Checking availability…' : 'Buy again'}</Button> : null}
      {profile?.role==='customer'&&['placed','accepted'].includes(order.status) && new Date(order.cutoff_at).getTime() > Date.now() ? <Button className="mt-5" variant="danger" onClick={() => void cancel(order)}>Cancel order</Button> : null}
      {notice ? <p role="status" className="mt-3 text-sm text-accent">{notice}</p> : null}</Card></section>;
  }
  const orders = list.data?.data ?? []; const placed = (location.state as {placed?: string[]}|null)?.placed;
  return <section className="mx-auto max-w-4xl px-4 py-8 md:py-12"><p className="text-sm text-accent">Your account</p><h1 className="font-display text-3xl font-bold">Your orders</h1>{placed?.length ? <Card className="mt-4 p-4 text-sm">Placed successfully: {placed.map((r) => <Link key={r} to={`/orders/${encodeURIComponent(r)}`} className="ml-2 text-accent underline">{r}</Link>)}</Card> : null}
    {list.isPending ? <p className="mt-6 text-muted">Loading orders…</p> : null}{list.error ? <p role="alert" className="mt-6 text-danger">{list.error instanceof Error ? list.error.message : 'Could not load orders.'}</p> : null}
    <div className="mt-5 space-y-3">{orders.map((order) => <Link key={order.id} to={`/orders/${encodeURIComponent(order.reference)}`} className="block"><Card className="flex flex-wrap items-center justify-between gap-4 p-5 hover:border-accent/50"><div><p className="text-xs text-muted">{order.reference} · {order.pickup_date}</p><h2 className="mt-1 font-semibold">{order.farmer.stall_name}</h2><p className="text-sm text-muted">{order.market.name} · {order.items.length} items</p></div><div className="text-right"><p className="font-semibold">{labels[order.status]}</p><p className="num text-sm text-muted">{formatMinor(order.subtotal_minor, order.currency)}</p></div></Card></Link>)}</div>
    {!list.isPending && !orders.length ? <Card className="mt-5 p-6 text-center"><p>You have no orders yet.</p><Link to="/products" className="mt-3 inline-block text-accent">Find produce</Link></Card> : null}{notice ? <p role="status" className="mt-3 text-sm text-accent">{notice}</p> : null}</section>;
}
export default function Orders() { return <RequireAuth><OrdersContent /></RequireAuth>; }
