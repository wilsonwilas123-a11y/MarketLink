# Database

Numbered SQL in `migrations/`, Lagos demo data in `seed/`, pgTAP checks in `tests/`.
Applied by hand — the app never migrates on boot.

## Against a local Postgres

Quickest is a container. Plain `postgres:16-alpine` works for the schema; the pgTAP
checks additionally need the extension built into it:

```bash
docker run -d --name ml-pg -e POSTGRES_PASSWORD=ml -e POSTGRES_DB=marketlink_test \
  -p 55432:5432 postgres:16-alpine

# build pgtap once per container (it does not survive `docker rm`)
docker exec ml-pg apk add --no-cache build-base git perl
docker exec ml-pg sh -c "cd /tmp && git clone --depth 1 --branch v1.3.4 \
  https://github.com/theory/pgtap.git && cd pgtap && make -j4 && make install"
```

Then from the repository root:

```bash
export DATABASE_URL=postgres://postgres:ml@127.0.0.1:55432/marketlink_test
npm run db:migrate && npm run db:seed && npm run db:test
```

Migrations are tracked in `schema_migrations`, so re-running applies only what is new.
Seeds carry no ledger — every insert ends in `ON CONFLICT DO NOTHING`, so they are safe
to repeat.

For the running app, it is valid to keep MarketLink data in this local database while
Supabase handles sign-in. Migration `0016_local_auth_identity.sql` detects the local
stand-in `auth.users` table and removes only the profile foreign key to that stand-in;
the API still checks each Supabase token before creating or reading a profile. When
`DATABASE_URL` points to the same Supabase project used for auth, the migration preserves
the managed `auth.users` foreign key.

## Against Supabase

Point `DATABASE_URL` at the project's session pooler connection string and run the same
three commands. Two things to expect:

- `0001_auth_stub_and_helpers.sql` checks whether `auth.users` already exists and skips
  creating it when it does, which is the case on Supabase.
- `0008_row_level_security.sql` creates `anon` / `authenticated` / `service_role` only if
  they are absent; Supabase already has them, so it just wires up grants and policies.

If `db:seed` is refused on the `auth.users` insert, your role lacks write access to the
`auth` schema. Either grant it (`grant insert on auth.users to postgres;`) or create the
demo accounts from the Supabase dashboard under Authentication → Users and delete the
`insert into auth.users` block from `seed/0001_lagos_core.sql`. The rest of the seed
depends on those rows existing, so this is the one step that cannot be skipped.

The `db:test` runner needs the `pgtap` extension enabled: Database → Extensions → pgtap,
or `create extension pgtap with schema extensions;` in the SQL editor.

## What the checks cover

| file | asserts |
|---|---|
| `tests/0001_schema.sql` | all twelve tables exist, money columns are `bigint`, slugs are validated, `iso_week()` follows ISO rather than calendar rules, and RLS genuinely refuses reads by `anon` / `authenticated` while `service_role` still gets through |
| `tests/0002_seed.sql` | the seed's row counts: 4 markets, 5 categories, 8 approved + 1 pending farmer, ~40 products, one `weekly_stock` row per product for the current week |
| `tests/0003_stock_guard.sql` | the checkout invariant in spec 6.1 — a guarded sell-down cannot oversell, cannot go negative, cannot take a zero-quantity line, and cannot list one product twice on an order |
