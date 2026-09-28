import { useQuery } from '@tanstack/react-query';
import type { ProductCard } from './types';
import { minorUnitDigits } from '../utils/money';

const RATE_URL = 'https://open.er-api.com/v6/latest/NGN';
const CACHE_KEY = 'marketlink.exchange-rates.ngn.v1';

export interface ExchangeRates {
  rates: Record<string, number>;
  updatedAt: number;
  nextUpdateAt: number;
}

interface ExchangeRateResponse {
  result?: string;
  time_last_update_unix?: number;
  time_next_update_unix?: number;
  rates?: Record<string, number>;
}

function readCachedRates(): ExchangeRates | undefined {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const cached = JSON.parse(raw) as ExchangeRates;
    if (cached.nextUpdateAt * 1000 <= Date.now() || !cached.rates?.NGN) return undefined;
    return cached;
  } catch {
    return undefined;
  }
}

async function fetchExchangeRates(): Promise<ExchangeRates> {
  const cached = readCachedRates();
  if (cached) return cached;

  const response = await fetch(RATE_URL);
  if (!response.ok) throw new Error(`Exchange rates request failed (${response.status})`);
  const payload = (await response.json()) as ExchangeRateResponse;
  if (payload.result !== 'success' || !payload.rates || !payload.time_next_update_unix) {
    throw new Error('Exchange rates are not available.');
  }

  const rates: ExchangeRates = {
    rates: payload.rates,
    updatedAt: payload.time_last_update_unix ?? Math.floor(Date.now() / 1000),
    nextUpdateAt: payload.time_next_update_unix,
  };
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(rates));
  } catch {
    // The live response is still usable when browser storage is unavailable.
  }
  return rates;
}

export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange-rates', 'NGN'],
    queryFn: fetchExchangeRates,
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });
}

/** Convert a database minor-unit price; null means a needed rate is unavailable. */
export function productPriceInCurrency(
  product: Pick<ProductCard, 'price_minor' | 'farmer'>,
  currency: string,
  rates?: ExchangeRates,
): number | null {
  const source = product.farmer.currency.toUpperCase();
  const target = currency.toUpperCase();
  const sourceAmount = product.price_minor / 10 ** minorUnitDigits(source);
  if (source === target) return sourceAmount;
  if (!rates) return null;

  const sourcePerNaira = rates.rates[source];
  const targetPerNaira = rates.rates[target];
  if (!sourcePerNaira || !targetPerNaira) return null;
  return (sourceAmount / sourcePerNaira) * targetPerNaira;
}
