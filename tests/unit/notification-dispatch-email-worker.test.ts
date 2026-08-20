import { afterEach, describe, expect, it, vi } from 'vitest';

import worker, { GET, POST } from '../../api/notifications/dispatch-email';

const ORIGINAL_ENV = { ...process.env };
const { createClientMock, createTransportMock, sendMailMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createTransportMock: vi.fn(),
  sendMailMock: vi.fn()
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: createTransportMock
  }
}));

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.CRON_SECRET;
  delete process.env.NOTIFICATION_WORKER_SECRET;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.VITE_SUPABASE_URL;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.SMTP_FROM;
}

function request(method: string, headers?: HeadersInit): Request {
  return new Request('https://admin.example.com/api/notifications/dispatch-email', {
    method,
    headers
  });
}

type MockSupabaseOptions = {
  templateClass?: 'marketing' | 'transactional';
  displayName?: string | null;
};

function createQueryMock(table: string, options: Required<MockSupabaseOptions>) {
  const state = {
    updatePayload: undefined as unknown
  };

  // update(...).eq(...) 는 Promise 를 돌려준다 — query 체인과 모양이 다르다.
  const eq = vi.fn(async () => ({ error: null }));

  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    update: vi.fn((payload: unknown) => {
      state.updatePayload = payload;
      return { eq };
    }),
    limit: vi.fn(async () => {
      if (table === 'notification_delivery_attempts') {
        return {
          data: [
            {
              id: 'attempt-1',
              user_id: 'user-1',
              dispatch_id: 'dispatch-1',
              template_key: 'welcome_email',
              retry_count: 0,
              created_at: '2026-06-18T00:00:00.000Z'
            }
          ],
          error: null
        };
      }
      return { data: [], error: null };
    }),
    maybeSingle: vi.fn(async () => {
      if (table === 'notification_dispatches') {
        return { data: { template_id: 'template-1' }, error: null };
      }
      if (table === 'notification_templates') {
        return {
          data: {
            subject: '안녕하세요 {{display_name}}',
            body_html: '<p>{{display_name}}님, 새 알림입니다.</p>',
            link_url: '/notifications',
            class: options.templateClass
          },
          error: null
        };
      }
      if (table === 'profiles') {
        return { data: { display_name: options.displayName }, error: null };
      }
      if (table === 'user_marketing_consent') {
        return { data: { unsubscribe_token: 'unsubscribe-token' }, error: null };
      }
      return { data: null, error: null };
    }),
    then: undefined as never
  };

  return { query, state, eq };
}

function installSupabaseMock(options: MockSupabaseOptions = {}) {
  const normalized: Required<MockSupabaseOptions> = {
    templateClass: options.templateClass ?? 'marketing',
    displayName: options.displayName ?? null
  };
  const tableMocks = new Map<string, ReturnType<typeof createQueryMock>>();
  const updates: unknown[] = [];

  const supabase = {
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({
          data: { user: { email: 'learner@example.com' } },
          error: null
        }))
      }
    },
    from: vi.fn((table: string) => {
      const tableMock = createQueryMock(table, normalized);
      tableMocks.set(table, tableMock);
      const originalUpdate = tableMock.query.update;
      tableMock.query.update = vi.fn((payload: unknown) => {
        updates.push(payload);
        return originalUpdate(payload);
      });
      return tableMock.query;
    })
  };

  createClientMock.mockReturnValue(supabase);
  return { supabase, updates };
}

