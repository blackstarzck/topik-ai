import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 마이그레이션 도구의 최하위 계층 — 분해로 migrate-core.mjs 에서 이동(동작 동일).
// 운영 project ref 상수·.env.local 로더·식별자 검증·sha256·SQL 텍스트 유틸만 담는다
// (다른 마이그 모듈을 import 하지 않는 leaf).
// CLI 인자 파서(parseMigrationArgs)는 일부러 남겼다 — down/apply 순서 가드 계약
// 테스트가 러너 소스에서 `--allow-out-of-order-*` 플래그 배선을 직접 단정한다.

export const PRODUCTION_PROJECT_REF = 'eymlabowhfgtxbiqwxqh';
export const DEFAULT_SQL_MAX_ATTEMPTS = 4;
export const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/;
export const MIGRATION_NAME_PATTERN = /^\d{14}_[a-z0-9_]+\.sql$/;

export function fail(message) {
  throw new Error(message);
}

export function parseEnvFile(contents) {
  const values = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || match[1].startsWith('#')) continue;
    values.set(match[1], match[2].replace(/^["']|["']$/g, ''));
  }
  return values;
}

export function loadLocalEnv(filePath = resolve('.env.local')) {
  if (!existsSync(filePath)) return;
  const values = parseEnvFile(readFileSync(filePath, 'utf8'));
  for (const [name, value] of values) {
    if (process.env[name] === undefined) process.env[name] = value;
  }
}


export function requireIdentifier(value, label) {
  if (!IDENTIFIER_PATTERN.test(value)) fail(`Invalid ${label}: ${value}`);
  return value;
}

export function requireMigrationName(value) {
  if (!MIGRATION_NAME_PATTERN.test(value)) fail(`Invalid migration name: ${value}`);
  return value;
}

export function sha256(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

export function sqlLiteral(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function stripOuterTransaction(sql) {
  const lines = sql.replace(/^\uFEFF/, '').split(/\r?\n/);
  const transactionLines = lines
    .map((line, index) => ({ index, value: line.trim().toLowerCase() }))
    .filter(({ value }) => value === 'begin;' || value === 'commit;');

  if (transactionLines.length === 0) return lines.join('\n').trim();
  if (
    transactionLines.length !== 2
    || transactionLines[0].value !== 'begin;'
    || transactionLines[1].value !== 'commit;'
  ) {
    fail('Migration contains unsupported transaction control.');
  }

  lines.splice(transactionLines[1].index, 1);
  lines.splice(transactionLines[0].index, 1);
  return lines.join('\n').trim();
}
