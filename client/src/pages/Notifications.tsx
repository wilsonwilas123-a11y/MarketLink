import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RequireAuth } from '../auth/RequireAuth';
import { useAuth } from '../auth/AuthProvider';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
interface Notice { id:string; kind:string; title:string; body:string; link:string|null; read_at:string|null; created_at:string }
function Inbox(){const {api}=useAuth();const cache=useQueryClient();const q=useQuery({queryKey:['notifications'],queryFn:()=>api.get<Notice[]>('/notifications')});
 async function read(id:string){await api.patch(`/notifications/${id}/read`);await cache.invalidateQueries({queryKey:['notifications']});}
 async function readAll(){await api.post('/notifications/read-all');await cache.invalidateQueries({queryKey:['notifications']});}
 return <section className="mx-auto max-w-3xl px-4 py-8 md:py-12"><div className="flex items-end justify-between gap-3"><div><p className="text-sm text-accent">Your account</p><h1 className="font-display text-3xl font-bold">Notifications</h1></div>{q.data?.some(n=>!n.read_at)?<Button size="sm" variant="ghost" onClick={()=>void readAll()}>Mark all read</Button>:null}</div>
 {q.isPending?<p className="mt-5 text-muted">Loading notifications…</p>:null}{q.error?<p role="alert" className="mt-5 text-danger">Could not load notifications.</p>:null}
 <div className="mt-5 space-y-3">{q.data?.map(n=><Card key={n.id} className={`p-4 ${n.read_at?'opacity-70':'border-accent/40'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-muted">{new Date(n.created_at).toLocaleString()}</p><h2 className="mt-1 font-semibold">{n.title}</h2><p className="mt-1 text-sm text-muted">{n.body}</p></div>{!n.read_at?<Button size="sm" variant="ghost" onClick={()=>void read(n.id)}>Mark read</Button>:null}</div>{n.link?<Link to={n.link} onClick={()=>!n.read_at&&void read(n.id)} className="mt-3 inline-block text-sm text-accent">Open →</Link>:null}</Card>)}</div>
 {!q.isPending&&!q.data?.length?<Card className="mt-5 p-8 text-center text-muted">You’re all caught up. Updates about orders and your market will show here.</Card>:null}</section>}
export default function Notifications(){return <RequireAuth><Inbox/></RequireAuth>}
