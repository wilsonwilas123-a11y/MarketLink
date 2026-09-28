/** Mirrors `server/src/api/schemas.ts`. Field names stay snake_case so responses need no mapping. */

export type Role = 'customer' | 'farmer' | 'admin';

/** The role a signed-in account may ask bootstrap to grant. `admin` is not one of them. */
export type RequestableRole = Exclude<Role, 'admin'>;

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  phone: string;
  address: string | null;
  country: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type FarmerStatus = 'pending' | 'approved' | 'suspended';

/** The stall a farmer owns, if they have one. `null` for customers. */
export interface FarmerLink {
  id: string;
  stall_name: string;
  status: FarmerStatus;
}

export interface Me {
  profile: Profile;
  farmer: FarmerLink | null;
}

export interface BootstrapInput {
  full_name: string;
  phone: string;
  address?: string;
  role: RequestableRole;
  stall_name?: string;
  country?: string;
}

/** Spec 6's envelope. `meta.total` counts filtered rows, not the page. */
export interface ApiPage<T> {
  data: T[];
  meta: { total: number; page: number; limit: number };
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface Market {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  currency: string;
  lat: number;
  lng: number;
  operating_days: string[];
  opens_at: string;
  closes_at: string;
  image_url: string | null;
  /** Computed in SQL against Africa/Lagos, so the list and the map cannot disagree. */
  is_open_now: boolean;
}

export interface NearbyMarket extends Market {
  distance_km: number;
}

/**
 * A place OpenStreetMap tags as a marketplace, whether or not MarketLink has a row for it.
 *
 * There is no id, no opening hours and no stall list here, because those belong to a curated
 * row and this is not one. Attribution is owed to the OSM contributors wherever it is shown.
 *
 * `image_url` never comes from OpenStreetMap itself — it carries no photos — and comes from a
 * matching Wikimedia Commons market image or an explicitly labeled regional market image.
 */
export interface PlaceCandidate {
  ref: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  /** The OpenStreetMap tag pair, such as `amenity/marketplace`. */
  kind: string;
  image_url: string | null;
  image_credit: string | null;
  image_link: string | null;
  image_kind: 'exact' | 'regional' | null;
  image_region: string | null;
}

/** A stall at one market, from that market's point of view. */
export interface RosterFarmer {
  id: string;
  stall_name: string;
  contact_person: string;
  logo_url: string | null;
  rating_avg: number;
  rating_count: number;
  /** The stall's own pitch reference within the market. */
  stall_ref: string | null;
  days: string[];
}

export interface MarketDetail extends Market {
  farmers: RosterFarmer[];
  product_count: number;
}

export interface FarmerSummary {
  id: string;
  stall_name: string;
  contact_person: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  lat: number | null;
  lng: number | null;
  rating_avg: number;
  rating_count: number;
  currency: string;
  operating_days: string[];
}

export interface FarmerMarket {
  id: string;
  name: string;
  address: string;
  city: string;
  stall_ref: string | null;
  days: string[];
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
}

/**
 * A product as it appears on a stall page. Stock is this ISO week: no `weekly_stock` row for
 * the current week reads as `quantity_available: null, is_sold_out: false`, and the server
 * treats an unchecked quantity as unavailable rather than unlimited.
 */
export interface ListedProduct {
  id: string;
  name: string;
  unit: string;
  price_minor: number;
  image_urls: string[];
  is_organic: boolean;
  category: ProductCategory;
  quantity_available: number | null;
  is_sold_out: boolean;
}

export interface ProductCard extends ListedProduct {
  description: string | null;
  farmer: {
    id: string;
    stall_name: string;
    rating_avg: number;
    rating_count: number;
    currency: string;
    operating_days: string[];
    pickup_window_start: string | null;
    pickup_window_end: string | null;
    order_cutoff_minutes: number;
  };
  markets: { id: string; name: string; city: string; timezone: string; days: string[]; opens_at: string; closes_at: string }[];
}

export type OrderStatus = 'placed' | 'accepted' | 'preparing' | 'ready_for_pickup' | 'completed' | 'cancelled';
export interface OrderItem { product_id: string; name: string; unit: string; price_minor: number; quantity: number; reviewed: boolean }
export interface Order {
  id: string;
  reference: string;
  status: OrderStatus;
  subtotal_minor: number;
  delivery_fee_minor: 0;
  currency: string;
  pickup_date: string;
  pickup_slot_start: string;
  pickup_slot_end: string;
  cutoff_at: string;
  placed_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  farmer: { id: string; stall_name: string };
  market: { id: string; name: string; address: string; city: string; lat: number; lng: number };
  items: OrderItem[];
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  farmer_reply?: string | null;
  customer_name: string;
  created_at: string;
}

export interface FarmerDetail extends FarmerSummary {
  pickup_window_start: string | null;
  pickup_window_end: string | null;
  order_cutoff_minutes: number;
  markets: FarmerMarket[];
  products: ListedProduct[];
  reviews: Review[];
}
