import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client for the v13-owned project (overlap admin integration, Phase A).
 *
 * Flag-gated + additive: the client is created ONLY when the URL and a browser-safe
 * public key are present and local mock mode is not forced. When they are absent,
 * AuthGate remains a local pass-through (no login required) — see AuthGate. Feature
 * services may still opt into Supabase-only behaviour and surface an error instead
 * of reading local fallback data.
 *
 * Browser client: publishable/legacy anon key ONLY. Never put a secret/service role
 * key here; those belong only in server-side admin jobs.
 */
const env = import.meta.env as unknown as Record<string, string | undefined>;

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_ANON_KEY;
const isSupabaseDisabled = env.VITE_SUPABASE_DISABLED === 'true';

export const isSupabaseConfigured = !isSupabaseDisabled && Boolean(supabaseUrl && supabasePublishableKey);

export const supabaseClient: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabasePublishableKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
