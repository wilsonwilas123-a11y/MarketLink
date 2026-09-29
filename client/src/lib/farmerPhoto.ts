import type { FarmerSummary } from './types';

/** Bundled farmer photography keeps the directory usable without remote image hosts. */
const DEMO_FARMER_PHOTOS: Record<string, string> = {
  // Photos supplied for the seven grower cards.
  'Funmilayo Balogun': '/img/farmers/balogun-leaf-coop.webp',
  'Chidera Nwachukwu': '/img/farmers/grower-02.webp',
  'Olumide Ogunsanya': '/img/farmers/ogunsanya-cassava-works.webp',
  'Blessing Aluko': '/img/farmers/aluko-chip-kitchen.webp',
  'Peter Okonkwu': '/img/farmers/grower-05.webp',
  'Nneka Mbadiwe': '/img/farmers/plantain-grower.webp',
  'Tolu Adebayo': '/img/farmers/grower-07.webp',
  // Additional photos supplied for the farm directory.
  'Yinka Oyelaran': '/img/farmers/grower-08.webp',
  'Rabiu Momoh': '/img/farmers/grower-09.webp',
  'Halima Sadiq': '/img/farmers/grower-10.webp',
  'Ireni Okafor': '/img/farmers/okafor-yoghurt-kitchen.webp',
  'Kingsley Onyeka': '/img/farmers/onyeka-greenhouse.webp',
  'Musa Abubakar': '/img/farmers/abubakar-tomato-lines.webp',
  'Fatima Bature': '/img/farmers/bature-milk-round.webp',
  'Kolade Shonibare': '/img/farmers/shonibare-leaf-house.webp',
  // Existing local portraits and farm photos.
  'Bola Adeyemi': '/img/farmers/adeyemi-farms.webp',
  'Chidinma Eze': '/img/farmers/chidinma.jpg',
  'Yahaya Sanni': '/img/farmers/yahaya.jpg',
  'Ifaturo Ade': '/img/farmers/ade-orchard.webp',
  'Dele Ogunlana': '/img/farmers/coconut-grower.webp',
  'Hauwa Garba': '/img/farmers/rodo-pepper-grower.webp',
  'Grace Effiong': '/img/farmers/grace.jpg',
  'Sunday Ochelula': '/img/farmers/sunday.jpg',
  'Kelechi Anyanwu': '/img/farmers/kelechi.jpg',
  'Mariam Lawal': '/img/farmers/mariam.jpg',
  'Seun Oluwale': '/img/farmers/seun.jpg',
  'Tosin Ajayi': '/img/farmers/ajayi-bread-oven.webp',
};

const LOCAL_FALLBACKS = [
  '/img/farmers/grower-01.webp', '/img/farmers/grower-02.webp', '/img/farmers/grower-03.webp',
  '/img/farmers/grower-04.webp', '/img/farmers/grower-05.webp', '/img/farmers/grower-06.webp',
  '/img/farmers/grower-07.webp', '/img/farmers/grower-08.webp', '/img/farmers/grower-09.webp',
  '/img/farmers/grower-10.webp', '/img/farmers/bola.jpg', '/img/farmers/chidinma.jpg',
  '/img/farmers/yahaya.jpg', '/img/farmers/grace.jpg', '/img/farmers/sunday.jpg',
  '/img/farmers/ifaturo.jpg', '/img/farmers/kelechi.jpg', '/img/farmers/mariam.jpg',
  '/img/farmers/seun.jpg',
];

function photoFor(contact: string, id: string) {
  const named = DEMO_FARMER_PHOTOS[contact];
  if (named) return named;
  const hash = Array.from(id).reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 0);
  return LOCAL_FALLBACKS[hash % LOCAL_FALLBACKS.length]!;
}

/** Prefer an uploaded farmer cover; otherwise use a bundled, deterministic local photo. */
export function farmerCover(farmer: Pick<FarmerSummary, 'cover_url' | 'contact_person' | 'id'>) {
  const uploadedCover = farmer.cover_url?.trim();
  // Some existing rows still contain old Unsplash URLs. Ignore those so the directory never
  // makes a request to that CDN; use its bundled local cover instead.
  if (uploadedCover && !/unsplash\.com/i.test(uploadedCover)) return uploadedCover;
  return photoFor(farmer.contact_person, farmer.id);
}
