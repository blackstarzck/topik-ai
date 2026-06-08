import { useAuthStore } from './auth-store';

/**
 * Phase A actor source. Returns the real Supabase session user id when authenticated,
 * otherwise the legacy hardcoded fallback so existing mock flows keep working.
 *
 * Phase B write paths should adopt this in place of the hardcoded 'admin_current' /
 * 'admin_park' constants, so every audited mutation records the real auth actor.
 */
const FALLBACK_ACTOR = 'admin_current';

export function useCurrentActor(): string {
  return useAuthStore((state) => state.session?.userId ?? FALLBACK_ACTOR);
}

export function getCurrentActor(): string {
  return useAuthStore.getState().session?.userId ?? FALLBACK_ACTOR;
}
