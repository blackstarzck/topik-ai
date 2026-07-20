#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadLocalEnv, runSql } from './migrate-core.mjs';

const EXPECTED_FUNCTIONS = [
  'get_admin_users(text,text,integer,integer,text)',
  'get_admin_user(uuid)',
  'admin_export_users(text,boolean,text,text,uuid[],text,text,date,date,text[],text[],text[],text[],text[],text[],text[])',
  'admin_list_audit_logs(text,text,text,timestamp with time zone,timestamp with time zone,integer,integer)',
  'private.admin_profile_phone(jsonb)',
];

const CONTRACT_SQL = `
with expected(signature) as (
  values
    ('get_admin_users(text,text,integer,integer,text)'),
    ('get_admin_user(uuid)'),
    ('admin_export_users(text,boolean,text,text,uuid[],text,text,date,date,text[],text[],text[],text[],text[],text[],text[])'),
    ('admin_list_audit_logs(text,text,text,timestamp with time zone,timestamp with time zone,integer,integer)'),
    ('private.admin_profile_phone(jsonb)')
), functions as (
  select
    expected.signature,
    proc.oid is not null as exists,
    coalesce(proc.prosecdef, false) as security_definer,
    case when proc.oid is null then null
      else has_function_privilege('anon', proc.oid::regprocedure, 'execute') end as anon_execute,
    case when proc.oid is null then null
      else has_function_privilege('authenticated', proc.oid::regprocedure, 'execute') end
      as authenticated_execute,
    case when proc.oid is null then null else pg_get_function_result(proc.oid) end as result,
    case when proc.oid is null then null else pg_get_functiondef(proc.oid) end as definition
  from expected
  left join pg_proc proc on proc.oid = to_regprocedure(expected.signature)
)
select jsonb_build_object(
  'functions', (select jsonb_agg(to_jsonb(functions) order by signature) from functions),
  'profile_columns', (
    select jsonb_agg(column_name order by column_name)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in ('phone', 'phone_country_code', 'phone_number')
  )
) as contract;
`;

function getArgValue(args, flag) {
  const inline = args.find((arg) => arg.startsWith(`${flag}=`));
  if (inline) return inline.slice(flag.length + 1);
  const index = args.indexOf(flag);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
  return value;
}

export function parseLocalRows(output) {
  const parsed = JSON.parse(output);
  const candidates = [
    parsed,
    parsed?.rows,
    parsed?.result,
    parsed?.data,
    parsed?.result?.data,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.every((row) => row && typeof row === 'object')) {
      return candidate;
    }
    if (candidate && typeof candidate === 'object' && 'contract' in candidate) {
      return [candidate];
    }
  }
  const topLevelKeys = parsed && typeof parsed === 'object'
    ? Object.keys(parsed).sort().join(',')
    : typeof parsed;
  throw new Error(
    `Supabase local query returned an unsupported JSON shape (keys=${topLevelKeys}).`
  );
}

function runLocalContractQuery(workdir) {
  const output = execFileSync(
    'supabase',
    ['db', 'query', '--local', '--output', 'json', CONTRACT_SQL, '--workdir', workdir],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }
  );
  return parseLocalRows(output);
}

function normalizedFunction(row) {
  return {
    signature: row.signature,
    securityDefiner: row.security_definer === true,
    anonExecute: row.anon_execute === true,
    authenticatedExecute: row.authenticated_execute === true,
    result: row.result ?? '',
    definition: row.definition ?? '',
  };
}

function hasDirectLegacyPhoneReference(definition) {
  return /\bp\.phone\b/i.test(definition) || /\bpr\.phone\b/i.test(definition);
}

