import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser client.
 *
 * Uses the NEW-format publishable key (`sb_publishable_…`), which is the public
 * replacement for the legacy `anon` key and is safe to ship to the browser.
 * Secrets (service-role / secret keys) must NEVER live in a NEXT_PUBLIC_ var —
 * keep those server-side only.
 *
 * The app's system-of-record is still Prisma + Postgres. This client is for
 * Supabase-native features (storage, realtime, edge functions) as they get wired in.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

let client: SupabaseClient | null = null;

/**
 * Lazily create (and memoize) the Supabase client. Returns null if the env
 * vars are absent so importing this module never crashes a build/SSR pass.
 */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  if (!supabaseUrl || !supabasePublishableKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[supabase] NEXT_PUBLIC_SUPABASE_URL / _PUBLISHABLE_KEY not set — client disabled.");
    }
    return null;
  }
  client = createClient(supabaseUrl, supabasePublishableKey);
  return client;
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
