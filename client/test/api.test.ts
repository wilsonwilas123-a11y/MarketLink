import { describe, expect, it } from 'vitest';
import { ApiError, createApi } from '../src/lib/api';
import { stubFetch } from './helpers/auth';

const makeApi = (stubs: Parameters<typeof stubFetch>[0], token: string | null = 'jwt-abc') => {
  const { fetchImpl, requests } = stubFetch(stubs);
  return {
    api: createApi({ baseUrl: '/api', getToken: async () => token, fetchImpl }),
    requests,
  };
};

describe('createApi', () => {
  it('sends the bearer token and reads the JSON body back', async () => {
    const { api, requests } = makeApi([{ path: '/me', body: { profile: null, farmer: null } }]);

    await expect(api.get('/me')).resolves.toEqual({ profile: null, farmer: null });
    expect(requests[0]).toEqual({
      method: 'GET',
      path: '/me',
      token: 'jwt-abc',
      body: undefined,
    });
  });

  it('sends no authorization header when there is no session', async () => {
    const { api, requests } = makeApi([{ path: '/healthz', body: { status: 'ok' } }], null);

    await api.get('/healthz');
    expect(requests[0]?.token).toBeNull();
  });

  it('serialises a body as JSON with the content type set', async () => {
    const { api, requests } = makeApi([{ method: 'POST', path: '/auth/bootstrap', body: { id: '1' } }]);

    await api.post('/auth/bootstrap', { role: 'farmer', phone: '+2348030000000' });
    expect(requests[0]?.body).toEqual({ role: 'farmer', phone: '+2348030000000' });
  });

  it('turns spec 9.1 envelope into a thrown ApiError, details included', async () => {
    const { api } = makeApi([
      {
        method: 'POST',
        path: '/orders',
        status: 409,
        body: {
          error: {
            code: 'stock_unavailable',
            message: 'Only 3 baskets left',
            details: { available: 3, requested: 5 },
          },
        },
      },
    ]);

    const err = await api.post('/orders', { qty: 5 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 409,
      code: 'stock_unavailable',
      message: 'Only 3 baskets left',
      details: { available: 3, requested: 5 },
    });
  });

  it('keeps a status and a code when the reply is not an envelope at all', async () => {
    const api = createApi({
      baseUrl: '/api',
      getToken: async () => null,
      fetchImpl: async () =>
        new Response('<html>Bad gateway</html>', {
          status: 502,
          headers: { 'content-type': 'text/html' },
        }),
    });

    const err = await api.get('/me').catch((e: unknown) => e);
    expect(err).toMatchObject({ status: 502, code: 'internal' });
  });

  it('reports an unreachable server as its own code', async () => {
    const api = createApi({
      baseUrl: '/api',
      getToken: async () => null,
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });

    const err = await api.get('/me').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 0, code: 'network_error' });
  });
});
