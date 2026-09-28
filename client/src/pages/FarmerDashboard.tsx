import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useAuth } from '../auth/AuthProvider';
import type { FarmerStatus } from '../lib/types';
import type { Order } from '../lib/types';
import type { FarmerMarket, Market } from '../lib/types';
import { formatMinor } from '../utils/money';
import { minorUnitDigits } from '../utils/money';

const weekdays = ['mon','tue','wed','thu','fri','sat','sun'];

interface MarketAssignment { market_id: string; stall_ref: string | null; days: string[] }

function MarketRosterEditor({ currency, farmerDays }: { currency: string; farmerDays: string[] }) {
  const { api } = useAuth();
  const [draft, setDraft] = useState<MarketAssignment[]>([]);
  const [newMarket, setNewMarket] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const assigned = useQuery({ queryKey: ['farmer-markets'], queryFn: () => api.get<FarmerMarket[]>('/farmers/me/markets') });
  const markets = useQuery({ queryKey: ['farmer-market-options'], queryFn: () => api.get<{ data: Market[] }>('/markets?limit=100') });
  useEffect(() => {
    if (assigned.data) setDraft(assigned.data.map(({ id, stall_ref, days }) => ({ market_id: id, stall_ref, days })));
  }, [assigned.data]);
  const options = (markets.data?.data ?? []).filter((market) => market.currency === currency);
  function addMarket(id: string) {
    const market = options.find((row) => row.id === id);
    if (!market || draft.some((row) => row.market_id === id)) return;
    setDraft((rows) => [...rows, { market_id: id, stall_ref: '', days: market.operating_days.filter((day) => farmerDays.includes(day)) }]);
    setNewMarket(''); setError('');
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await api.put('/farmers/me/markets', { markets: draft });
      await assigned.refetch();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update your markets.'); }
    finally { setSaving(false); }
  }
  return <Card className="mt-5 p-5"><h2 className="font-display text-xl font-semibold">Your pickup markets</h2><p className="mt-1 text-sm text-muted">Choose where your stall trades, your pitch reference, and the days you attend. Only markets using {currency} are shown.</p>
    {assigned.isPending || markets.isPending ? <p className="mt-4 text-sm text-muted">Loading your market roster…</p> : null}
    {assigned.error || markets.error ? <p role="alert" className="mt-3 text-sm text-danger">Your market roster could not be loaded.</p> : null}
    {draft.map((assignment) => {
      const market = options.find((row) => row.id === assignment.market_id);
      if (!market) return null;
      return <div key={market.id} className="mt-4 rounded-xl border border-line bg-elevated/40 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{market.name}</h3><p className="text-xs text-muted">{market.address} · {market.city}</p></div><Button type="button" size="sm" variant="ghost" onClick={() => setDraft((rows) => rows.filter((row) => row.market_id !== market.id))}>Remove</Button></div>
        <label className="mt-3 block max-w-xs text-xs text-muted">Pitch / stall reference<input maxLength={40} value={assignment.stall_ref ?? ''} onChange={(e) => setDraft((rows) => rows.map((row) => row.market_id === market.id ? { ...row, stall_ref: e.target.value || null } : row))} placeholder="e.g. A12" className="mt-1 block h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm text-primary"/></label>
        <fieldset className="mt-3"><legend className="text-xs text-muted">Trading days at this market</legend><div className="mt-2 flex flex-wrap gap-3">{market.operating_days.filter((day) => farmerDays.includes(day)).map((day) => <label key={day} className="flex items-center gap-1 text-xs capitalize"><input type="checkbox" checked={assignment.days.includes(day)} onChange={(e) => setDraft((rows) => rows.map((row) => row.market_id === market.id ? { ...row, days: e.target.checked ? [...row.days, day] : row.days.filter((value) => value !== day) } : row))}/>{day}</label>)}</div>{assignment.days.length === 0 ? <p className="mt-2 text-xs text-warn">Choose at least one day that both you and this market operate.</p> : null}</fieldset>
      </div>;
    })}
    <form onSubmit={(e) => void save(e)} className="mt-4 flex flex-wrap items-end gap-2"><label className="min-w-56 flex-1 text-xs text-muted">Add a market<select value={newMarket} onChange={(e) => addMarket(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary"><option value="">Choose an active {currency} market</option>{options.filter((market) => !draft.some((row) => row.market_id === market.id)).map((market) => <option key={market.id} value={market.id}>{market.name} · {market.city}</option>)}</select></label>
      <Button type="submit" loading={saving} disabled={assigned.isPending || markets.isPending || draft.some((row) => row.days.length === 0)}>{saving ? 'Saving…' : 'Save markets'}</Button>
    </form>
    {!options.length && !markets.isPending ? <p className="mt-3 text-xs text-muted">No active pickup markets use {currency} yet. Contact the market administrator.</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}
  </Card>;
}

interface FarmerListing {
  id: string; name: string; description: string | null; category_id: string;
  category_name: string; category_slug: string; unit: 'basket' | 'bunch' | 'pack' | 'crate' | 'l' | 'kg';
  price_minor: number; image_urls: string[]; is_organic: boolean; is_active: boolean; template_qty:number;
  quantity_available: number; is_sold_out: boolean;
}
interface Category { id: string; name: string; slug: string }
interface FarmerReview { id: string; rating: number; title: string | null; body: string | null; farmer_reply: string | null; customer_name: string; product_name: string; created_at: string }
interface FarmerInsights { total_orders:number;pending_orders:number;completed_pickup_value:number;currency:string;best_sellers:{name:string;quantity:number;orders:number}[] }
interface StallDetails { id:string;stall_name:string;contact_person:string|null;description:string|null;logo_url:string|null;cover_url:string|null;lat:number|null;lng:number|null;operating_days:string[];pickup_window_start:string|null;pickup_window_end:string|null;order_cutoff_minutes:number;status:FarmerStatus;rating_avg:number;rating_count:number;currency:string }

const states: Record<FarmerStatus, { badge: string; tone: 'warn' | 'accent' | 'danger'; heading: string; body: string }> = {
  pending: {
    badge: 'Awaiting approval',
    tone: 'warn',
    heading: 'The market admin is looking at your stall',
    body: 'Approved stalls show up in the market directory and start taking pickup orders. Nothing is wrong — this is the first week every stall goes through.',
  },
  approved: {
    badge: 'Live',
    tone: 'accent',
    heading: 'Your stall is in the directory',
    body: 'Review today’s pickup orders below and keep customers updated as you prepare them.',
  },
  suspended: {
    badge: 'Suspended',
    tone: 'danger',
    heading: 'Your stall is hidden from shoppers',
    body: 'A market admin paused this stall. Ask at the market office, or use the contact page and we will look at it with you.',
  },
};

/**
 * The farmer's own screen. A pending stall is a state people arrive in and worry about, so it
 * is the one this phase has to get right: named, explained, and clear about what happens next.
 */
export default function FarmerDashboard() {
  const { profile, farmer, signOut, api } = useAuth();
  const [editing, setEditing] = useState<FarmerListing | null>(null);
  const [listingOpen, setListingOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [listingError, setListingError] = useState('');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [stallEditorOpen,setStallEditorOpen]=useState(false);const [stallBusy,setStallBusy]=useState(false);const [stallError,setStallError]=useState('');
  const [stallPhotoBusy,setStallPhotoBusy]=useState(false);
  const [stallDraft,setStallDraft]=useState({stall_name:'',contact_person:'',description:'',logo_url:'',cover_url:'',operating_days:[] as string[],pickup_window_start:'',pickup_window_end:'',order_cutoff_minutes:120,lat:'',lng:''});
  const [draft, setDraft] = useState({ name: '', description: '', category_id: '', unit: 'bunch' as FarmerListing['unit'], price: '', image_url: '', is_organic: false, quantity: '0', template_quantity:'0', is_sold_out: false });
  const orders = useQuery({
    queryKey: ['farmer-orders'],
    enabled: farmer?.status === 'approved',
    queryFn: () => api.get<{ data: Order[]; meta: { total: number } }>('/orders?scope=today&limit=100'),
  });
  const categories = useQuery({ queryKey: ['product-categories'], queryFn: () => api.get<Category[]>('/categories') });
  const listings = useQuery({ queryKey: ['farmer-products'], enabled: farmer?.status === 'approved', queryFn: () => api.get<FarmerListing[]>('/farmers/me/products') });
  const stallDetails = useQuery({ queryKey: ['my-stall'], enabled: Boolean(farmer), queryFn: () => api.get<StallDetails>('/farmers/me') });
  const currency = stallDetails.data?.currency ?? 'NGN';
  const insights = useQuery({ queryKey:['farmer-insights'],enabled:farmer?.status==='approved',queryFn:()=>api.get<FarmerInsights>('/farmers/me/insights') });
  const reviews = useQuery({ queryKey: ['farmer-reviews'], enabled: farmer?.status === 'approved', queryFn: () => api.get<FarmerReview[]>('/farmers/me/reviews') });

  function startEdit(product?: FarmerListing) {
    setListingOpen(true);
    setImageFile(null);
    setEditing(product ?? null);
    setListingError('');
    setDraft(product ? {
      name: product.name, description: product.description ?? '', category_id: product.category_id,
      unit: product.unit, price: (product.price_minor / 10 ** minorUnitDigits(currency)).toString(),
      image_url: product.image_urls[0] ?? '', is_organic: product.is_organic,
      quantity: String(product.is_sold_out ? 0 : product.quantity_available), template_quantity:String(product.template_qty), is_sold_out: product.is_sold_out,
    } : { name: '', description: '', category_id: categories.data?.[0]?.id ?? '', unit: 'bunch', price: '', image_url: '', is_organic: false, quantity: '0', template_quantity:'0', is_sold_out: false });
  }

  async function uploadPhoto() {
    if (!imageFile) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(imageFile.type) || imageFile.size > 5 * 1024 * 1024) {
      setListingError('Choose a JPEG, PNG, or WebP photo up to 5 MB.'); return;
    }
    setUploadingPhoto(true); setListingError('');
    try {
      const result = await api.upload<{ url: string }>('/uploads/products', imageFile);
      setDraft((current) => ({ ...current, image_url: result.url })); setImageFile(null);
    } catch (err) { setListingError(err instanceof Error ? err.message : 'The photo could not be uploaded. Check Supabase Storage setup.'); }
    finally { setUploadingPhoto(false); }
  }

  async function saveListing(event: FormEvent) {
    event.preventDefault(); setSaving(true); setListingError('');
    try {
      const input = {
        category_id: draft.category_id || categories.data?.[0]?.id || '', name: draft.name.trim(), description: draft.description.trim() || null,
        unit: draft.unit, price_minor: Math.round(Number(draft.price) * 10 ** minorUnitDigits(currency)),
        image_urls: draft.image_url.trim() ? [draft.image_url.trim()] : [], is_organic: draft.is_organic, template_qty:Number(draft.template_quantity),
        quantity_available: draft.is_sold_out ? 0 : Number(draft.quantity), is_sold_out: draft.is_sold_out,
      };
      if (editing) await api.patch(`/farmers/me/products/${editing.id}`, input);
      else await api.post('/farmers/me/products', input);
      await listings.refetch(); setEditing(null); setListingOpen(false);
    } catch (err) { setListingError(err instanceof Error ? err.message : 'Could not save listing.'); }
    finally { setSaving(false); }
  }

  async function move(order: Order, status: Extract<Order['status'], 'accepted' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled'>) {
    await api.patch<Order>(`/orders/${order.id}/status`, { status });
    await orders.refetch();
  }
  async function archiveListing(product: FarmerListing) {
    setArchiving(product.id);
    setListingError('');
    try {
      await api.delete(`/farmers/me/products/${product.id}`);
      await listings.refetch();
    } catch (err) {
      setListingError(err instanceof Error ? err.message : 'Could not archive this listing.');
    } finally {
      setArchiving(null);
    }
  }
  async function submitReply(review: FarmerReview) {
    const body = replies[review.id]?.trim(); if (!body) return;
    await api.patch(`/farmers/me/reviews/${review.id}/reply`, { body });
    setReplies((current) => ({ ...current, [review.id]: '' })); await reviews.refetch();
  }
  function editStall(){const s=stallDetails.data;if(!s)return;setStallDraft({stall_name:s.stall_name,contact_person:s.contact_person??'',description:s.description??'',logo_url:s.logo_url??'',cover_url:s.cover_url??'',operating_days:s.operating_days,pickup_window_start:s.pickup_window_start?.slice(0,5)??'',pickup_window_end:s.pickup_window_end?.slice(0,5)??'',order_cutoff_minutes:s.order_cutoff_minutes,lat:s.lat==null?'':String(s.lat),lng:s.lng==null?'':String(s.lng)});setStallError('');setStallEditorOpen(true);}
  async function saveStall(event:FormEvent){event.preventDefault();setStallBusy(true);setStallError('');try{await api.patch('/farmers/me',{stall_name:stallDraft.stall_name.trim(),contact_person:stallDraft.contact_person.trim()||null,description:stallDraft.description.trim()||null,logo_url:stallDraft.logo_url.trim()||null,cover_url:stallDraft.cover_url.trim()||null,operating_days:stallDraft.operating_days,pickup_window_start:stallDraft.pickup_window_start||null,pickup_window_end:stallDraft.pickup_window_end||null,order_cutoff_minutes:stallDraft.order_cutoff_minutes});if(stallDraft.lat&&stallDraft.lng)await api.post('/farmers/me/geo',{lat:Number(stallDraft.lat),lng:Number(stallDraft.lng)});await stallDetails.refetch();setStallEditorOpen(false);}catch(err){setStallError(err instanceof Error?err.message:'Could not update your stall.');}finally{setStallBusy(false);}}
  async function uploadStallPhoto(kind:'cover_url'|'logo_url',file?:File){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setStallError('Choose a JPEG, PNG, or WebP image up to 5 MB.');return;}setStallPhotoBusy(true);setStallError('');try{const result=await api.upload<{url:string}>('/uploads/stall',file);setStallDraft(current=>({...current,[kind]:result.url}));}catch(err){setStallError(err instanceof Error?err.message:'Could not upload this stall photo.');}finally{setStallPhotoBusy(false);}}

  if (!profile) return null;

  if (!farmer) {
    return (
      <section className="mx-auto w-full max-w-2xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold leading-tight">No stall yet</h1>
        <p className="mt-2 text-sm text-muted">
          Your account is a farmer account but has no stall attached to it. The market office can
          add one, or you can start again from the signup page.
        </p>
        <Link
          to="/signup"
          className="mt-6 inline-flex h-10 items-center rounded-full bg-accent px-5 font-semibold text-on-block"
        >
          Set up a stall
        </Link>
      </section>
    );
  }

  const state = states[farmer.status];

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Stall</p>
          <h1 className="font-display text-3xl font-bold leading-tight">{farmer.stall_name}</h1>
        </div>
        <span>
          <Badge tone={state.tone}>{state.badge}</Badge>
        </span>
        <Button size="sm" variant="ghost" onClick={editStall} disabled={!stallDetails.data}>Edit stall profile</Button>
      </div>

      <Card className="mt-6 p-5">
        <h2 className="font-display text-lg font-semibold">{state.heading}</h2>
        <p className="mt-2 text-sm text-muted">{state.body}</p>

        <dl className="mt-5 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted">Contact</dt>
            <dd className="num text-primary">{profile.phone}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted">Owner</dt>
            <dd className="text-primary">{profile.full_name}</dd>
          </div>
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-muted">Where</dt>
            <dd className="text-primary">{profile.address ?? 'Not given yet'}</dd>
          </div>
        </dl>
      </Card>

      {stallDetails.data ? <MarketRosterEditor currency={stallDetails.data.currency} farmerDays={stallDetails.data.operating_days} /> : null}

      {farmer.status==='approved'?<section className="mt-5" aria-label="Sales insights"><div className="grid gap-3 sm:grid-cols-3"><Card className="p-4"><p className="text-xs text-muted">Total orders</p><p className="mt-1 font-display text-2xl font-bold">{insights.data?.total_orders??'—'}</p></Card><Card className="p-4"><p className="text-xs text-muted">Pending orders</p><p className="mt-1 font-display text-2xl font-bold">{insights.data?.pending_orders??'—'}</p></Card><Card className="p-4"><p className="text-xs text-muted">Completed pickup sales</p><p className="mt-1 font-display text-2xl font-bold">{insights.data?formatMinor(insights.data.completed_pickup_value,insights.data.currency):'—'}</p></Card></div>{insights.data?.best_sellers.length?<Card className="mt-3 p-4"><h2 className="font-semibold">Best-selling products · completed pickups</h2><div className="mt-3 grid gap-2 sm:grid-cols-2">{insights.data.best_sellers.map((item)=><div key={item.name} className="flex justify-between gap-3 border-b border-line pb-2 text-sm"><span>{item.name}<span className="block text-xs text-muted">{item.orders} orders</span></span><span>{item.quantity} sold</span></div>)}</div></Card>:null}{insights.error?<p className="mt-2 text-xs text-muted">Sales insights are unavailable right now.</p>:null}</section>:null}

      {stallEditorOpen?<Card className="mt-4 p-5"><h2 className="font-display text-xl font-semibold">Edit stall profile & pickup hours</h2><form onSubmit={(e)=>void saveStall(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted">Stall name<input required maxLength={80} value={stallDraft.stall_name} onChange={e=>setStallDraft({...stallDraft,stall_name:e.target.value})} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary"/></label>
        <label className="text-xs text-muted">Contact person<input maxLength={120} value={stallDraft.contact_person} onChange={e=>setStallDraft({...stallDraft,contact_person:e.target.value})} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary"/></label>
        <label className="text-xs text-muted">Cover photo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={stallPhotoBusy} onChange={e=>void uploadStallPhoto('cover_url',e.target.files?.[0])} className="mt-1 block w-full text-xs"/>{stallDraft.cover_url?<img src={stallDraft.cover_url} alt="Stall cover preview" className="mt-2 h-20 w-full rounded-lg object-cover"/>:null}</label>
        <label className="text-xs text-muted">Stall logo<input type="file" accept="image/jpeg,image/png,image/webp" disabled={stallPhotoBusy} onChange={e=>void uploadStallPhoto('logo_url',e.target.files?.[0])} className="mt-1 block w-full text-xs"/>{stallDraft.logo_url?<img src={stallDraft.logo_url} alt="Stall logo preview" className="mt-2 h-20 w-20 rounded-lg object-cover"/>:null}</label>
        {stallPhotoBusy?<p className="text-xs text-muted sm:col-span-2">Uploading image…</p>:null}
        <label className="text-xs text-muted sm:col-span-2">About your stall<textarea maxLength={1000} rows={3} value={stallDraft.description} onChange={e=>setStallDraft({...stallDraft,description:e.target.value})} className="mt-1 block w-full rounded-lg border border-line bg-elevated p-3 text-sm text-primary"/></label>
        <fieldset className="sm:col-span-2"><legend className="text-xs text-muted">Your operating days</legend><div className="mt-2 flex flex-wrap gap-3">{weekdays.map(day=><label key={day} className="flex items-center gap-1 text-xs capitalize"><input type="checkbox" checked={stallDraft.operating_days.includes(day)} onChange={e=>setStallDraft({...stallDraft,operating_days:e.target.checked?[...stallDraft.operating_days,day]:stallDraft.operating_days.filter(d=>d!==day)})}/>{day}</label>)}</div></fieldset>
        <label className="text-xs text-muted">Pickup starts<input type="time" value={stallDraft.pickup_window_start} onChange={e=>setStallDraft({...stallDraft,pickup_window_start:e.target.value})} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary"/></label>
        <label className="text-xs text-muted">Pickup ends<input type="time" value={stallDraft.pickup_window_end} onChange={e=>setStallDraft({...stallDraft,pickup_window_end:e.target.value})} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary"/></label>
        <label className="text-xs text-muted">Order cutoff (minutes before pickup)<input type="number" min="0" max="4320" value={stallDraft.order_cutoff_minutes} onChange={e=>setStallDraft({...stallDraft,order_cutoff_minutes:Number(e.target.value)})} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary"/></label>
        <div className="grid grid-cols-2 gap-2"><label className="text-xs text-muted">Pickup pin latitude<input type="number" step="any" value={stallDraft.lat} onChange={e=>setStallDraft({...stallDraft,lat:e.target.value})} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary"/></label><label className="text-xs text-muted">Longitude<input type="number" step="any" value={stallDraft.lng} onChange={e=>setStallDraft({...stallDraft,lng:e.target.value})} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary"/></label></div>
        {stallError?<p role="alert" className="text-sm text-danger sm:col-span-2">{stallError}</p>:null}<div className="flex gap-2 sm:col-span-2"><Button type="submit" loading={stallBusy}>{stallBusy?'Saving…':'Save stall details'}</Button><Button type="button" variant="ghost" onClick={()=>setStallEditorOpen(false)}>Cancel</Button></div>
      </form></Card>:null}

      {farmer.status === 'approved' ? <section className="mt-8">
        <div className="flex items-end justify-between gap-3"><div><p className="text-sm text-accent">Pickup management</p><h2 className="font-display text-2xl font-bold">Today’s orders</h2></div><Link to="/orders" className="text-sm text-accent">Order history →</Link></div>
        {orders.isPending ? <Card className="mt-4 p-5 text-sm text-muted">Loading today’s orders…</Card> : null}
        {orders.error ? <Card className="mt-4 p-5 text-sm text-danger">{orders.error instanceof Error ? orders.error.message : 'Could not load orders.'}</Card> : null}
        <div className="mt-4 space-y-3">{orders.data?.data.map((order) => {
          const next: Partial<Record<Order['status'], Extract<Order['status'], 'accepted' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled'>>> = { placed: 'accepted', accepted: 'preparing', preparing: 'ready_for_pickup', ready_for_pickup: 'completed' };
          const action = next[order.status];
          return <Card key={order.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><Link to={`/orders/${encodeURIComponent(order.reference)}`} className="font-semibold hover:text-accent">{order.reference}</Link><p className="mt-1 text-sm text-muted">{order.pickup_slot_start.slice(0,5)}–{order.pickup_slot_end.slice(0,5)} · {order.market.name}</p><ul className="mt-2 text-xs text-muted">{order.items.map((item) => <li key={item.product_id}>{item.quantity} × {item.name}</li>)}</ul></div><div className="text-right"><p className="font-semibold">{formatMinor(order.subtotal_minor, order.currency)}</p><p className="text-xs capitalize text-muted">{order.status.replaceAll('_', ' ')}</p>{action ? <Button size="sm" className="mt-3" onClick={() => void move(order, action)}>{action.replaceAll('_', ' ')}</Button> : null}{order.status === 'placed' ? <Button variant="danger" size="sm" className="mt-3 ml-2" onClick={() => void move(order, 'cancelled')}>Decline</Button> : null}</div></div></Card>;
        })}</div>
        {!orders.isPending && !orders.data?.data.length ? <Card className="mt-4 p-5 text-sm text-muted">No pickup orders scheduled today.</Card> : null}
      </section> : null}

      {farmer.status === 'approved' ? <section className="mt-9">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-accent">Weekly catalogue</p><h2 className="font-display text-2xl font-bold">Your products & stock</h2></div><Button size="sm" onClick={() => startEdit()}>Add product</Button></div>
        {listings.isError ? <Card className="mt-4 p-4 text-sm text-danger">{listings.error instanceof Error ? listings.error.message : 'Could not load your products.'}</Card> : null}
        <div className="mt-4 space-y-2">{listings.data?.map((product) => <Card key={product.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold">{product.name}</p><p className="text-xs text-muted">{product.category_name} · {formatMinor(product.price_minor, currency)} / {product.unit}</p><p className={`mt-1 text-xs ${product.is_active ? 'text-accent' : 'text-danger'}`}>{product.is_active ? (product.is_sold_out ? 'Sold out' : `${product.quantity_available} available this week`) : 'Unavailable to shoppers'}</p></div><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={() => startEdit(product)}>Edit listing / stock</Button>{product.is_active ? <Button variant="danger" size="sm" loading={archiving === product.id} onClick={() => void archiveListing(product)}>{archiving === product.id ? 'Archiving…' : 'Archive'}</Button> : null}</div></Card>)}
          {!listings.isPending && !listings.data?.length ? <Card className="p-5 text-sm text-muted">No products yet. Add your first listing to start building your catalogue.</Card> : null}
        </div>
        {listingOpen ? <Card className="mt-4 p-5"><h3 className="font-display text-xl font-semibold">{editing ? 'Edit product and weekly stock' : 'Add a product'}</h3>
          <form onSubmit={(event) => void saveListing(event)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted">Product name<input required minLength={2} maxLength={120} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary" /></label>
            <label className="text-xs text-muted">Category<select required value={draft.category_id || categories.data?.[0]?.id || ''} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary">{(categories.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label className="text-xs text-muted">Price ({currency})<input required type="number" min="0.01" step="any" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary" /></label>
            <label className="text-xs text-muted">Sold by<select value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as FarmerListing['unit'] })} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary">{['basket','bunch','pack','crate','l','kg'].map((u) => <option key={u}>{u}</option>)}</select></label>
            <label className="text-xs text-muted">Available this week<input type="number" min="0" max="100000" value={draft.quantity} disabled={draft.is_sold_out} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary disabled:opacity-50" /></label>
            <label className="text-xs text-muted">Recurring weekly stock<input type="number" min="0" max="100000" value={draft.template_quantity} onChange={(e)=>setDraft({...draft,template_quantity:e.target.value})} className="mt-1 block h-10 w-full rounded-lg border border-line bg-elevated px-3 text-sm text-primary"/><span className="mt-1 block text-[11px]">Starting quantity for each new week; this week’s stock can still change independently.</span></label>
            <div className="text-xs text-muted">Product photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm text-primary file:mr-2 file:rounded-full file:border-0 file:bg-elevated file:px-3 file:py-2 file:text-xs file:text-primary" />{imageFile ? <Button type="button" size="sm" variant="ghost" loading={uploadingPhoto} className="mt-2" onClick={() => void uploadPhoto()}>{uploadingPhoto ? 'Uploading…' : 'Upload photo'}</Button> : draft.image_url ? <p className="mt-2 text-accent">Photo ready for this listing.</p> : <p className="mt-2">Choose a clear image of this item.</p>}</div>
            <label className="text-xs text-muted sm:col-span-2">Description<textarea maxLength={1000} rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className="mt-1 block w-full rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-primary" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_organic} onChange={(e) => setDraft({ ...draft, is_organic: e.target.checked })} />Organic</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_sold_out} onChange={(e) => setDraft({ ...draft, is_sold_out: e.target.checked, ...(e.target.checked ? { quantity: '0' } : {}) })} />Mark sold out this week</label>
            {listingError ? <p role="alert" className="text-sm text-danger sm:col-span-2">{listingError}</p> : null}
            <div className="flex gap-2 sm:col-span-2"><Button type="submit" loading={saving} disabled={!categories.data?.length}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add product'}</Button><Button type="button" variant="ghost" onClick={() => { setListingOpen(false); setEditing(null); }}>Cancel</Button></div>
          </form>
        </Card> : null}
      </section> : null}

      {farmer.status === 'approved' ? <section className="mt-9"><div className="flex items-end justify-between"><div><p className="text-sm text-accent">Customer feedback</p><h2 className="font-display text-2xl font-bold">Reviews</h2></div></div>
        {reviews.isPending ? <p className="mt-3 text-sm text-muted">Loading reviews…</p> : null}
        <div className="mt-4 space-y-3">{reviews.data?.map((review) => <Card key={review.id} className="p-4"><div className="flex justify-between gap-3"><div><p className="font-semibold">{review.product_name} · {'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</p><p className="text-xs text-muted">By {review.customer_name} · {new Date(review.created_at).toLocaleDateString()}</p></div></div>{review.title ? <p className="mt-3 font-medium">{review.title}</p> : null}{review.body ? <p className="mt-1 text-sm text-muted">{review.body}</p> : null}
          {review.farmer_reply ? <p className="mt-3 rounded-lg bg-elevated p-3 text-sm"><span className="font-semibold">Your reply:</span> {review.farmer_reply}</p> : <form onSubmit={(e) => { e.preventDefault(); void submitReply(review); }} className="mt-3 flex gap-2"><input value={replies[review.id] ?? ''} onChange={(e) => setReplies((current) => ({ ...current, [review.id]: e.target.value }))} maxLength={1000} minLength={2} placeholder="Reply to this review" required className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-elevated px-3 text-sm text-primary" /><Button type="submit" size="sm">Reply</Button></form>}</Card>)}</div>
        {!reviews.isPending && !reviews.data?.length ? <Card className="mt-4 p-5 text-sm text-muted">No reviews yet. Completed orders can leave product feedback.</Card> : null}
      </section> : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          to="/account"
          className="inline-flex h-10 items-center rounded-full border border-line px-5 text-sm text-primary hover:bg-elevated"
        >
          Account details
        </Link>
        <Button variant="danger" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </section>
  );
}
