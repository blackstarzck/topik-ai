#!/usr/bin/env node
// Bootstrap the configured admin credentials into an explicitly selected
// Supabase project. No email, UUID, password, or token is printed.

import { loadLocalEnv, runSql } from './migrate-core.mjs';

const PRODUCTION_PROJECT_REF = 'eymlabowhfgtxbiqwxqh';
const args = process.argv.slice(2);

loadLocalEnv();

function fail(message) {
  throw new Error(message);
}

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--')) {
    fail(`${flag} requires a value.`);
  }
  return args[index + 1];
}

const phase = getArgValue('--phase');
const apply = args.includes('--apply');
if (!['prepare', 'verify', 'finalize'].includes(phase)) {
  fail('--phase must be prepare, verify, or finalize.');
}
if ((phase === 'prepare' || phase === 'finalize') && !apply) {
  fail(`${phase} is a write phase and requires --apply.`);
}

const projectRef = process.env.SUPABASE_PROJECT_REF;
const expectedRef = process.env.SUPABASE_EXPECTED_PROJECT_REF;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const displayName = process.env.E2E_ADMIN_DISPLAY_NAME ?? 'E2E Admin';
const baseUrl = `https://${projectRef}.supabase.co`;

if (!projectRef || !accessToken || !email || !password) {
  fail(
    'SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN, '
    + 'E2E_ADMIN_EMAIL, and E2E_ADMIN_PASSWORD are required.'
  );
}
if ((phase === 'prepare' || phase === 'finalize') && expectedRef !== projectRef) {
  fail('Write phases require SUPABASE_EXPECTED_PROJECT_REF matching the target.');
}
if (
  (phase === 'prepare' || phase === 'finalize')
  && projectRef === PRODUCTION_PROJECT_REF
  && process.env.SUPABASE_PRODUCTION_CONFIRM !== projectRef
) {
  fail('Production writes require SUPABASE_PRODUCTION_CONFIRM.');
}

async function managementJson(path, options = {}) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) fail(`Supabase Management API failed: HTTP ${response.status}`);
  return body;
}

const apiKeys = await managementJson('/api-keys');
const serviceRoleKey = (
  apiKeys.find((key) => key.name === 'service_role')
)?.api_key;
const publishableKey = (
  apiKeys.find((key) => key.type === 'publishable')
  ?? apiKeys.find((key) => key.name === 'anon')
)?.api_key;
if (!serviceRoleKey || !publishableKey) fail('Required Supabase API keys are unavailable.');

