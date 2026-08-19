import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// shadow 재생이 쓰는 저수준 실행 헬퍼 — 분해로 run-shadow-contract.mjs 에서 이동(동작 동일).
// supabase CLI 호출과 docker exec psql 두 경로, 그리고 SQL 리터럴 escape 를 담는다.

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().slice(-8000);
    throw new Error(`${command} ${args.join(' ')} failed:\n${output}`);
  }
  return result.stdout ?? '';
}

export function supabase(args) {
  return run('supabase', args);
}

export function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function readSupabaseStatus(workdir) {
  const output = supabase(['status', '--output', 'json', '--workdir', workdir]);
  const status = JSON.parse(output);
  return {
    apiUrl: status.API_URL ?? status.api_url ?? status.api?.url,
    anonKey: status.ANON_KEY ?? status.anon_key ?? status.api?.anon_key,
    serviceRoleKey:
      status.SERVICE_ROLE_KEY ?? status.service_role_key ?? status.api?.service_role_key,
  };
}

export function runPsql(containerName, sql) {
  return run(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'psql',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--set',
      'ON_ERROR_STOP=1',
    ],
    { input: sql }
  );
}

export function queryPsql(containerName, sql) {
  return run(
    'docker',
    [
      'exec',
      '-i',
      containerName,
      'psql',
      '--username',
      'postgres',
      '--dbname',
      'postgres',
      '--set',
      'ON_ERROR_STOP=1',
      '--tuples-only',
      '--no-align',
    ],
    { input: sql }
  ).trim();
}