export function analyzeUsersContract(contract, { requireNoLegacyPhone = false } = {}) {
  const functions = (contract?.functions ?? []).map(normalizedFunction);
  const bySignature = new Map(functions.map((row) => [row.signature, row]));
  const profileColumns = new Set(contract?.profile_columns ?? []);
  const issues = [];

  for (const signature of EXPECTED_FUNCTIONS) {
    const row = bySignature.get(signature);
    if (!row) {
      issues.push(`missing-function:${signature}`);
      continue;
    }
    if (signature.startsWith('private.')) {
      if (row.anonExecute || row.authenticatedExecute) {
        issues.push(`private-function-exposed:${signature}`);
      }
      continue;
    }
    if (!row.securityDefiner) issues.push(`security-definer-missing:${signature}`);
    if (row.anonExecute) issues.push(`anon-execute-enabled:${signature}`);
    if (!row.authenticatedExecute) issues.push(`authenticated-execute-missing:${signature}`);
  }

  const requiredResults = new Map([
    [EXPECTED_FUNCTIONS[0], ['user_id', 'phone_masked']],
    [EXPECTED_FUNCTIONS[1], ['user_id', 'phone', 'phone_masked']],
    [EXPECTED_FUNCTIONS[2], ['user_id', 'phone', 'phone_masked']],
    [EXPECTED_FUNCTIONS[3], ['target_type', 'target_id']],
  ]);
  for (const [signature, requiredColumns] of requiredResults) {
    const result = bySignature.get(signature)?.result ?? '';
    for (const column of requiredColumns) {
      if (!new RegExp(`\\b${column}\\b`, 'i').test(result)) {
        issues.push(`result-column-missing:${signature}:${column}`);
      }
    }
  }

  for (const signature of EXPECTED_FUNCTIONS.slice(0, 3)) {
    const definition = bySignature.get(signature)?.definition ?? '';
    if (hasDirectLegacyPhoneReference(definition)) {
      issues.push(`legacy-phone-reference:${signature}`);
    }
  }

  for (const column of ['phone_country_code', 'phone_number']) {
    if (!profileColumns.has(column)) issues.push(`profile-column-missing:${column}`);
  }
  if (requireNoLegacyPhone && profileColumns.has('phone')) {
    issues.push('legacy-profile-phone-present');
  }

  const fingerprintPayload = functions
    .sort((left, right) => left.signature.localeCompare(right.signature))
    .map((row) => ({
      ...row,
      definition: row.definition.replace(/\s+/g, ' ').trim(),
      result: row.result.replace(/\s+/g, ' ').trim(),
    }));
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(fingerprintPayload))
    .digest('hex');
  return {
    clean: issues.length === 0,
    fingerprint,
    issues,
    functionCount: functions.length,
    requiredProfileColumnsPresent: ['phone_country_code', 'phone_number']
      .every((column) => profileColumns.has(column)),
    legacyProfilePhonePresent: profileColumns.has('phone'),
  };
}

export async function verifyUsersContract({
  localWorkdir = null,
  expectedProjectRef = null,
  requireNoLegacyPhone = false,
  expectedFingerprint = null,
}) {
  let rows;
  let projectRef = 'local-shadow';
  if (localWorkdir) {
    rows = runLocalContractQuery(resolve(localWorkdir));
  } else {
    loadLocalEnv();
    projectRef = process.env.SUPABASE_PROJECT_REF ?? '';
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    if (!projectRef || !token) {
      throw new Error('SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN are required.');
    }
    if (!expectedProjectRef || expectedProjectRef !== projectRef) {
      throw new Error('Expected Supabase project ref does not match the verification target.');
    }
    rows = await runSql({ projectRef, token, sql: CONTRACT_SQL });
  }
  const result = analyzeUsersContract(rows[0]?.contract, { requireNoLegacyPhone });
  if (expectedFingerprint && result.fingerprint !== expectedFingerprint) {
    result.clean = false;
    result.issues.push('shadow-production-fingerprint-mismatch');
  }
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    projectRef,
    ...result,
  };
}

function writeReport(path, report) {
  if (!path) return;
  const absolutePath = resolve(path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = process.argv.slice(2);
  const localWorkdir = getArgValue(args, '--local-workdir');
  const expectedProjectRef = getArgValue(args, '--expected-project-ref');
  const expectedFingerprintFile = getArgValue(args, '--expected-fingerprint-file');
  const expectedFingerprint = expectedFingerprintFile
    ? JSON.parse(readFileSync(resolve(expectedFingerprintFile), 'utf8')).fingerprint
    : null;
  const report = await verifyUsersContract({
    localWorkdir,
    expectedProjectRef,
    requireNoLegacyPhone: args.includes('--require-no-legacy-phone'),
    expectedFingerprint,
  });
  writeReport(getArgValue(args, '--json-out'), report);
  console.log(
    `Users DB contract: functions=${report.functionCount} `
    + `fingerprint=${report.fingerprint} clean=${report.clean}`
  );
  for (const issue of report.issues) console.log(`[contract-issue] ${issue}`);
  if (!report.clean) throw new Error('Users DB contract verification failed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
