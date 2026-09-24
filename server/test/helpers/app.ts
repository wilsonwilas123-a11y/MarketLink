import type { Pool } from 'pg';
import type { AppDeps, AuthUser } from '../../src/app.js';

export interface FakePool extends Pool {
  calls: Array<{ text: string; values: unknown[] }>;
  reset(): void;
}

/** Pool stub returning canned single-row results in call order, recording every query. */
export function fakePool(results: Array<Record<string, unknown>> = []): FakePool {
  const calls: Array<{ text: string; values: unknown[] }> = [];
  let cursor = 0;

  const query = async (text: string, values: unknown[] = []) => {
    calls.push({ text, values });
    const rows = results[cursor] ?? {};
    cursor += 1;
    return { rows: [rows], rowCount: 1, command: '', oid: 0, fields: null };
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

export const alwaysReject = async (): Promise<AuthUser | null> => null;

export function testDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return { pool: fakePool(), verifyToken: alwaysReject, ...overrides };
}
