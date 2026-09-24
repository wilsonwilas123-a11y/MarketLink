/// <reference types="vite/client" />

/**
 * The whole of the browser's view of the environment. Anything absent here is not available
 * at runtime either, and an unlisted variable reaching the bundle is how a secret leaks.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
