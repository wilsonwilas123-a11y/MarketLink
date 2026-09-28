export const REDUCE_QUERY = '(prefers-reduced-motion: reduce)';

/** Environments without matchMedia should render content still and accessible. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
  return window.matchMedia(REDUCE_QUERY).matches;
}