async function setLegacyKeysEnabled(enabled) {
  await managementJson(`/api-keys/legacy?enabled=${enabled}`, { method: 'PUT' });
  const state = await managementJson('/api-keys/legacy');
  if (state?.enabled !== enabled) {
    fail(`Legacy API key state did not become ${enabled ? 'enabled' : 'disabled'}.`);
  }

  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const response = await fetch(`${baseUrl}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: serviceHeaders,
    });
    if (enabled && response.ok) return;
    if (!enabled && response.status === 401) {
      const body = await response.json().catch(() => null);
      if (body?.message === 'Legacy API keys are disabled') return;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 1000));
  }

  fail(`Legacy API key gateway did not become ${enabled ? 'enabled' : 'disabled'}.`);
}

const serviceHeaders = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  'Content-Type': 'application/json',
};

async function serviceRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...serviceHeaders, ...(options.headers ?? {}) },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) fail(`Supabase service request failed: HTTP ${response.status}`);
  return body;
}

async function findAuthUser() {
  const body = await serviceRequest('/auth/v1/admin/users?page=1&per_page=1000');
  const users = body?.users ?? body ?? [];
  return users.find((user) => user.email === email) ?? null;
}

async function ensureAuthUser() {
  const existing = await findAuthUser();
  if (existing) {
    console.log('auth user already exists');
    return existing;
  }
  const created = await serviceRequest('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    }),
  });
  console.log('auth user created');
  return created;
}

function sqlText(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function assertUuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    fail('Supabase Auth returned an invalid user id.');
  }
  return value;
}

async function managementSql(sql) {
  return runSql({ projectRef, token: accessToken, sql });
}

async function patchProfile(userId, appRole) {
  const safeUserId = assertUuid(userId);
  const rows = await managementSql(`
    begin;
    set local session_replication_role = replica;

    update public.profiles
       set app_role = ${sqlText(appRole)},
           status = 'active',
           display_name = ${sqlText(displayName)}
     where id = '${safeUserId}'::uuid;

    set local session_replication_role = origin;
    commit;

    select count(*)::int as matched
      from public.profiles
     where id = '${safeUserId}'::uuid
       and app_role = ${sqlText(appRole)}
       and status = 'active';
  `);
  if (rows?.[0]?.matched !== 1) {
    fail('Expected exactly one active profiles row after Auth user creation.');
  }
}

async function signIn() {
  const response = await fetch(`${baseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const authBody = await response.json();
  if (!response.ok || !authBody.access_token || !authBody.user?.id) return null;
  assertUuid(authBody.user.id);
  return authBody;
}

async function signInAndGetSelf() {
  const authBody = await signIn();
  if (!authBody) fail('Configured admin credentials cannot sign in.');

  const selfResponse = await fetch(`${baseUrl}/rest/v1/rpc/admin_get_self`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${authBody.access_token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const selfRows = await selfResponse.json();
  if (!selfResponse.ok) fail('admin_get_self failed for the configured account.');
  const self = Array.isArray(selfRows) ? selfRows[0] : selfRows;
  if (self?.role !== 'platform_admin' || self?.status !== 'active') {
    fail('Configured account is not an active platform_admin.');
  }
  return { self, userId: authBody.user.id };
}

async function ensureBootstrapAudit(userId) {
  const safeUserId = assertUuid(userId);
  const rows = await managementSql(`
    begin;
    set local session_replication_role = replica;

    update public.profiles
       set app_role = 'learner',
           status = 'active',
           display_name = ${sqlText(displayName)}
     where id = '${safeUserId}'::uuid;

    set local session_replication_role = origin;

    insert into public.admin_audit_logs (
      admin_user_id,
      action,
      target_table,
      target_id,
      diff,
      payload
    )
    select
      '${safeUserId}'::uuid,
      'admin_bootstrapped',
      'AdminAccount',
      '${safeUserId}',
      jsonb_build_object(
        'role', jsonb_build_object('from', 'learner', 'to', 'platform_admin'),
        'status', jsonb_build_object('from', 'active', 'to', 'active')
      ),
      jsonb_build_object(
        'reason', 'Production admin bootstrap approved by repository operator',
        'bootstrap_method', 'current-configured-account',
        'profile_role_after', 'learner'
      )
    where not exists (
      select 1
        from public.admin_audit_logs
       where admin_user_id = '${safeUserId}'::uuid
         and action = 'admin_bootstrapped'
    );

    commit;

    select
      (select count(*)::int
         from public.profiles
        where id = '${safeUserId}'::uuid
          and app_role = 'learner'
          and status = 'active') as profile_reset,
      (select count(*)::int
         from public.admin_audit_logs
        where admin_user_id = '${safeUserId}'::uuid
          and action = 'admin_bootstrapped') as audit_count;
  `);
  if (rows?.[0]?.profile_reset !== 1 || rows?.[0]?.audit_count !== 1) {
    fail('Profile reset or bootstrap audit verification failed.');
  }
}

async function withTemporaryLegacyKeys(callback) {
  let restoreLegacyDisabled = false;
  let callbackError = null;
  try {
    const legacyState = await managementJson('/api-keys/legacy');
    if (!legacyState?.enabled) {
      await setLegacyKeysEnabled(true);
      restoreLegacyDisabled = true;
      console.log('temporary legacy API key access enabled');
    }
    return await callback();
  } catch (error) {
    callbackError = error;
    throw error;
  } finally {
    if (restoreLegacyDisabled) {
      try {
        await setLegacyKeysEnabled(false);
        console.log('legacy API key access restored to disabled');
      } catch (restoreError) {
        if (callbackError) {
          throw new AggregateError(
            [callbackError, restoreError],
            'Auth user creation failed and legacy API key access could not be disabled.'
          );
        }
        throw restoreError;
      }
    }
  }
}

if (phase === 'prepare') {
  let authBody = await signIn();
  if (!authBody) {
    await withTemporaryLegacyKeys(ensureAuthUser);
    authBody = await signIn();
  }
  if (!authBody) fail('Configured admin credentials cannot sign in after Auth bootstrap.');
  await patchProfile(authBody.user.id, 'platform_admin');
  console.log('temporary profile admin role prepared');
} else if (phase === 'verify') {
  await signInAndGetSelf();
  console.log('configured admin login and admin_get_self verified');
} else {
  const { userId } = await signInAndGetSelf();
  await ensureBootstrapAudit(userId);
  await signInAndGetSelf();
  console.log('profile role reset, bootstrap audit saved, admin helper reverified');
}
