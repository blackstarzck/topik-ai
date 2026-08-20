import {
  buildAuthTokenCleanupBackupSql,
  buildStageLoadSql
} from './prod-data-recovery-core.mjs';
import {
  BACKUP_ONLY_TABLES,
  DEV_REF,
  PROD_REF,
  STORAGE_BUCKETS
} from './prod-recovery-catalog.mjs';
import {
  backupTableName,
  chunkRecords,
  quoteIdentifier,
  quoteTable,
  sqlLiteral
} from './prod-recovery-sql.mjs';
import { safeRunSql } from './prod-recovery-readers.mjs';

// 백업·스테이지 수명주기 — 분해로 recover-prod-from-dev.mjs 에서 이동(동작 동일).
// 적용 전 백업 스키마 생성, auth 토큰 정리 백업, 스테이지 스키마 적재/정리.

export async function createBackup({ plan, backupSchema }) {
  const allTables = new Map(
    plan.plannedTables.map((table) => [
      table.key,
      [table.descriptor.schema, table.descriptor.table],
    ]),
  );
  for (const [schema, table] of BACKUP_ONLY_TABLES) {
    allTables.set(`${schema}.${table}`, [schema, table]);
  }
  const copySql = [...allTables.values()].map(([schema, table]) => {
    const backupName = backupTableName(schema, table);
    return `
create table ${quoteTable(backupSchema, backupName)}
  as table ${quoteTable(schema, table)};
revoke all on table ${quoteTable(backupSchema, backupName)}
  from public, anon, authenticated, service_role;`;
  }).join('\n');
  await safeRunSql({
    projectRef: PROD_REF,
    token: plan.token,
    phase: 'create production backup',
    sql: `
begin;
create schema ${quoteIdentifier(backupSchema)};
revoke all on schema ${quoteIdentifier(backupSchema)} from public;
${copySql}
create table ${quoteTable(backupSchema, 'storage__buckets')}
  as select * from storage.buckets
  where id = any (array[${STORAGE_BUCKETS.map(sqlLiteral).join(', ')}]);
create table ${quoteTable(backupSchema, 'storage__objects')}
  as select * from storage.objects
  where bucket_id = any (array[${STORAGE_BUCKETS.map(sqlLiteral).join(', ')}]);
revoke all on table ${quoteTable(backupSchema, 'storage__buckets')}
  from public, anon, authenticated, service_role;
revoke all on table ${quoteTable(backupSchema, 'storage__objects')}
  from public, anon, authenticated, service_role;
create table ${quoteTable(backupSchema, 'recovery_manifest')} (
  manifest_hash text primary key,
  source_ref text not null,
  target_ref text not null,
  status text not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
insert into ${quoteTable(backupSchema, 'recovery_manifest')} (
  manifest_hash, source_ref, target_ref, status
) values (
  ${sqlLiteral(plan.manifestHash)}, ${sqlLiteral(DEV_REF)}, ${sqlLiteral(PROD_REF)}, 'backup_created'
);
revoke all on table ${quoteTable(backupSchema, 'recovery_manifest')}
  from public, anon, authenticated, service_role;
commit;`,
  });
}

export async function createAuthTokenCleanupBackup({ plan, stageSchema, backupSchema }) {
  await safeRunSql({
    projectRef: PROD_REF,
    token: plan.token,
    phase: 'create auth token cleanup backup',
    sql: buildAuthTokenCleanupBackupSql({
      stageSchema,
      backupSchema,
      expectedUserCount: plan.authTokenCleanup.records.length,
      manifestHash: plan.manifestHash,
      sourceRef: DEV_REF,
      targetRef: PROD_REF,
    }),
  });
}


export async function createAndLoadStage({
  plan,
  stageSchema,
  authTokenCleanupOnly = false,
}) {
  await safeRunSql({
    projectRef: PROD_REF,
    token: plan.token,
    phase: 'create recovery stage',
    sql: `
create schema ${quoteIdentifier(stageSchema)};
revoke all on schema ${quoteIdentifier(stageSchema)} from public;
create table ${quoteTable(stageSchema, 'rows')} (
  table_key text not null,
  ordinal bigint not null,
  row_data jsonb not null,
  primary key (table_key, ordinal)
);
revoke all on table ${quoteTable(stageSchema, 'rows')}
  from public, anon, authenticated, service_role;`,
  });
  const records = authTokenCleanupOnly ? [] : plan.plannedTables.flatMap((table) => (
    table.sourceRows.map((row, index) => ({
      table_key: table.key,
      ordinal: index + 1,
      row_data: row,
    }))
  ));
  records.push(...plan.authTokenCleanup.records.map((row, index) => ({
    table_key: 'auth.user-token-cleanup',
    ordinal: index + 1,
    row_data: row,
  })));
  const chunks = chunkRecords(records);
  for (let index = 0; index < chunks.length; index += 1) {
    await safeRunSql({
      projectRef: PROD_REF,
      token: plan.token,
      phase: `load recovery stage chunk ${index + 1}/${chunks.length}`,
      sql: buildStageLoadSql({ stageSchema, records: chunks[index] }),
    });
  }
  const stageCounts = await safeRunSql({
    projectRef: PROD_REF,
    token: plan.token,
    phase: 'verify recovery stage',
    readOnly: true,
    sql: `
select table_key, count(*)::integer as count
from ${quoteTable(stageSchema, 'rows')}
group by table_key
order by table_key`,
  });
  const actual = new Map(stageCounts.map((row) => [row.table_key, row.count]));
  if (!authTokenCleanupOnly) {
    for (const table of plan.plannedTables) {
      if ((actual.get(table.key) ?? 0) !== table.sourceRows.length) {
        throw new Error(`recovery stage count mismatch for ${table.key}.`);
      }
    }
  }
  if (
    (actual.get('auth.user-token-cleanup') ?? 0)
    !== plan.authTokenCleanup.records.length
  ) {
    throw new Error('auth token cleanup stage count mismatch.');
  }
}

export async function cleanupStage({ token, stageSchema }) {
  try {
    await safeRunSql({
      projectRef: PROD_REF,
      token,
      phase: 'cleanup failed recovery stage',
      sql: `drop schema if exists ${quoteIdentifier(stageSchema)} cascade`,
    });
  } catch {
    // The stage is private and revoked. Report the schema name for manual cleanup.
  }
}

