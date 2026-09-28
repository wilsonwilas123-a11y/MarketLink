import type { GlyphName } from '../components/art/glyphs';

/** Local produce photos are used only where the depicted item is a credible match. */
export function localProductPhoto(name: string): string | null {
  const item = name.toLocaleLowerCase();
  if (/\bscent\s*leaf\b/.test(item)) return '/img/products/scent-leaf.png';
  if (/\bginger\s+leaf\b/.test(item)) return '/img/products/ginger-leaf.png';
  if (/\bginger\b/.test(item)) return '/img/products/ginger-root.png';
  if (/\bcoconut\b.*\bbread\b/.test(item)) return '/img/products/coconut-bread.png';
  if (/\bcoconut\b/.test(item) && !/\bbread\b/.test(item)) return '/img/products/coconut.png';
  if (/\bfarm\s+butter\b/.test(item)) return '/img/products/farm-butter.png';
  if (/\b(wakari|waraki|wara)\b|\bsweet\s+cheese\b/.test(item)) return '/img/products/wakari-sweet-cheese.png';
  if (/\bcurry\s+leaf\b/.test(item)) return '/img/products/curry-leaf.png';
  if (/\bgarlic\b/.test(item)) return '/img/products/garlic.png';
  if (/\bugu\b/.test(item)) return '/img/products/ugu.png';
  if (/\bwaterleaf\b/.test(item)) return '/img/products/waterleaf.png';
  if (/\bgboma\b/.test(item)) return '/img/products/gboma.png';
  if (/\bbitter\s+leaf\b/.test(item)) return '/img/products/bitter-leaf.png';
  if (/\buda\b/.test(item)) return '/img/products/uda.png';
  if (/\b(tulsi|tulasi|holy\s+basil)\b/.test(item)) return '/img/products/tulsi.png';
  if (/\befo\s*shoko\b/.test(item)) return '/img/products/efo-shoko.png';
  if (/\bwatermelons?\b/.test(item)) return '/img/products/watermelon.png';
  if (/\bfresh\s+milk\b/.test(item)) return '/img/products/fresh-milk.png';
  if (/\bmango(?:es)?\b/.test(item)) return '/img/products/mango.png';
  if (/\bsweet\s+bananas?\b/.test(item)) return '/img/products/sweet-banana.png';
  if (/\bpawpaw\b/.test(item)) return '/img/products/pawpaw.png';
  if (/\boranges?\b/.test(item)) return '/img/products/orange.png';
  if (/\bfermented\s+milk\b/.test(item)) return '/img/products/fermented-milk.png';
  if (/\byogurt\b|\byoghurt\b/.test(item)) return '/img/products/yogurt.png';
  if (/\bsugarloaf\b.*\bpineapple\b|\bsugarloaf\s+pineapple\b/.test(item)) return '/img/products/sugarloaf-pineapple.png';
  if (/\btomato(?:es)?\b/.test(item)) return '/img/products/tomato.png';
  if (/\bcabbage\b/.test(item) && /\b(half|cut)\b/.test(item)) return '/img/products/cabbage-half.png';
  if (/\bcabbage\b/.test(item) && /\bwhole\b/.test(item)) return '/img/products/cabbage-whole-head.png';
  if (/\bcabbage\b/.test(item)) return '/img/products/cabbage.png';
  if (/\bavocados?\b/.test(item)) return '/img/products/avocado.png';
  if (/\b(shombo|shomobo)\b/.test(item)) return '/img/products/shombo-pepper.png';
  if (/\brodo\b/.test(item)) return '/img/products/rodo.png';
  if (/\btatashe\b|\bbell\s*pepper\b/.test(item)) return '/img/products/tatashe-bell-pepper.png';
  if (/\bcoco\s*yam\b/.test(item)) return '/img/products/cocoyam.png';
  if (/\bplantain\s+chips\b/.test(item)) return '/img/products/plantain-chips.png';
  if (/\bcassava\s+flou?r\s+bread\b/.test(item)) return '/img/products/cassava-flour-bread.png';
  if (/\bmeat[\s-]+pie\b/.test(item)) return '/img/products/meat-pie.png';
  if (/\bagege\s+bread\b/.test(item)) return '/img/products/agege-bread.png';
  if (/\bchin\s*chin\b/.test(item)) return '/img/products/chin-chin.png';
  if (/\b(super|soup)\s+basket\b/.test(item)) return '/img/products/super-basket.png';
  if (/\borganic\s+leaf\s+basket\b/.test(item)) return '/img/products/organic-leaf-basket.png';
  if (/\bhousehold\b.*\bbasket\b/.test(item)) return '/img/products/household-full-basket.png';
  if (/\bstarter\s+basket\b/.test(item)) return '/img/products/starter-basket.png';
  if (/\bsweet\s+potato(?:es)?\b/.test(item)) return '/img/products/sweet-potato.png';
  if (/\bpotato(?:es)?\b/.test(item) && !/\bsweet\s+potato\b/.test(item)) return '/img/products/fresh-potato.png';
  if (/\bgarden\s+egg\b/.test(item)) return '/img/products/garden-egg.png';
  if (/\bonions?\b/.test(item)) return '/img/products/onion.png';
  if (/\b(egg|eggs)\b/.test(item)) return '/img/products/eggs.jpg';
  if (/\bpuna\s+yam\b/.test(item)) return '/img/products/puna-yam.png';
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
