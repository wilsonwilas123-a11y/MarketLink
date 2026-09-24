import type { Pool } from 'pg';
import { ApiError } from '../errors.js';
import type { AuthSubject } from '../lib/auth.js';
import type { BootstrapInput, FarmerLink, Me, Profile, UpdateMeInput } from '../api/schemas.js';

const PROFILE_COLUMNS = `id, role, full_name, phone, address, avatar_url, is_active,
                         created_at, updated_at`;

/**
 * Creates the profile that Supabase Auth does not know about.
 *
 * Role comes from the caller but is constrained by the schema's two-value enum, so
 * `admin` cannot be self-granted here; promotion happens in the database.
 *
 * A farmer also gets a stall in `pending`, which is what puts them in front of the admin
 * approval queue instead of straight onto the public catalogue. The stall is named after
 * the applicant so the row is intelligible in that queue; they rename it from their
 * dashboard.
 */
export async function bootstrapProfile(
  pool: Pool,
  subject: AuthSubject,
  input: BootstrapInput,
): Promise<Profile> {
  const { rows } = await pool.query(
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

  if (input.role === 'farmer') {
    await pool.query(
      `insert into farmers (profile_id, stall_name, contact_person, status)
       values ($1, $2, $2, 'pending')
       on conflict (profile_id) do nothing`,
      [subject.id, input.full_name],
    );
  }

  return profile;
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
