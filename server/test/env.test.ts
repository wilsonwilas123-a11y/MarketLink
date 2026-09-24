import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/lib/env.js';

const working = {
  DATABASE_URL: 'postgres://postgres:ml@127.0.0.1:55432/marketlink_test',
  SUPABASE_URL: 'https://demo-project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-that-is-at-least-forty-chars',
  CLIENT_ORIGIN: 'http://localhost:5173',
};

describe('loadEnv', () => {
  it('accepts a real configuration and fills in the optional parts', () => {
    const env = loadEnv(working);
    expect(env.PORT).toBe(4_000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('takes PORT as text and hands back a number', () => {
    expect(loadEnv({ ...working, PORT: '8080' }).PORT).toBe(8080);
  });

  it('names every missing variable in one complaint', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL[\s\S]*SUPABASE_URL[\s\S]*SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('refuses a service-role key too short to be one', () => {
    expect(() => loadEnv({ ...working, SUPABASE_SERVICE_ROLE_KEY: 'abc' })).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it('rejects a database url that is not a url', () => {
    expect(() => loadEnv({ ...working, DATABASE_URL: 'localhost marketlink' })).toThrow(
      /DATABASE_URL must be a valid URL/,
    );
  });

  it('says how to fix it', () => {
    expect(() => loadEnv({})).toThrow('.env.example');
  });
});
