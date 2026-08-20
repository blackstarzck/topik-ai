import { createHash } from 'node:crypto';

import { stableStringify } from './prod-data-recovery-core.mjs';
import { DEV_REF, PROD_REF } from './prod-recovery-catalog.mjs';

// 복구 도구의 순수 계층 — 분해로 recover-prod-from-dev.mjs 에서 이동(동작 동일).
// 식별자/리터럴 escape·해시·요약·SQL 텍스트 빌더·행 비교 판정·정합성 단정·
// 민감정보를 지운 리포트까지, I/O 없이 값만 다루는 것들을 모았다.

export function tableKey({ schema, table }) {
  return `${schema}.${table}`;
}

export function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(`invalid SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

export function quoteTable(schema, table) {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

export function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function hashValue(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function bucketOptions(bucket) {
  return {
    public: Boolean(bucket.public),
    fileSizeLimit: bucket.file_size_limit ?? bucket.fileSizeLimit ?? null,
    allowedMimeTypes: bucket.allowed_mime_types ?? bucket.allowedMimeTypes ?? null,
  };
}

export function storageSummary(storage) {
  const objects = storage.flatMap((bucket) => bucket.objects.map((object) => ({
    bucket: bucket.bucketId,
    pathHash: hashValue(object.path),
    size: object.size,
    digest: object.digest,
  })));
  return {
    bucketCount: storage.filter((bucket) => !bucket.missing).length,
    missingBuckets: storage.filter((bucket) => bucket.missing).length,
    objectCount: objects.length,
    totalBytes: objects.reduce((sum, object) => sum + object.size, 0),
    hash: hashValue(objects),
  };
}

export function targetValuesSql(descriptors) {
  return descriptors.map(
    ({ schema, table }) => `(${sqlLiteral(schema)}, ${sqlLiteral(table)})`,
  ).join(',\n');
}

export function parseTextArray(value) {
  return Array.isArray(value)
    ? value
    : String(value)
      .replace(/^\{|\}$/g, '')
      .split(',')
      .filter(Boolean);
}

export function pickColumns(row, columns) {
  return Object.fromEntries(columns.map((column) => [column, row[column] ?? null]));
}

export function rowKey(row, columns) {
  return stableStringify(columns.map((column) => row[column] ?? null));
}

export function expectedUnionCount({ sourceRows, targetRows, primaryKeyColumns }) {
  return new Set([
    ...sourceRows.map((row) => rowKey(row, primaryKeyColumns)),
    ...targetRows.map((row) => rowKey(row, primaryKeyColumns)),
  ]).size;
}

export function partialProblemIdentityPlan(sourceRows, targetRows) {
  const targetByKey = new Map(
    targetRows.map((row) => [
      stableStringify([row.domain, row.identity_key]),
      row,
    ]),
  );
  const mappings = new Map();
  const inserts = [];
  for (const row of sourceRows) {
    const target = targetByKey.get(stableStringify([row.domain, row.identity_key]));
    if (target) {
      mappings.set(row.problem_id, target.problem_id);
    } else {
      inserts.push(row);
    }
  }
  return { mappings, inserts };
}

export function providerSetByUser(identityRows) {
  const result = new Map();
  for (const row of identityRows) {
    if (!result.has(row.user_id)) result.set(row.user_id, new Set());
    result.get(row.user_id).add(row.provider);
  }
  return result;
}

export function assertMatchingOverlapProviders({ overlaps, devIdentities, prodIdentities }) {
  const dev = providerSetByUser(devIdentities);
  const prod = providerSetByUser(prodIdentities);
  for (const overlap of overlaps) {
    const devProviders = [...(dev.get(overlap.devUserId) ?? [])].sort();
    const prodProviders = [...(prod.get(overlap.prodUserId) ?? [])].sort();
    if (stableStringify(devProviders) !== stableStringify(prodProviders)) {
      throw new Error('an overlapping auth account has different provider memberships.');
    }
  }
}

export function assertNoImportedIdentityCollision(sourceRows, targetRows) {
  const targetKeys = new Set(
    targetRows.map((row) => stableStringify([row.provider, row.provider_id])),
  );
  if (sourceRows.some(
    (row) => targetKeys.has(stableStringify([row.provider, row.provider_id])),
  )) {
    throw new Error('an imported auth identity collides with a production identity.');
  }
}

export function redactedReport(plan, mode) {
  return {
    mode,
    source: { name: 'topik-dev', projectRef: DEV_REF },
    target: { name: 'topik-prod', projectRef: PROD_REF },
    auth: plan.auth,
    legal: plan.legal,
    data: {
      tableCount: plan.plannedTables.length,
      rowsToStage: plan.plannedTables.reduce(
        (sum, table) => sum + table.sourceRows.length,
        plan.authTokenCleanup.records.length,
      ),
      tables: plan.plannedTables.map((table) => ({
        table: table.key,
        sourceRowsToCopy: table.sourceRows.length,
        currentProdRows: table.prodRows.length,
        expectedFinalRows: table.expectedFinalCount,
      })),
    },
    storage: {
      source: storageSummary(plan.storage.source),
      target: storageSummary(plan.storage.target),
      replayMode: plan.storage.replayMode,
    },
    manifestHash: plan.manifestHash,
  };
}

export function redactedAuthTokenCleanupReport(plan, mode) {
  return {
    mode,
    source: { name: 'topik-dev', projectRef: DEV_REF },
    target: { name: 'topik-prod', projectRef: PROD_REF },
    auth: plan.auth,
    manifestHash: plan.manifestHash,
  };
}

export function backupTableName(schema, table) {
  return `${schema}__${table}`;
}

export function chunkRecords(records, maxCharacters = 450_000) {
  const chunks = [];
  let current = [];
  let currentSize = 2;
  for (const record of records) {
    const serialized = JSON.stringify(record);
    if (current.length > 0 && currentSize + serialized.length + 1 > maxCharacters) {
      chunks.push(current);
      current = [];
      currentSize = 2;
    }
    current.push(record);
    currentSize += serialized.length + 1;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function countAssertionSql(table) {
  return `
if (select count(*) from ${quoteTable(
    table.descriptor.schema,
    table.descriptor.table,
  )}) <> ${table.expectedFinalCount} then
  raise exception 'recovery_count_mismatch:${table.key}';
end if;`;
}

export function foreignKeyAssertionSql(foreignKey) {
  const childColumns = foreignKey.child_columns.map(quoteIdentifier);
  const parentColumns = foreignKey.parent_columns.map(quoteIdentifier);
  const activePredicate = foreignKey.match_type === 'f'
    ? childColumns.map((column) => `child_row.${column} is not null`).join(' or ')
    : childColumns.map((column) => `child_row.${column} is not null`).join(' and ');
  const joinPredicate = childColumns.map(
    (column, index) => (
      `parent_row.${parentColumns[index]} = child_row.${column}`
    ),
  ).join(' and ');
  return `
if exists (
  select 1
  from ${quoteTable(
    foreignKey.child_schema,
    foreignKey.child_table,
  )} child_row
  where (${activePredicate})
    and not exists (
      select 1
      from ${quoteTable(
    foreignKey.parent_schema,
    foreignKey.parent_table,
  )} parent_row
      where ${joinPredicate}
    )
) then
  raise exception 'recovery_fk_orphan:${foreignKey.child_schema}.${foreignKey.child_table}:${foreignKey.conname}';
end if;`;
}

export function argValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}
