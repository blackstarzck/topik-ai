import { describe, expect, it } from 'vitest';

import {
  endpointUrl,
  runNotificationWorkerSmoke
} from '../../scripts/check-notification-worker-smoke.mjs';

function createFetchSequence(statuses, calls) {
  return async (url, init) => {
    calls.push({ url, init });
    const status = statuses.shift();
    return {
      status,
      ok: status >= 200 && status < 300
    };
  };
}

describe('check-notification-worker-smoke', () => {
  it('normalizes the worker endpoint URL', () => {
    expect(endpointUrl('https://admin.example.com///')).toBe(
      'https://admin.example.com/api/notifications/dispatch-email'
    );
  });

  it('requires an HTTPS production URL and rejects local smoke targets', () => {
    expect(() => endpointUrl('http://admin.example.com')).toThrow('TOPIK_AI_PRODUCTION_URL must be an HTTPS production URL.');
    expect(() => endpointUrl('https://localhost:5173')).toThrow('TOPIK_AI_PRODUCTION_URL must not point to localhost.');
  });

  it('default mode only checks unauthenticated GET and does not dispatch', async () => {
    const calls = [];
    const output = await runNotificationWorkerSmoke({
      args: [],
      env: { TOPIK_AI_PRODUCTION_URL: 'https://admin.example.com' },
      fetchImpl: createFetchSequence([401], calls)
    });

    expect(calls).toEqual([
      {
        url: 'https://admin.example.com/api/notifications/dispatch-email',
        init: { method: 'GET', headers: {} }
      }
    ]);
    expect(output).toContain('Notification worker smoke check passed without dispatch.');
  });

  it('dispatch mode checks cron GET and manual POST with separate auth headers', async () => {
    const calls = [];
    const output = await runNotificationWorkerSmoke({
      args: ['--dispatch'],
      env: {
        TOPIK_AI_PRODUCTION_URL: 'https://admin.example.com',
        CRON_SECRET: 'cron-secret',
        NOTIFICATION_WORKER_SECRET: 'worker-secret'
      },
      fetchImpl: createFetchSequence([401, 200, 204], calls)
    });

    expect(calls).toEqual([
      {
        url: 'https://admin.example.com/api/notifications/dispatch-email',
        init: { method: 'GET', headers: {} }
      },
      {
        url: 'https://admin.example.com/api/notifications/dispatch-email',
        init: { method: 'GET', headers: { Authorization: 'Bearer cron-secret' } }
      },
      {
        url: 'https://admin.example.com/api/notifications/dispatch-email',
        init: { method: 'POST', headers: { 'x-worker-secret': 'worker-secret' } }
      }
    ]);
    expect(output).toContain('Notification worker dispatch smoke check passed.');
  });

  it('requires both dispatch secrets before authenticated checks', async () => {
    const calls = [];

    await expect(
      runNotificationWorkerSmoke({
        args: ['--dispatch'],
        env: { TOPIK_AI_PRODUCTION_URL: 'https://admin.example.com', CRON_SECRET: 'cron-secret' },
        fetchImpl: createFetchSequence([401], calls)
      })
    ).rejects.toThrow('CRON_SECRET and NOTIFICATION_WORKER_SECRET are required for --dispatch.');

    expect(calls).toHaveLength(1);
  });

  it('fails closed before dispatch when the unauthenticated protection check fails', async () => {
    const calls = [];

    await expect(
      runNotificationWorkerSmoke({
        args: ['--dispatch'],
        env: {
          TOPIK_AI_PRODUCTION_URL: 'https://admin.example.com',
          CRON_SECRET: 'cron-secret',
          NOTIFICATION_WORKER_SECRET: 'worker-secret'
        },
        fetchImpl: createFetchSequence([200, 200, 200], calls)
      })
    ).rejects.toThrow('unauthenticated GET expected 401, received 200');

    expect(calls).toEqual([
      {
        url: 'https://admin.example.com/api/notifications/dispatch-email',
        init: { method: 'GET', headers: {} }
      }
    ]);
  });

  it('does not print secret values when an authenticated smoke check fails', async () => {
    const calls = [];

    await expect(
      runNotificationWorkerSmoke({
        args: ['--dispatch'],
        env: {
          TOPIK_AI_PRODUCTION_URL: 'https://admin.example.com',
          CRON_SECRET: 'cron-secret-to-hide',
          NOTIFICATION_WORKER_SECRET: 'worker-secret-to-hide'
        },
        fetchImpl: createFetchSequence([401, 500, 200], calls)
      })
    ).rejects.toThrow('authenticated cron GET expected 2xx, received 500');

    await expect(
      runNotificationWorkerSmoke({
        args: ['--dispatch'],
        env: {
          TOPIK_AI_PRODUCTION_URL: 'https://admin.example.com',
          CRON_SECRET: 'cron-secret-to-hide',
          NOTIFICATION_WORKER_SECRET: 'worker-secret-to-hide'
        },
        fetchImpl: createFetchSequence([401, 500, 200], [])
      })
    ).rejects.not.toThrow('cron-secret-to-hide');
    await expect(
      runNotificationWorkerSmoke({
        args: ['--dispatch'],
        env: {
          TOPIK_AI_PRODUCTION_URL: 'https://admin.example.com',
          CRON_SECRET: 'cron-secret-to-hide',
          NOTIFICATION_WORKER_SECRET: 'worker-secret-to-hide'
        },
        fetchImpl: createFetchSequence([401, 500, 200], [])
      })
    ).rejects.not.toThrow('worker-secret-to-hide');
  });
});
