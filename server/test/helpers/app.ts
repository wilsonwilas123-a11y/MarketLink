import type { Pool } from 'pg';
import type { AppDeps } from '../../src/app.js';
import type { AuthSubject, AuthVerifier } from '../../src/lib/auth.js';

export interface FakePool extends Pool {
  calls: Array<{ text: string; values: unknown[] }>;
  reset(): void;
}

/** One row to hand back, or `null` for "the query matched nothing". */
export type Canned = Record<string, unknown> | null;

/** Pool stub returning canned single-row results in call order, recording every query. */
export function fakePool(results: Canned[] = []): FakePool {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  let cursor = 0;

  const query = async (text: string, values: unknown[] = []) => {
    calls.push({ text: text.replace(/\s+/g, ' ').trim(), values });
    const canned: Canned = cursor < results.length ? (results[cursor] as Canned) : {};
    cursor += 1;
    const rows = canned === null ? [] : [canned];
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
