import type { AuthEmailTemplate, AuthEmailStatus, AuthEmailType } from './auth-email-types';
import { AUTH_EMAIL_TYPE_ORDER } from './auth-email-types';

// mock 모드(VITE_SUPABASE_DISABLED) 결정적 시드 — e2e/프리뷰 경로.
// 실제 동기화는 일어나지 않으며 syncStatus 전이만 시뮬레이션한다.
let store: AuthEmailTemplate[] = AUTH_EMAIL_TYPE_ORDER.map((authType, index) => ({
  id: `mock-auth-email-${index + 1}`,
  authType,
  subject: '',
  bodyHtml: '',
  status: 'draft',
  syncStatus: 'draft',
  updatedAt: ''
}));

export function listMockAuthEmailTemplates(): AuthEmailTemplate[] {
  return store.map((template) => ({ ...template }));
}

export function saveMockAuthEmailTemplate(input: {
  authType: AuthEmailType;
  subject: string;
  bodyHtml: string;
  status?: AuthEmailStatus;
}): AuthEmailTemplate {
  store = store.map((template) =>
    template.authType === input.authType
      ? {
          ...template,
          subject: input.subject,
          bodyHtml: input.bodyHtml,
          status: input.status ?? template.status,
          syncStatus: 'draft',
          syncError: undefined
        }
      : template
  );
  return { ...(store.find((template) => template.authType === input.authType) as AuthEmailTemplate) };
}

export function markMockAuthEmailSynced(authType: AuthEmailType): AuthEmailTemplate {
  store = store.map((template) =>
    template.authType === authType
      ? {
          ...template,
          syncStatus: 'synced',
          status: template.status === 'draft' || template.status === 'ready' ? 'published' : template.status,
          syncedAt: '동기화(mock)',
          syncError: undefined
        }
      : template
  );
  return { ...(store.find((template) => template.authType === authType) as AuthEmailTemplate) };
}
