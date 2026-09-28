import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import { moderateReview } from '../services/reviews.js';
import { registry } from '../api/registry.js';
import { error } from '../api/responses.js';
import { currentUser, requireAdminSession, requireRole } from '../middleware/auth.js';
import { createAdminSession } from '../lib/adminSession.js';
import { route } from '../lib/route.js';
import { validate } from '../middleware/validate.js';
import type { AppDeps } from '../app.js';
import { AdminMarketInputSchema, MarketRosterInputSchema } from '../api/schemas.js';
const Uuid = z.string().uuid();

const FarmerStatus = z.object({ status: z.enum(['approved', 'suspended']) }).strict();
const ProductState = z.object({ is_active: z.boolean() }).strict();
const AccountActive = z.object({ is_active: z.boolean() }).strict();
const BroadcastInput = z.object({ title: z.string().trim().min(2).max(100), body: z.string().trim().min(2).max(1000) }).strict();
const CategoryInput = z.object({ name:z.string().trim().min(2).max(60),slug:z.string().trim().regex(/^[a-z][a-z0-9-]*$/),icon_key:z.string().trim().min(1).max(40),sort_order:z.number().int().min(0).max(10000) }).strict();
const ReportRange = z.object({ from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).refine(v=>!v.from||!v.to||v.from<=v.to,{message:'The report start date must be on or before its end date.'});

for (const [method,path,summary] of [
  ['get','/admin/overview','Read dashboard metrics and pending work'],
  ['get','/admin/markets','List markets for administration'],
  ['post','/admin/markets','Create a market'],
  ['patch','/admin/markets/{id}','Edit a market'],
  ['get','/admin/markets/{id}/farmers','Read a market stall roster'],
  ['put','/admin/markets/{id}/farmers','Assign a farmer to a market'],
  ['delete','/admin/markets/{id}/farmers/{farmerId}','Remove a farmer from a market'],
  ['get','/admin/farmers','List farmers available for market assignment'],
  ['get','/admin/accounts','Search customer and farmer accounts'],
  ['patch','/admin/accounts/{id}/active','Activate or deactivate an account'],
  ['post','/admin/announcements','Send an announcement to active accounts'],
  ['get','/admin/categories','List product categories'],
  ['post','/admin/categories','Create a product category'],
  ['patch','/admin/categories/{id}','Edit a product category'],
  ['get','/admin/reports','Generate order and product activity reports'],
  ['get','/admin/reviews','List reviews for moderation'],
  ['patch','/admin/reviews/{id}/status','Hide or restore a review'],
  ['patch','/admin/farmers/{id}/status','Approve or suspend a farmer stall'],
  ['patch','/admin/products/{id}','Hide or restore a product listing'],
] as const) registry.registerPath({ method, path, tags: ['Admin'], summary, security: [{ bearerAuth: [] }], responses: { 200: { description: 'Operation completed.' }, 201: { description: 'Resource created.' }, 400: error('Request data is invalid.'), 403: error('Admin accounts only.'), 404: error('Resource was not found.') } });

export function adminRouter(deps: AppDeps): Router {
  const r = Router();
  const admin = [requireAdminSession(), requireRole('admin')];
  r.post('/admin/session', route(async (req, res) => {
    const body = z.object({ email: z.string().trim().email(), password: z.string().min(1) }).strict().safeParse(req.body);
    if (!body.success) throw new ApiError('validation_failed', 'Enter the designated admin email and password.');
    const session = createAdminSession(body.data.email, body.data.password);
    if (!session) throw new ApiError('unauthenticated', 'The admin email or password is incorrect, or admin sign-in is not configured.');
    res.json(session);
  }));
  r.get('/admin/session', ...admin, route(async (req, res) => {
    res.json({ email: currentUser(req).email });
  }));
  r.get('/admin/overview', ...admin, route(async (_req, res) => {
    const [counts, farmers, products] = await Promise.all([
      deps.pool.query(`select (select count(*)::int from farmers) as total_farmers,
                              (select count(*)::int from profiles where role='customer') as total_customers,
                              (select count(*)::int from markets) as total_markets,
                              (select count(*)::int from orders) as total_orders,
                              (select count(*)::int from profiles) as accounts,
                              (select count(*)::int from farmers where status='pending') as pending_farmers,
                              (select count(*)::int from orders where placed_at >= date_trunc('day', now())) as orders_today,
                              (select count(*)::int from products where is_active) as active_products`),
      deps.pool.query(`select f.id, f.stall_name, f.contact_person, f.description, f.created_at::text,
                              p.full_name
                         from farmers f join profiles p on p.id=f.profile_id
                        where f.status='pending' order by f.created_at asc limit 100`),
      deps.pool.query(`select p.id, p.name, p.is_active, p.price_minor::float8 as price_minor,
                              f.stall_name, c.name as category
                         from products p join farmers f on f.id=p.farmer_id
                         join categories c on c.id=p.category_id
                        order by p.updated_at desc limit 100`),
    ]);
    res.json({ metrics: counts.rows[0], pending_farmers: farmers.rows, recent_products: products.rows });
  }));
  r.get('/admin/reports', ...admin, validate({query:ReportRange}), route(async(req,res)=>{
    const range=req.valid.query as z.infer<typeof ReportRange>;
    const values=[range.from??'1900-01-01',range.to??'9999-12-31'];
    const [statuses,markets,products,farmers]=await Promise.all([
      deps.pool.query(`select o.status,count(*)::int as orders,sum(o.subtotal_kobo)::float8 as pickup_total_minor,m.currency from orders o join markets m on m.id=o.market_id where o.pickup_date between $1::date and $2::date group by o.status,m.currency order by m.currency,o.status`,values),
      deps.pool.query(`select m.id,m.name,m.city,m.currency,count(o.id) filter(where o.status='completed')::int as order_count,coalesce(sum(o.subtotal_kobo) filter(where o.status='completed'),0)::float8 as pickup_total_minor from markets m left join orders o on o.market_id=m.id and o.pickup_date between $1::date and $2::date group by m.id order by order_count desc,m.name`,values),
      deps.pool.query(`select oi.product_name_snapshot as name,sum(oi.quantity)::int as quantity,count(distinct oi.order_id)::int as orders,sum(oi.price_kobo_snapshot*oi.quantity)::float8 as pickup_total_minor,m.currency from order_items oi join orders o on o.id=oi.order_id join markets m on m.id=o.market_id where o.status='completed' and o.pickup_date between $1::date and $2::date group by oi.product_name_snapshot,m.currency order by quantity desc limit 20`,values),
      deps.pool.query(`select f.id,f.stall_name,f.currency,count(o.id)::int as completed_orders,coalesce(sum(o.subtotal_kobo),0)::float8 as pickup_total_minor from farmers f left join orders o on o.farmer_id=f.id and o.status='completed' and o.pickup_date between $1::date and $2::date group by f.id,f.stall_name,f.currency order by completed_orders desc,pickup_total_minor desc,f.stall_name limit 20`,values),
    ]);
    res.json({from:range.from??null,to:range.to??null,orders_by_status:statuses.rows,by_market:markets.rows,top_products:products.rows,top_farmers:farmers.rows});
  }));
  r.get('/admin/markets', ...admin, route(async (_req, res) => {
    const { rows } = await deps.pool.query(`select id,name,address,city,state,country,currency,timezone,lat::float8 as lat,lng::float8 as lng,operating_days,opens_at,closes_at,image_url,is_active from markets order by country,city,name`);
    res.json(rows);
  }));
  r.post('/admin/markets', ...admin, validate({ body: AdminMarketInputSchema }), route(async (req, res) => {
    const m = req.valid.body as z.infer<typeof AdminMarketInputSchema>;
    const { rows } = await deps.pool.query(
      `insert into markets(name,address,city,state,country,currency,timezone,lat,lng,operating_days,opens_at,closes_at,image_url,is_active)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::time,$12::time,$13,$14) returning id,name,is_active`,
      [m.name,m.address,m.city,m.state,m.country,m.currency,m.timezone,m.lat,m.lng,m.operating_days,m.opens_at,m.closes_at,m.image_url,m.is_active]);
    res.status(201).json(rows[0]);
  }));
  r.patch('/admin/markets/:id', ...admin, validate({ params: z.object({ id: Uuid }), body: AdminMarketInputSchema }), route(async (req, res) => {
    const { id } = req.valid.params as { id: string }; const m = req.valid.body as z.infer<typeof AdminMarketInputSchema>;
    const { rows } = await deps.pool.query(
      `update markets set name=$2,address=$3,city=$4,state=$5,country=$6,currency=$7,timezone=$8,lat=$9,lng=$10,
         operating_days=$11,opens_at=$12::time,closes_at=$13::time,image_url=$14,is_active=$15,updated_at=now()
       where id=$1 returning id,name,is_active`,
      [id,m.name,m.address,m.city,m.state,m.country,m.currency,m.timezone,m.lat,m.lng,m.operating_days,m.opens_at,m.closes_at,m.image_url,m.is_active]);
    if (!rows[0]) throw new ApiError('not_found', 'No such market.'); res.json(rows[0]);
  }));
  r.get('/admin/farmers', ...admin, route(async (_req,res)=>{
    const {rows}=await deps.pool.query(`select f.id,f.stall_name,f.status,f.currency,f.operating_days,p.full_name from farmers f join profiles p on p.id=f.profile_id order by f.stall_name`);
    res.json(rows);
  }));
  r.get('/admin/markets/:id/farmers', ...admin, validate({params:z.object({id:Uuid})}), route(async(req,res)=>{
    const {id}=req.valid.params as {id:string};
    const market=await deps.pool.query('select 1 from markets where id=$1',[id]); if(!market.rowCount)throw new ApiError('not_found','No such market.');
    const {rows}=await deps.pool.query(`select f.id as farmer_id,f.stall_name,f.status,f.currency,mf.stall_ref,mf.days from market_farmers mf join farmers f on f.id=mf.farmer_id where mf.market_id=$1 order by f.stall_name`,[id]);res.json(rows);
  }));
  r.put('/admin/markets/:id/farmers', ...admin, validate({params:z.object({id:Uuid}),body:MarketRosterInputSchema}), route(async(req,res)=>{
    const {id:marketId}=req.valid.params as {id:string};const input=req.valid.body as z.infer<typeof MarketRosterInputSchema>;
    const {rows}=await deps.pool.query(`select m.operating_days as market_days,m.currency as market_currency,f.id as farmer_id,f.operating_days as farmer_days,f.currency as farmer_currency from markets m cross join farmers f where m.id=$1 and f.id=$2`,[marketId,input.farmer_id]);
    const assignment=rows[0];if(!assignment)throw new ApiError('not_found','Market or farmer not found.');
    if(assignment.market_currency!==assignment.farmer_currency)throw new ApiError('validation_failed','The farmer and market must use the same currency.');
    if(input.days.some(day=>!(assignment.market_days as string[]).includes(day)||!(assignment.farmer_days as string[]).includes(day)))throw new ApiError('validation_failed','Roster days must fit both the market and farmer operating days.');
    const {rows:assigned}=await deps.pool.query(`insert into market_farmers(market_id,farmer_id,stall_ref,days) values($1,$2,$3,$4) on conflict(market_id,farmer_id) do update set stall_ref=excluded.stall_ref,days=excluded.days returning market_id,farmer_id,stall_ref,days`,[marketId,input.farmer_id,input.stall_ref??null,input.days]);res.json(assigned[0]);
  }));
  r.delete('/admin/markets/:id/farmers/:farmerId', ...admin, validate({params:z.object({id:Uuid,farmerId:Uuid})}), route(async(req,res)=>{
    const {id,farmerId}=req.valid.params as {id:string;farmerId:string};const result=await deps.pool.query('delete from market_farmers where market_id=$1 and farmer_id=$2',[id,farmerId]);
    if(!result.rowCount)throw new ApiError('not_found','That farmer is not assigned to this market.');res.status(204).end();
  }));
  r.get('/admin/accounts', ...admin, route(async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const { rows } = await deps.pool.query(
      `select p.id,p.full_name,p.phone,p.role,p.is_active,p.created_at::text,f.stall_name
         from profiles p left join farmers f on f.profile_id=p.id
        where ($1='' or p.full_name ilike '%'||$1||'%' or p.phone ilike '%'||$1||'%')
        order by p.created_at desc limit 100`, [q]);
    res.json(rows);
  }));
  r.patch('/admin/accounts/:id/active', ...admin, validate({ params: z.object({ id: Uuid }), body: AccountActive }), route(async (req, res) => {
    const { id } = req.valid.params as { id: string }; const { is_active } = req.valid.body as z.infer<typeof AccountActive>;
    if (id === currentUser(req).id && !is_active) throw new ApiError('validation_failed', 'You cannot deactivate your own admin account.');
    const { rows } = await deps.pool.query(`update profiles set is_active=$2,updated_at=now() where id=$1 returning id,full_name,role,is_active`, [id,is_active]);
    if (!rows[0]) throw new ApiError('not_found', 'No such account.'); res.json(rows[0]);
  }));
  r.post('/admin/announcements', ...admin, validate({ body: BroadcastInput }), route(async (req, res) => {
    const { title, body } = req.valid.body as z.infer<typeof BroadcastInput>;
    const result = await deps.pool.query(`insert into notifications(profile_id,kind,title,body,link) select id,'announcement',$1,$2,'/account' from profiles where is_active returning id`, [title,body]);
    res.status(201).json({ delivered: result.rowCount ?? 0 });
  }));
  r.get('/admin/categories', ...admin, route(async (_req,res)=>{const {rows}=await deps.pool.query('select id,name,slug,icon_key,sort_order from categories order by sort_order,name');res.json(rows);}));
  r.post('/admin/categories', ...admin, validate({body:CategoryInput}), route(async(req,res)=>{const c=req.valid.body as z.infer<typeof CategoryInput>;const {rows}=await deps.pool.query('insert into categories(name,slug,icon_key,sort_order) values($1,$2,$3,$4) returning id,name,slug,icon_key,sort_order',[c.name,c.slug,c.icon_key,c.sort_order]);res.status(201).json(rows[0]);}));
  r.patch('/admin/categories/:id', ...admin, validate({params:z.object({id:Uuid}),body:CategoryInput}), route(async(req,res)=>{const {id}=req.valid.params as {id:string};const c=req.valid.body as z.infer<typeof CategoryInput>;const {rows}=await deps.pool.query('update categories set name=$2,slug=$3,icon_key=$4,sort_order=$5 where id=$1 returning id,name,slug,icon_key,sort_order',[id,c.name,c.slug,c.icon_key,c.sort_order]);if(!rows[0])throw new ApiError('not_found','No such category.');res.json(rows[0]);}));
  r.patch('/admin/farmers/:id/status', ...admin, validate({ params: z.object({ id: Uuid }), body: FarmerStatus }), route(async (req, res) => {
    const { id } = req.valid.params as { id: string };
    const { status } = req.valid.body as z.infer<typeof FarmerStatus>;
    const updated = await deps.pool.query(`update farmers set status=$2, updated_at=now() where id=$1 returning id, stall_name, status`, [id, status]);
    if (!updated.rowCount) throw new ApiError('not_found', 'No such farmer stall.');
    await deps.pool.query(`insert into notifications(profile_id,kind,title,body,link) select profile_id,'announcement',$2,$3,'/farmers/dashboard' from farmers where id=$1`, [id, status === 'approved' ? 'Your stall is approved' : 'Your stall was suspended', status === 'approved' ? 'Your products can now appear in the MarketLink catalogue.' : 'Your stall is hidden from shoppers. Contact the market admin for help.']);
    res.json(updated.rows[0]);
  }));
  r.patch('/admin/products/:id', ...admin, validate({ params: z.object({ id: Uuid }), body: ProductState }), route(async (req, res) => {
    const { id } = req.valid.params as { id: string };
    const { is_active } = req.valid.body as z.infer<typeof ProductState>;
    const result = await deps.pool.query('update products set is_active=$2, updated_at=now() where id=$1 returning id,name,is_active', [id, is_active]);
    if (!result.rowCount) throw new ApiError('not_found', 'No such product listing.');
    res.json(result.rows[0]);
  }));
  r.get('/admin/reviews', ...admin, route(async (_req, res) => {
    const { rows } = await deps.pool.query(
      `select r.id,r.rating,r.title,r.body,r.status,r.created_at::text,
              p.full_name as customer_name,f.stall_name,pr.name as product_name
         from reviews r join profiles p on p.id=r.customer_id
         join farmers f on f.id=r.farmer_id join products pr on pr.id=r.product_id
        order by r.created_at desc limit 100`);
    res.json(rows);
  }));
  r.patch('/admin/reviews/:id/status', ...admin,
    validate({ params: z.object({ id: Uuid }), body: z.object({ status: z.enum(['visible','removed']) }).strict() }),
    route(async (req, res) => {
      res.json(await moderateReview(deps.pool, (req.valid.params as { id: string }).id, (req.valid.body as { status: 'visible'|'removed' }).status));
    }));
  return r;
}
