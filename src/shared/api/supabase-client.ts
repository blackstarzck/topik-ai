import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client for the v13-owned project (overlap admin integration, Phase A).
 *
 * Flag-gated + additive: the client is created ONLY when both env vars are present
 * (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY). When they are absent the app keeps
 * its existing mock-only behaviour (no login required) — see AuthGate. This keeps the
 * frozen admin app working unchanged until the dev Supabase connection is wired.
 *
 * Browser client: anon/publishable key ONLY. Never put the service_role key here.
 */
const env = import.meta.env as unknown as Record<string, string | undefined>;

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseClient: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;
