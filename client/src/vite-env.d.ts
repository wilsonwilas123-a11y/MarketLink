/// <reference types="vite/client" />

/**
 * The whole of the browser's view of the environment. Anything absent here is not available
 * at runtime either, and an unlisted variable reaching the bundle is how a secret leaks.
 */
interface ImportMetaEnv {
  readonly VITE_MAPBOX_ACCESS_TOKEN?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_API_URL?: string;
  readonly VITE_CONTACT_TEAM_NAME?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_CONTACT_PHONE?: string;
  readonly VITE_CONTACT_ADDRESS?: string;
  readonly VITE_CONTACT_LAT?: string;
  readonly VITE_CONTACT_LNG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