describe('notification dispatch email worker auth boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    createClientMock.mockReset();
    createTransportMock.mockReset();
    sendMailMock.mockReset();
    resetEnv();
  });

  it('rejects cron GET without CRON_SECRET bearer auth', async () => {
    process.env.CRON_SECRET = 'cron-secret';

    const response = await GET(request('GET'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'unauthorized'
    });
  });

  it('accepts cron GET auth before failing closed when SMTP is not configured', async () => {
    process.env.CRON_SECRET = 'cron-secret';

    const response = await GET(
      request('GET', { Authorization: 'Bearer cron-secret' })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'smtp_not_configured'
    });
  });

  it('rejects manual POST without x-worker-secret', async () => {
    process.env.NOTIFICATION_WORKER_SECRET = 'worker-secret';

    const response = await POST(request('POST'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'unauthorized'
    });
  });

  it('accepts manual POST auth before failing closed when SMTP is not configured', async () => {
    process.env.NOTIFICATION_WORKER_SECRET = 'worker-secret';

    const response = await POST(
      request('POST', { 'x-worker-secret': 'worker-secret' })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'smtp_not_configured'
    });
  });

  it('rejects unsupported methods before worker execution', async () => {
    const response = await worker.fetch(request('PUT'));

    expect(response.status).toBe(405);
    await expect(response.json()).resolves.toEqual({
      error: 'Method Not Allowed',
      allow: ['GET', 'POST']
    });
  });

  it('sends marketing email with the v13 Korean rendering contract', async () => {
    process.env.NOTIFICATION_WORKER_SECRET = 'worker-secret';
    process.env.SUPABASE_URL = 'https://supabase.example.com';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    process.env.SITE_URL = 'https://app.example.com';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '465';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    process.env.SMTP_FROM = 'TOPIK AI <sender@example.com>';
    installSupabaseMock({ templateClass: 'marketing', displayName: null });
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    sendMailMock.mockResolvedValue({ messageId: 'smtp-message-1' });

    const response = await POST(
      request('POST', { 'x-worker-secret': 'worker-secret' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      processed: 1,
      sent: 1,
      failed: 0
    });
    expect(createTransportMock).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-pass'
      }
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const body = sendMailMock.mock.calls[0][0];
    expect(body).toMatchObject({
      from: 'TOPIK AI <sender@example.com>',
      to: 'learner@example.com',
      subject: '안녕하세요 학습자'
    });
    expect(body.html).toContain('<p>학습자님, 새 알림입니다.</p>');
    expect(body.html).toContain('https://app.example.com/notifications');
    expect(body.html).toContain('알림 확인하기');
    expect(body.html).toContain('https://app.example.com/api/notifications/unsubscribe?token=unsubscribe-token');
    expect(body.html).toContain('수신거부');
  });

  it('dispatches pending email attempts through the Vercel Cron GET path', async () => {
    process.env.CRON_SECRET = 'cron-secret';
    process.env.SUPABASE_URL = 'https://supabase.example.com';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    const { updates } = installSupabaseMock({ templateClass: 'transactional' });
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    sendMailMock.mockResolvedValue({ messageId: 'cron-message-1' });

    const response = await GET(
      request('GET', { Authorization: 'Bearer cron-secret' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      processed: 1,
      sent: 1,
      failed: 0
    });
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(updates).toContainEqual(
      expect.objectContaining({
        status: 'sent',
        provider_message_id: 'cron-message-1'
      })
    );
  });

  it('accepts the legacy server-only Supabase secret alias for local worker verification', async () => {
    process.env.NOTIFICATION_WORKER_SECRET = 'worker-secret';
    process.env.VITE_SUPABASE_URL = 'https://supabase.example.com';
    process.env.SUPABASE_SECRET_KEY = 'service-role-secret';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    installSupabaseMock({ templateClass: 'transactional' });
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    sendMailMock.mockResolvedValue({ messageId: 'alias-message-1' });

    const response = await POST(
      request('POST', { 'x-worker-secret': 'worker-secret' })
    );

    expect(response.status).toBe(200);
    expect(createClientMock).toHaveBeenCalledWith(
      'https://supabase.example.com',
      'service-role-secret',
      { auth: { persistSession: false } }
    );
  });

  it('marks attempts sent only after SMTP resolves', async () => {
    process.env.NOTIFICATION_WORKER_SECRET = 'worker-secret';
    process.env.SUPABASE_URL = 'https://supabase.example.com';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    const { updates } = installSupabaseMock({ templateClass: 'transactional' });
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    sendMailMock.mockResolvedValue({ messageId: 'smtp-message-1' });

    await POST(request('POST', { 'x-worker-secret': 'worker-secret' }));

    expect(updates).toContainEqual(
      expect.objectContaining({
        status: 'sent',
        provider_message_id: 'smtp-message-1',
        error_code: null,
        error_message: null
      })
    );
  });

  it('keeps a failed SMTP attempt pending and increments retry bookkeeping', async () => {
    process.env.NOTIFICATION_WORKER_SECRET = 'worker-secret';
    process.env.SUPABASE_URL = 'https://supabase.example.com';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'smtp-user';
    process.env.SMTP_PASS = 'smtp-pass';
    const { updates } = installSupabaseMock({ templateClass: 'transactional' });
    createTransportMock.mockReturnValue({ sendMail: sendMailMock });
    sendMailMock.mockRejectedValue(new Error('temporary SMTP failure'));

    const response = await POST(
      request('POST', { 'x-worker-secret': 'worker-secret' })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      processed: 1,
      sent: 0,
      failed: 1
    });
    expect(updates).toContainEqual(
      expect.objectContaining({
        status: 'pending',
        retry_count: 1,
        error_code: 'smtp_error',
        error_message: 'temporary SMTP failure',
        sent_at: null
      })
    );
    expect(updates).not.toContainEqual(
      expect.objectContaining({
        status: 'sent'
      })
    );
  });
});
