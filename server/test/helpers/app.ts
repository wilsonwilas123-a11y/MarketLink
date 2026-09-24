import type { Pool } from 'pg';
import type { AppDeps } from '../../src/app.js';
import type { AuthSubject, AuthVerifier } from '../../src/lib/auth.js';

export interface FakePool extends Pool {
  calls: Array<{ text: string; values: unknown[] }>;
  reset(): void;
}

/**
 * Rows to hand back for one query: a single row, several of them, or `null` for "matched
 * nothing". A bare object is wrapped, which is what the single-row routes have always meant.
 */
export type Canned = Record<string, unknown> | Record<string, unknown>[] | null;

/** Pool stub returning canned results in call order, recording every query. */
export function fakePool(results: Canned[] = []): FakePool {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  let cursor = 0;

  const query = async (text: string, values: unknown[] = []) => {
    calls.push({ text: text.replace(/\s+/g, ' ').trim(), values });
    const next: Canned | undefined = results[cursor];
    cursor += 1;
    // Past the end of the script a query is answered with one blank row, so a route's own
    // not-found guard does not silently swallow the assertions that come after it.
    const canned: Canned = next === undefined ? {} : next;
    const rows = canned === null ? [] : Array.isArray(canned) ? canned : [canned];
    return { rows, rowCount: rows.length, command: '', oid: 0, fields: null };
  };

  return {
    query,
    calls,
    reset: () => {
      cursor = 0;
      calls.length = 0;
    },
  } as unknown as FakePool;
}

/** The account a token resolves to, or `null` to refuse every token. */
export function fakeAuth(subject: AuthSubject | null = null): AuthVerifier {
  return { getUser: async () => subject };
}

export const demoSubject: AuthSubject = { id: '11111111-1111-4111-8111-111111111111', email: 'a@b.co' };

export const profileRow = {
  id: demoSubject.id,
  role: 'customer',
  full_name: 'Amara Okafor',
  phone: '+2348030000000',
  address: null,
  avatar_url: null,
  is_active: true,
  created_at: '2026-09-24T09:00:00.000Z',
  updated_at: '2026-09-24T09:00:00.000Z',
};

export function testDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return { pool: fakePool([profileRow]), auth: fakeAuth(demoSubject), ...overrides };
}
