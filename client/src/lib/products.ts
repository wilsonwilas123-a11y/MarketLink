import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { searchParams } from './discovery';
import type { ApiPage, ProductCard, Weekday } from './types';

export interface ProductFilters {
  q?: string;
  category?: string;
  marketId?: string;
  day?: Weekday;
  inStockOnly?: boolean;
  sort?: 'popular' | 'price_low' | 'price_high' | 'newest';
  page?: number;
  limit?: number;
}

export function useProducts(filters: ProductFilters) {
  const { api } = useAuth();
  const query = searchParams({
    q: filters.q,
    category: filters.category,
    market_id: filters.marketId,
    day: filters.day,
    in_stock_only: filters.inStockOnly,
    sort: filters.sort,
    page: filters.page ?? 1,
    limit: filters.limit ?? 24,
  });

  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => api.get<ApiPage<ProductCard>>(`/products${query}`),
    staleTime: 60_000,
  });
}

export function useProduct(id: string) {
  const { api } = useAuth();
  return useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => api.get<ProductCard>(`/products/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}
