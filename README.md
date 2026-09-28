# MarketLink

MarketLink helps shoppers find African farmers markets and current produce, then reserve items for pickup. Farmers manage their stall, weekly stock, and pickup orders. Orders are paid in person at pickup; online payments and delivery are not part of this project.

## Requirements and design

The supplied [MarketLink SRS](docs/reference/MarketLink%20End-to-End%20Web%20Solutions_SRS.pdf) is kept with the project. The [site guide](docs/site-guide.md) covers roles, workflows, routes, configuration, currencies, images and troubleshooting. [Implementation notes](docs/project-implementation-notes.md) provide architecture, data model and feature coverage. A [demo recording script](docs/demo-video-script.md) outlines the evaluation walkthrough. The interface uses warm white surfaces, forest-green actions, modern Manrope and DM Sans typography, and locally matched Lagos market and farm photography. The main screens cover the landing page, market discovery/map, product catalogue and details, farmer profiles, cart and pickup checkout, order tracking, customer account, farmer dashboard, and admin dashboard. The optional AI assistant is not required for core operation.

## Run locally

The full application uses Node.js 22 or newer, PostgreSQL (or Supabase Postgres), and a Supabase project for authentication and image storage.

1. Install dependencies from the repository root with `npm install`.
  2. Copy `.env.example` to `server/.env`, then set `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CLIENT_ORIGIN`. Configure the browser values in `client/.env` as `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL=http://localhost:4000/api`. For Mapbox satellite previews, add a public access token as `VITE_MAPBOX_ACCESS_TOKEN` in `client/.env` and restrict it to your site URL. For the Contact page, set the public `VITE_CONTACT_*` team details and map coordinates in `client/.env` to values approved for publication.
3. Apply the database migrations and demo seed with `npm run db:migrate` and `npm run db:seed`. Database setup details and Supabase notes are in [db/README.md](db/README.md).
4. Create a public Supabase Storage bucket named `product-images`; upload limits and access details are in [docs/product-image-storage.md](docs/product-image-storage.md).
5. Start the web app and API with `npm run dev`. The client is at `http://localhost:5173`; the API listens at `http://localhost:4000`.

The API reads `server/.env` at startup. Restart it after changing server settings. Never put the Supabase service-role key in `client/.env` or a `VITE_` variable.

### Google sign-in

Google sign-in uses Supabase OAuth; Google credentials do not belong in the web app's environment file. In Google Cloud Console, create a Web OAuth client and set its authorized redirect URI to the callback URL shown in Supabase under **Authentication → Sign In / Providers → Google** (usually `https://<project-ref>.supabase.co/auth/v1/callback`). Enable Google in that Supabase provider and enter the client ID and client secret there. In **Authentication → URL Configuration**, add `http://localhost:5173/signin` to the redirect URL allow list, plus the deployed site's `/signin` URL when you deploy. The app needs the same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` already listed above. First-time Google accounts continue to the existing profile setup screen.

## Seeded evaluation accounts

The demo seed creates customer and farmer accounts. Their email addresses are their lowercase seed names followed by `@marketlink.test`; the shared demo password is `marketlink-demo`. Admin access uses the server-only `ADMIN_EMAIL` and `ADMIN_PASSWORD` settings described in [Private admin access](docs/admin-access.md); the Supabase demo accounts cannot sign in to the admin dashboard.

| Role | Email addresses |
|---|---|
| Customer | `adaeze@marketlink.test`, `tunde@marketlink.test`, `zainab@marketlink.test`, `emeka@marketlink.test` |
| Farmer | `bola@marketlink.test`, `chidinma@marketlink.test`, `yahaya@marketlink.test`, `grace@marketlink.test`, `sunday@marketlink.test`, `ifaturo@marketlink.test`, `kelechi@marketlink.test`, `mariam@marketlink.test`, `seun@marketlink.test` |
| Admin | Set `ADMIN_PASSWORD` in `server/.env`; use the configured `ADMIN_EMAIL` |

These are demo-only credentials for an isolated evaluation environment. Change or remove them before exposing a deployment publicly. Supabase may restrict direct writes to `auth.users`; if seeding there is refused, follow the alternative account setup in [db/README.md](db/README.md).

## Useful commands

- `npm run build` compiles the API and production client.
- `npm run openapi` regenerates the API contract at `openapi.json`.
- `npm run db:migrate` applies outstanding SQL migrations.
- `npm run db:seed` loads Lagos demonstration markets, farmer stalls, and products.
