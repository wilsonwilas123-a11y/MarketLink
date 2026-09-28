import type { FarmerSummary } from './types';

/** One Unsplash photo per seeded demo stall, so directory and home cards stay distinct. */
const DEMO_FARMER_PHOTOS: Record<string, string> = {
  'Funmilayo Balogun': 'https://images.unsplash.com/photo-1774504798125-bd6eed7063fc?auto=format&fit=crop&w=1200&q=80',
  'Chidera Nwachukwu': 'https://images.unsplash.com/photo-1746014929708-fcb859fd3185?auto=format&fit=crop&w=1200&q=80',
  'Olumide Ogunsanya': 'https://images.unsplash.com/photo-1761466977752-de51b3ecce84?auto=format&fit=crop&w=1200&q=80',
  'Blessing Aluko': 'https://images.unsplash.com/photo-1764001032216-360a43576788?auto=format&fit=crop&w=1200&q=80',
  'Peter Okonkwu': 'https://images.unsplash.com/photo-1782768752540-f7daed386b1f?auto=format&fit=crop&w=1200&q=80',
  'Nneka Mbadiwe': 'https://images.unsplash.com/photo-1770351445539-da6f0e5daf9f?auto=format&fit=crop&w=1200&q=80',
  'Tolu Adebayo': 'https://images.unsplash.com/photo-1758158286655-f0d93d86e174?auto=format&fit=crop&w=1200&q=80',
  'Halima Sadiq': 'https://images.unsplash.com/photo-1707811179851-c1f93698ad46?auto=format&fit=crop&w=1200&q=80',
  'Kingsley Onyeka': 'https://images.unsplash.com/photo-1707721690626-10e5f0366bcb?auto=format&fit=crop&w=1200&q=80',
  'Amaka Udeh': 'https://images.unsplash.com/photo-1707721690544-781fe6ede937?auto=format&fit=crop&w=1200&q=80',
  'Yinka Oyelaran': 'https://images.unsplash.com/photo-1695566371418-fd617877ab3a?auto=format&fit=crop&w=1200&q=80',
  'Fatima Bature': 'https://images.unsplash.com/photo-1781785178874-7e4a5ece4348?auto=format&fit=crop&w=1200&q=80',
  'Musa Abubakar': 'https://images.unsplash.com/photo-1781785186628-e1a04569776d?auto=format&fit=crop&w=1200&q=80',
  'Hauwa Garba': 'https://images.unsplash.com/photo-1777377371993-734aaec2fe22?auto=format&fit=crop&w=1200&q=80',
  'Dele Ogunlana': 'https://images.unsplash.com/photo-1745003368741-37137ffc9639?auto=format&fit=crop&w=1200&q=80',
  'Uche Nnamdi': 'https://images.unsplash.com/photo-1769420246413-cf1531018fb4?auto=format&fit=crop&w=1200&q=80',
  'Kolade Shonibare': 'https://images.unsplash.com/photo-1529045138962-5f59528258fe?auto=format&fit=crop&w=1200&q=80',
  'Rabiu Momoh': 'https://images.unsplash.com/photo-1762512216957-04c53ca12643?auto=format&fit=crop&w=1200&q=80',
  'Tosin Ajayi': 'https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=1200&q=80',
  'Ireni Okafor': 'https://images.unsplash.com/photo-1741874299706-2b8e16839aaa?auto=format&fit=crop&w=1200&q=80',
};

const EXTRA_PHOTOS = Object.values(DEMO_FARMER_PHOTOS);

function photoFor(contact: string, id: string) {
  const named = DEMO_FARMER_PHOTOS[contact];
  if (named) return named;
  const hash = Array.from(id).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  return EXTRA_PHOTOS[hash % EXTRA_PHOTOS.length]!;
}

/** Prefer a farmer's uploaded cover. Seeded demo farmers get a consistent distinct photo. */
export function farmerCover(farmer: Pick<FarmerSummary, 'cover_url' | 'contact_person' | 'id'>) {
  return farmer.cover_url || photoFor(farmer.contact_person, farmer.id);
}
