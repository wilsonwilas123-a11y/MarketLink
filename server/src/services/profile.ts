import type { Pool } from 'pg';
import { ApiError } from '../errors.js';
import type { AuthSubject } from '../lib/auth.js';
import type { BootstrapInput, FarmerLink, Me, Profile, UpdateMeInput } from '../api/schemas.js';

const PROFILE_COLUMNS = `id, role, full_name, phone, address, avatar_url, is_active,
                         created_at, updated_at`;

const FARMER_CURRENCY: Record<string, string> = {
  Nigeria: 'NGN', Ghana: 'GHS', Kenya: 'KES', 'South Africa': 'ZAR', Senegal: 'XOF',
  "Côte d'Ivoire": 'XOF', Cameroon: 'XAF', Uganda: 'UGX', Tanzania: 'TZS', Rwanda: 'RWF',
  Egypt: 'EGP', Morocco: 'MAD', Ethiopia: 'ETB', Botswana: 'BWP', Zambia: 'ZMW', Mozambique: 'MZN',
};

/**
 * Creates the profile that Supabase Auth does not know about.
 *
 * Role comes from the caller but is constrained by the schema's two-value enum, so
 * `admin` cannot be self-granted here; promotion happens in the database. It is also
 * absent from the `on conflict` set: re-running bootstrap refreshes the contact details of
 * an existing account but cannot convert a customer into a farmer, or the other way round.
 *
 * A farmer also gets a stall in `pending`, which is what puts them in front of the admin
 * approval queue instead of straight onto the public catalogue. The stall is named after
 * the applicant so the row is intelligible in that queue; they rename it from their
 * dashboard.
 *
 * The profile and farmer rows are written in one transaction. A retry after a network
 * interruption therefore sees either both rows or neither, never a half-created account.
 */
export async function bootstrapProfile(
  pool: Pool,
  subject: AuthSubject,
  input: BootstrapInput,
): Promise<Profile> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      `insert into profiles (id, role, full_name, phone, address)
       values ($1, $2, $3, $4, $5)
       on conflict (id) do update
          set full_name = excluded.full_name,
              phone     = excluded.phone,
              address   = coalesce(excluded.address, profiles.address)
       returning ${PROFILE_COLUMNS}`,
      [subject.id, input.role, input.full_name, input.phone, input.address ?? null],
    );

    const profile = rows[0] as Profile;

    // Keep the role in Postgres authoritative. A retry must not create a farmer row for
    // an account whose existing profile was created as a customer.
    if (profile.role === 'farmer' && input.role === 'farmer') {
      const country = input.country!;
      const currency = FARMER_CURRENCY[country];
      await client.query(
        `insert into farmers (profile_id, stall_name, contact_person, status, country, currency)
         values ($1, $2, $3, 'pending', $4, $5)
         on conflict (profile_id) do nothing`,
        [subject.id, input.stall_name ?? input.full_name, input.full_name, country, currency],
      );
    }

    await client.query('commit');
    return profile;
  } catch (err) {
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** The caller's profile plus the stall they own, if any. */
export async function readMe(pool: Pool, profileId: string): Promise<Me> {
  const { rows } = await pool.query(
    `select ${PROFILE_COLUMNS} from profiles where id = $1`,
    [profileId],
  );
  const profile = rows[0];
  if (!profile) throw new ApiError('not_found', 'No such profile.');

  const farmer = await pool.query(
    `select id, stall_name, status from farmers where profile_id = $1`,
    [profileId],
  );

  return { profile, farmer: (farmer.rows[0] as FarmerLink | undefined) ?? null };
}

/**
 * Partial update built from the keys actually present, so an omitted field is left alone
 * and an explicit `null` clears it — the two are different requests and a hand-written
 * `coalesce` chain would collapse them.
 */
export async function updateMe(
  pool: Pool,
  profileId: string,
  input: UpdateMeInput,
): Promise<Profile> {
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(input)) {
    // `key` reaches the SQL as text, which the no-interpolation rule would normally
    // forbid. It is safe because these are the parsed schema's own keys — UpdateMeSchema is
    // `.strict()`, so anything else was rejected before this ran and the set of possible
    // names is exactly the four columns it declares. Values stay parameterised.
    columns.push(`${key} = $${values.length + 1}`);
    values.push(value);
  }

  if (columns.length === 0) {
    throw new ApiError('validation_failed', 'Provide at least one field to change.');
  }

  values.push(profileId);
  const { rows } = await pool.query(
    `update profiles set ${columns.join(', ')} where id = $${values.length}
     returning ${PROFILE_COLUMNS}`,
    values,
  );

  const profile = rows[0];
  if (!profile) throw new ApiError('not_found', 'No such profile.');
  return profile as Profile;
}
