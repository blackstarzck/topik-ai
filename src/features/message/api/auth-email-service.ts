import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import { isSupabaseConfigured } from '@/shared/api/supabase-client';
import type { AuthEmailStatus, AuthEmailTemplate, AuthEmailType } from '../model/auth-email-types';
import {
  listMockAuthEmailTemplates,
  markMockAuthEmailSynced,
  saveMockAuthEmailTemplate
} from '../model/auth-email-mock';
import {
  listSupabaseAuthEmailTemplates,
  saveSupabaseAuthEmailTemplate,
  syncSupabaseAuthEmailTemplate
} from './supabase-auth-email-service';
import { sleep } from '@/shared/api/supabase-service-utils';

/**
 * 인증 메일 서비스 파사드 — Supabase 구성 시 실 DB(RLS 읽기 + RPC 쓰기 + 서버 동기화),
 * 미구성/`VITE_SUPABASE_DISABLED` 시 mock(프리뷰/e2e). 화면은 이 파사드만 사용한다.
 */

export type SaveAuthEmailPayload = {
  authType: AuthEmailType;
  subject: string;
  bodyHtml: string;
  status?: AuthEmailStatus;
  reason?: string;
};

const useSupabase = isSupabaseConfigured;

async function listAuthEmailTemplates(): Promise<AuthEmailTemplate[]> {
  if (useSupabase) {
    return listSupabaseAuthEmailTemplates();
  }
  await sleep(120);
  return listMockAuthEmailTemplates();
}

async function saveAuthEmailTemplate(payload: SaveAuthEmailPayload): Promise<AuthEmailTemplate> {
  if (useSupabase) {
    return saveSupabaseAuthEmailTemplate(payload);
  }
  await sleep(140);
  return saveMockAuthEmailTemplate(payload);
}

async function syncAuthEmailTemplate(authType: AuthEmailType, reason?: string): Promise<AuthEmailTemplate> {
  if (useSupabase) {
    return syncSupabaseAuthEmailTemplate(authType, reason);
  }
  await sleep(160);
  return markMockAuthEmailSynced(authType);
}

export function fetchAuthEmailTemplatesSafe() {
  return toSafeResult(() => withRetry(() => listAuthEmailTemplates(), { maxRetries: 1 }));
}

export function saveAuthEmailTemplateSafe(payload: SaveAuthEmailPayload) {
  return toSafeResult(() => saveAuthEmailTemplate(payload));
}

export function syncAuthEmailTemplateSafe(authType: AuthEmailType, reason?: string) {
  return toSafeResult(() => syncAuthEmailTemplate(authType, reason));
}
