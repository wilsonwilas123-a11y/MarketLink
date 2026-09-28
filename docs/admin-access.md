# Private admin access

The admin sign-in is intentionally absent from public navigation. Open `/admin/signin`
directly. Admin credentials are checked by the API and are independent of Supabase Auth.
Only a short-lived signed session token is returned to the browser; the password is never
sent to, stored in, or bundled with the client application.

## Set up the designated administrator

1. Open `server/.env` and set `ADMIN_PASSWORD` to a strong private password. Keep it blank
   in `.env.example`; do not use a `VITE_` variable or commit the real value.
2. Keep `ADMIN_EMAIL=wilsontechtechy@gmail.com` in `server/.env`. The server uses this as
   the sole admin email by default.
3. Restart the API so it loads the password, then sign in at `/admin/signin`. The dashboard
   is at `/admin`. Admin sessions expire after eight hours; changing the password invalidates
   existing sessions.

If `ADMIN_PASSWORD` is blank, admin sign-in is disabled. Regular buyer and seller sign-in
continues to use Supabase Auth.

The database migration workflow is manual; see [Database setup](../db/README.md).
