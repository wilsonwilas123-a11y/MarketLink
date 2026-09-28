import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { demoSubject, fakePool, profileRow, testDeps } from './helpers/app.js';

const auth = { Authorization: 'Bearer a-token' };

const validProfile = {
  id: demoSubject.id,
  role: 'customer',
  full_name: 'Amara Okafor',
  phone: '+2348030000000',
  address: 'Mile 12, Oshodi',
  avatar_url: null,
  is_active: true,
  created_at: '2026-09-24T09:00:00.000Z',
  updated_at: '2026-09-24T09:00:00.000Z',
};

const farmerLink = { id: '22222222-2222-4222-8222-222222222222', stall_name: 'Amara Farms', status: 'pending' };

describe('POST /api/auth/bootstrap', () => {
  it('writes the profile from the token, not from the body', async () => {
    const pool = fakePool([validProfile]);
    const res = await request(createApp(testDeps({ pool })))
      .post('/api/auth/bootstrap')
      .set(auth)
      .send({
        full_name: 'Amara Okafor',
        phone: '+2348030000000',
        address: 'Mile 12, Oshodi',
        role: 'customer',
        // A client that sends these gets them ignored: the database defaults own both.
        id: '33333333-3333-4333-8333-333333333333',
        is_active: false,
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(validProfile);
    expect(pool.calls[0]?.text).toContain('insert into profiles');
    expect(pool.calls[0]?.values).toEqual([
      demoSubject.id,
      'customer',
      'Amara Okafor',
      '+2348030000000',
      'Mile 12, Oshodi',
    ]);
  });

  it('gives a new farmer a pending stall rather than a shopfront', async () => {
    const pool = fakePool([validProfile, farmerLink]);
    const res = await request(createApp(testDeps({ pool })))
      .post('/api/auth/bootstrap')
      .set(auth)
      .send({ full_name: 'Amara Okafor', phone: '+2348030000000', address: 'Mile 12, Oshodi', role: 'farmer', country: 'Nigeria', stall_name: 'Amara Farms' });

    expect(res.status).toBe(200);
    expect(pool.calls[1]?.text).toContain('insert into farmers');
    expect(pool.calls[1]?.text).toContain("'pending'");
    expect(pool.calls[1]?.values).toEqual([demoSubject.id, 'Amara Farms', 'Amara Okafor', 'Nigeria', 'NGN']);
  });

  it('refuses to hand out admin', async () => {
    const res = await request(createApp(testDeps()))
      .post('/api/auth/bootstrap')
      .set(auth)
      .send({ full_name: 'Aminu Yusuf', phone: '+2348030000001', role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'validation_failed' });
    expect(res.body.error.details).toEqual([{ field: 'role', message: expect.any(String) }]);
  });

  it('reports every bad field at once so a form can mark them together', async () => {
    const res = await request(createApp(testDeps()))
      .post('/api/auth/bootstrap')
      .set(auth)
      .send({ full_name: '', phone: '123', role: 'wholesaler' });

    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { field: string }) => d.field)).toEqual([
      'full_name',
      'phone',
      'role',
    ]);
  });

  it('requires a token of its own', async () => {
    const res = await request(createApp(testDeps()))
      .post('/api/auth/bootstrap')
      .send({ full_name: 'A', phone: '+2348030000000', role: 'customer' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });
});

describe('GET /api/me', () => {
  it('returns the profile with the stall the caller owns', async () => {
    const pool = fakePool([
      { ...validProfile, role: 'farmer' },
      { ...validProfile, role: 'farmer' },
      farmerLink,
    ]);
    const res = await request(createApp(testDeps({ pool }))).get('/api/me').set(auth);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      profile: { ...validProfile, role: 'farmer' },
      farmer: farmerLink,
    });
    expect(pool.calls[2]?.text).toContain('from farmers');
  });

  it('returns a null farmer link for a customer', async () => {
    const res = await request(
      createApp(testDeps({ pool: fakePool([validProfile, validProfile, null]) })),
    )
      .get('/api/me')
      .set(auth);

    expect(res.status).toBe(200);
    expect(res.body.farmer).toBeNull();
  });
});

describe('PATCH /api/me', () => {
  it('changes only the fields it was sent', async () => {
    const pool = fakePool([profileRow, { ...validProfile, phone: '+2348030009999' }]);
    const res = await request(createApp(testDeps({ pool })))
      .patch('/api/me')
      .set(auth)
      .send({ phone: '+2348030009999' });

    expect(res.status).toBe(200);
    expect(pool.calls[1]?.text).toContain('set phone = $1');
    expect(pool.calls[1]?.text).not.toContain('full_name =');
    expect(pool.calls[1]?.values).toEqual(['+2348030009999', demoSubject.id]);
  });

  it('clears an address sent as null', async () => {
    const pool = fakePool([profileRow, validProfile]);
    await request(createApp(testDeps({ pool }))).patch('/api/me').set(auth).send({ address: null });

    expect(pool.calls[1]?.values).toEqual([null, demoSubject.id]);
  });

  it('will not let an account promote or reinstate itself', async () => {
    for (const body of [{ role: 'admin' }, { is_active: false }, { id: 'nope' }]) {
      const pool = fakePool([profileRow]);
      const res = await request(createApp(testDeps({ pool }))).patch('/api/me').set(auth).send(body);
      const refused = Object.keys(body)[0];

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('validation_failed');
      expect(JSON.stringify(res.body)).toContain(refused);
      // One query is the auth lookup. A second would mean the update ran anyway.
      expect(pool.calls).toHaveLength(1);
    }
  });

  it('refuses an empty patch instead of running a no-op update', async () => {
    const pool = fakePool([profileRow]);
    const res = await request(createApp(testDeps({ pool }))).patch('/api/me').set(auth).send({});

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: '(root)', message: expect.any(String) }]);
    expect(pool.calls).toHaveLength(1);
  });
});
