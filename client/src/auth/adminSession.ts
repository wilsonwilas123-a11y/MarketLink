import { createApi } from '../lib/api';

const TOKEN_KEY = 'marketlink.admin.session';
const EMAIL_KEY = 'marketlink.admin.email';
export const ADMIN_SESSION_EVENT = 'marketlink:admin-session-change';

export function getAdminEmail(): string | null {
  return window.localStorage.getItem(EMAIL_KEY);
}

export function getAdminToken(): Promise<string | null> {
  return Promise.resolve(window.localStorage.getItem(TOKEN_KEY));
}

export function saveAdminToken(token: string, email: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(EMAIL_KEY, email);
  window.dispatchEvent(new Event(ADMIN_SESSION_EVENT));
}

export function clearAdminToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(EMAIL_KEY);
  window.dispatchEvent(new Event(ADMIN_SESSION_EVENT));
}

export const adminApi = createApi({
  baseUrl: import.meta.env.VITE_API_URL ?? '/api',
  getToken: getAdminToken,
});
