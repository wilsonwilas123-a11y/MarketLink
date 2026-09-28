import type { GlyphName } from '../components/art/glyphs';

/** Local produce photos are used only where the depicted item is a credible match. */
export function localProductPhoto(name: string): string | null {
  const item = name.toLocaleLowerCase();
  if (/\b(egg|eggs)\b/.test(item)) return '/img/products/eggs.jpg';
  if (/\b(yam|yams)\b/.test(item)) return '/img/products/tatashe.jpg';
  if (/\b(rice|paddy)\b/.test(item)) return '/img/products/paddy.jpg';
  return null;
}

/** When we do not have a matching photograph, use art that matches the named crop. */
export function localProductGlyph(name: string): GlyphName | undefined {
  const item = name.toLocaleLowerCase();
  if (/\b(egg|eggs)\b/.test(item)) return 'egg';
  if (/\b(tomato|tomatoes)\b/.test(item)) return 'tomato';
  if (/\b(tatashe|pepper|shombo|rodo|chilli|chili)\b/.test(item)) return 'pepper';
  if (/\b(carrot|carrots)\b/.test(item)) return 'carrot';
  if (/\bonion\b/.test(item)) return 'onion';
  if (/\b(yam|yams|tuber|coco yam|sweet potato|cassava)\b/.test(item)) return 'tuber';
  if (/\b(ugu|efo|gboma|waterleaf|bitter leaf|scent leaf|cabbage|greens|spinach|leaf)\b/.test(item)) return 'leaf';
  if (/\b(mango|mangoes)\b/.test(item)) return 'mango';
  if (/\b(banana|plantain)\b/.test(item)) return 'banana';
  if (/\b(pineapple)\b/.test(item)) return 'pineapple';
  if (/\b(avocado)\b/.test(item)) return 'avocado';
  if (/\b(coconut)\b/.test(item)) return 'coconut';
  if (/\b(orange|tangerine)\b/.test(item)) return 'orange';
  if (/\b(garden egg|eggplant|aubergine)\b/.test(item)) return 'eggplant';
  if (/\b(ginger)\b/.test(item)) return 'tuber';
  if (/\b(garlic)\b/.test(item)) return 'onion';
  if (/\b(rice|grain|paddy)\b/.test(item)) return 'grain';
  if (/\b(milk|yoghurt|yogurt|cheese|butter)\b/.test(item)) return 'milk';
  if (/\b(bread|pie|chin chin)\b/.test(item)) return 'bread';
  return undefined;
}
