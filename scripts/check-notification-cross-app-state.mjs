import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DEFAULT_PROJECT_REF = 'fglggyfvzjdsbyckinqa';
const REQUIRED_TABLES = [
  'notification_templates',
  'notification_groups',
  'notification_dispatches',
  'notification_delivery_attempts',
  'notification_email_config',
  'notification_settings',
  'user_notifications',
  'user_marketing_consent'
];
const ADMIN_TABLES = [
  'notification_templates',
  'notification_groups',
  'notification_dispatches',
  'notification_delivery_attempts',
  'notification_email_config'
];
const REQUIRED_FUNCTIONS = [
  ['render_notification_text', 'private.render_notification_text(text,text)', false],
  ['dispatch_scheduled_notifications', 'private.dispatch_scheduled_notifications(text,text)', true],
  ['dispatch_admin_notifications', 'private.dispatch_admin_notifications()', true],
  ['dispatch_notification_event', 'private.dispatch_notification_event(text,uuid,text,jsonb,text)', true],
  ['retry_failed_email_attempts', 'private.retry_failed_email_attempts()', true],
  ['notification_email_transport', 'private.notification_email_transport(text,text,text,uuid)', true],
  ['finalize_email_attempt', 'private.finalize_email_attempt(uuid,text,text,text)', true],
  ['is_marketing_consented', 'private.is_marketing_consented(uuid)', true],
  ['dispatch_notifications', 'private.dispatch_notifications()', true]
];
const ATTEMPT_STATUSES = ['pending', 'sent', 'failed', 'skipped', 'opted_out', 'deduped'];

export function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return new Map();
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  const entries = new Map();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    entries.set(match[1], match[2]);
  }
  return entries;
}

