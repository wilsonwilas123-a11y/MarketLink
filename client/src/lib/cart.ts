export interface CartSelection {
  product_id: string;
  quantity: number;
  market_id: string;
}

const KEY = 'marketlink.cart.v1';
const EVENT = 'marketlink:cart-changed';

export function readCart(): CartSelection[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((row): row is CartSelection =>
      typeof row?.product_id === 'string' &&
      Number.isInteger(row?.quantity) && row.quantity > 0 &&
      typeof row?.market_id === 'string',
    );
  } catch {
    return [];
  }
}

function saveCart(items: CartSelection[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

export function addToCart(item: CartSelection) {
  const items = readCart();
  const found = items.find((row) => row.product_id === item.product_id && row.market_id === item.market_id);
  if (found) found.quantity += item.quantity;
  else items.push(item);
  saveCart(items);
}

export function updateCartItem(productId: string, marketId: string, quantity: number) {
  const items = readCart().map((item) =>
    item.product_id === productId && item.market_id === marketId ? { ...item, quantity } : item,
  );
  saveCart(items.filter((item) => item.quantity > 0));
}

export function removeCartItem(productId: string, marketId: string) {
  saveCart(readCart().filter((item) => item.product_id !== productId || item.market_id !== marketId));
}

export function cartEventName() {
  return EVENT;
}
