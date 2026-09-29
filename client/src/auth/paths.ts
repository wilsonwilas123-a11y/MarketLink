import type { Role } from '../lib/types';


export function homeFor(role: Role): string {
  if (role === 'farmer') return '/farmers/dashboard';
  if (role === 'admin') return '/admin';
  return '/account';
}

export const COMPLETE_PROFILE_PATH = '/complete-profile';

/** Keeps the query string, so a filtered page is the place you return to. */
export function signInPath(current: string): string {
  const route = current === '/admin' || current.startsWith('/admin/') ? '/admin/signin' : '/signin';
  return `${route}?returnTo=${encodeURIComponent(current)}`;
}

/**
 * Null unless the value is a same-origin path: `?returnTo=https://evil.test` must not turn
 * sign-in into an off-site redirect. A caller with no usable value sends the visitor to their
 * own home instead, which is right for their role.
 */
export function safeReturnTo(value: string | null | undefined): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}