function envValue(name, envMap, env) {
  const value = env[name] ?? envMap.get(name);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function resolveConfig({ rootDir = process.cwd(), env = process.env } = {}) {
  const envMap = parseEnvFile(path.join(rootDir, '.env.local'));
  return {
    projectRef: envValue('SUPABASE_PROJECT_REF', envMap, env) ?? DEFAULT_PROJECT_REF,
    accessToken: envValue('SUPABASE_ACCESS_TOKEN', envMap, env)
  };
}

export function buildCrossAppStateSql() {
  const statusSelects = ATTEMPT_STATUSES.map(
    (status) => `count(*) filter (where status = '${status}')::int as ${status}_count`
  ).join(',\n    ');

  return `
with required_tables as (
  select unnest(array[${REQUIRED_TABLES.map((table) => `'${table}'`).join(', ')}]) as table_name
),
table_presence as (
  select
    required_tables.table_name,
    exists (
      select 1
      from information_schema.tables
      where table_schema = 'public'
        and table_name = required_tables.table_name
    ) as exists_now
  from required_tables
),
admin_table_contract as (
  select
    c.relname as table_name,
    pg_get_userbyid(c.relowner) as owner_name,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced,
    has_table_privilege('anon', c.oid, 'select') as anon_select,
    has_table_privilege('authenticated', c.oid, 'select') as authenticated_select,
    (
      has_table_privilege('authenticated', c.oid, 'insert')
      or has_table_privilege('authenticated', c.oid, 'update')
      or has_table_privilege('authenticated', c.oid, 'delete')
    ) as authenticated_write,
    has_table_privilege('service_role', c.oid, 'select') as service_role_select,
    (
      has_table_privilege('service_role', c.oid, 'insert')
      and has_table_privilege('service_role', c.oid, 'update')
      and has_table_privilege('service_role', c.oid, 'delete')
    ) as service_role_write
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[${ADMIN_TABLES.map((table) => `'${table}'`).join(', ')}])
),
required_functions(function_name, signature, expected_security_definer) as (
  values
    ${REQUIRED_FUNCTIONS.map(([name, signature, securityDefiner]) => `('${name}', '${signature}', ${securityDefiner})`).join(',\n    ')}
),
function_contract as (
  select
    rf.function_name,
    p.oid is not null as exists_now,
    pg_get_userbyid(p.proowner) as owner_name,
    p.prosecdef as security_definer,
    rf.expected_security_definer,
    coalesce(has_function_privilege('public', p.oid, 'execute'), false) as public_execute,
    coalesce(has_function_privilege('anon', p.oid, 'execute'), false) as anon_execute,
    coalesce(has_function_privilege('authenticated', p.oid, 'execute'), false) as authenticated_execute
  from required_functions rf
  left join pg_proc p on p.oid = to_regprocedure(rf.signature)
),
attempt_summary as (
  select
    count(*)::int as total_count,
    count(distinct user_id)::int as distinct_user_count,
    count(distinct dispatch_id)::int as distinct_dispatch_count,
    ${statusSelects}
  from public.notification_delivery_attempts
),
recent_attempts as (
  select
    id,
    dispatch_id,
    user_id,
    channel,
    template_key,
    status,
    sent_at is not null as has_sent_at,
    created_at
  from public.notification_delivery_attempts
  order by created_at desc
  limit 5
),
dispatch_summary as (
  select
    count(*)::int as total_count,
    count(*) filter (where status in ('running', 'scheduled', 'draft'))::int as open_count,
    count(*) filter (where status in ('completed', 'partial_failed', 'failed', 'canceled'))::int as terminal_count
  from public.notification_dispatches
)
select jsonb_build_object(
  'table_presence', coalesce((select jsonb_agg(to_jsonb(table_presence) order by table_name) from table_presence), '[]'::jsonb),
  'admin_table_contract', coalesce((select jsonb_agg(to_jsonb(admin_table_contract) order by table_name) from admin_table_contract), '[]'::jsonb),
  'function_contract', coalesce((select jsonb_agg(to_jsonb(function_contract) order by function_name) from function_contract), '[]'::jsonb),
  'attempt_summary', (select to_jsonb(attempt_summary) from attempt_summary),
  'dispatch_summary', (select to_jsonb(dispatch_summary) from dispatch_summary),
  'recent_attempts', coalesce((select jsonb_agg(to_jsonb(recent_attempts) order by created_at desc) from recent_attempts), '[]'::jsonb)
) as result;
`.trim();
}

function firstResult(payload) {
  if (Array.isArray(payload)) return payload[0]?.result ?? payload[0];
  if (Array.isArray(payload?.data)) return payload.data[0]?.result ?? payload.data[0];
  return payload?.result ?? payload;
}

export async function runSupabaseSql({ fetchImpl = fetch, projectRef, accessToken, sql }) {
  const response = await fetchImpl(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase Management API returned HTTP ${response.status}`);
  }
  return firstResult(JSON.parse(text));
}

export function evaluateCrossAppStateResult(result) {
  const failures = [];
  const tablePresence = Array.isArray(result?.table_presence) ? result.table_presence : [];
  for (const table of REQUIRED_TABLES) {
    const found = tablePresence.find((entry) => entry.table_name === table);
    if (!found?.exists_now) {
      failures.push(`Missing required table: ${table}`);
    }
  }

  const adminTableContract = Array.isArray(result?.admin_table_contract) ? result.admin_table_contract : [];
  for (const table of ADMIN_TABLES) {
    const contract = adminTableContract.find((entry) => entry.table_name === table);
    if (!contract) {
      failures.push(`Missing admin table contract: ${table}`);
      continue;
    }
    if (contract.owner_name !== 'postgres') failures.push(`Unexpected owner for ${table}.`);
    if (!contract.rls_enabled || !contract.rls_forced) failures.push(`RLS is not forced for ${table}.`);
    if (contract.anon_select) failures.push(`anon can select ${table}.`);
    const shouldAuthenticateRead = table !== 'notification_email_config';
    if (Boolean(contract.authenticated_select) !== shouldAuthenticateRead) {
      failures.push(`authenticated SELECT grant mismatch for ${table}.`);
    }
    if (contract.authenticated_write) failures.push(`authenticated can write ${table}.`);
    if (!contract.service_role_select || !contract.service_role_write) {
      failures.push(`service_role privileges are incomplete for ${table}.`);
    }
  }

  const functionContract = Array.isArray(result?.function_contract) ? result.function_contract : [];
  for (const [functionName, , expectedSecurityDefiner] of REQUIRED_FUNCTIONS) {
    const contract = functionContract.find((entry) => entry.function_name === functionName);
    if (!contract?.exists_now) {
      failures.push(`Missing notification pipeline function: ${functionName}`);
      continue;
    }
    if (contract.owner_name !== 'postgres') failures.push(`Unexpected owner for ${functionName}.`);
    if (Boolean(contract.security_definer) !== expectedSecurityDefiner) {
      failures.push(`SECURITY DEFINER mismatch for ${functionName}.`);
    }
    if (contract.public_execute || contract.anon_execute || contract.authenticated_execute) {
      failures.push(`Client EXECUTE privilege is exposed for ${functionName}.`);
    }
  }

  const recentAttempts = Array.isArray(result?.recent_attempts) ? result.recent_attempts : [];
  for (const attempt of recentAttempts) {
    if (attempt.status === 'sent' && !attempt.has_sent_at) {
      failures.push('A recent sent attempt is missing sent_at.');
    }
    if (attempt.status !== 'sent' && attempt.has_sent_at) {
      failures.push('A recent non-sent attempt has sent_at.');
    }
  }

  return { failures, result };
}

export function formatCrossAppStateReport(evaluation) {
  const { failures, result } = evaluation;
  const lines = [];
  if (failures.length > 0) {
    lines.push('[notification-cross-app-state] FAIL');
    lines.push(...failures.map((failure) => `- ${failure}`));
  } else {
    lines.push('[notification-cross-app-state] PASS');
  }

  const attempts = result?.attempt_summary ?? {};
  const dispatches = result?.dispatch_summary ?? {};
  lines.push(`- attempts total: ${attempts.total_count ?? 0}`);
  lines.push(`- attempts users: ${attempts.distinct_user_count ?? 0}`);
  lines.push(`- attempts dispatches: ${attempts.distinct_dispatch_count ?? 0}`);
  lines.push(`- attempts sent/pending/failed: ${attempts.sent_count ?? 0}/${attempts.pending_count ?? 0}/${attempts.failed_count ?? 0}`);
  lines.push(`- dispatches total/open/terminal: ${dispatches.total_count ?? 0}/${dispatches.open_count ?? 0}/${dispatches.terminal_count ?? 0}`);
  lines.push(`- admin table contracts: ${result?.admin_table_contract?.length ?? 0}/${ADMIN_TABLES.length}`);
  lines.push(`- pipeline function contracts: ${result?.function_contract?.length ?? 0}/${REQUIRED_FUNCTIONS.length}`);
  lines.push('- secret values: not printed');
  return lines.join('\n');
}

export async function runNotificationCrossAppStateCheck({
  rootDir = process.cwd(),
  env = process.env,
  fetchImpl = fetch
} = {}) {
  const config = resolveConfig({ rootDir, env });
  if (!config.accessToken) {
    throw new Error('SUPABASE_ACCESS_TOKEN is not configured in process env or .env.local.');
  }

  const result = await runSupabaseSql({
    fetchImpl,
    projectRef: config.projectRef,
    accessToken: config.accessToken,
    sql: buildCrossAppStateSql()
  });
  return evaluateCrossAppStateResult(result);
}

async function main() {
  const evaluation = await runNotificationCrossAppStateCheck();
  const report = formatCrossAppStateReport(evaluation);
  if (evaluation.failures.length > 0) {
    console.error(report);
    process.exit(1);
  }
  console.log(report);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
