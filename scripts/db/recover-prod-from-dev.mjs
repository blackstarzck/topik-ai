#!/usr/bin/env node

import { loadLocalEnv } from './migrate-core.mjs';
import {
  AUTH_USER_ONE_TIME_TOKEN_COLUMNS,
  assertNoConflictingPrimaryKeys,
  assertStorageReplaySafe,
  assertProductionApplyGuards,
  buildInsertFromStageSql,
  buildAuthTokenCleanupSql,
  buildCopiedAuthTokenCleanupPlan,
  buildNaturalKeyMap,
  buildUserMergePlan,
  createStorageUploadState,
  createAuthTokenCleanupManifestHash,
  createManifestHash,
  filterExcludedPrimaryKeys,
  replaceMappedStrings,
  rollbackUploadedStorage,
  sanitizeAuthUserForProduction,
  selectCommonInsertableColumns,
  selectRecoveryWorkflow,
  shouldCleanupAuthTokenStageAfterFailure,
  shouldRollbackStorageAfterFailure,
  stableStringify,
  uploadStorage,
} from './prod-data-recovery-core.mjs';
import { DEV_REF, PROD_REF, TABLES } from './prod-recovery-catalog.mjs';
import {
  argValue,
  assertMatchingOverlapProviders,
  assertNoImportedIdentityCollision,
  countAssertionSql,
  expectedUnionCount,
  foreignKeyAssertionSql,
  hashValue,
  partialProblemIdentityPlan,
  pickColumns,
  quoteIdentifier,
  quoteTable,
  redactedAuthTokenCleanupReport,
  redactedReport,
  sqlLiteral,
  storageSummary,
  tableKey
} from './prod-recovery-sql.mjs';
import {
  collectStorage,
  getStorageClient,
  mapLimit,
  readColumns,
  readForeignKeys,
  readPrimaryKeys,
  readTableRows,
  safeRunSql
} from './prod-recovery-readers.mjs';
import {
  cleanupStage,
  createAndLoadStage,
  createAuthTokenCleanupBackup,
  createBackup
} from './prod-recovery-stage.mjs';

// dev → 운영 복구 실행기 — 계획 수립·적용·검증과 CLI 진입점만 남기고, 카탈로그와
// 순수 SQL/판정·읽기 I/O·백업/스테이지 계층은 prod-recovery-{catalog,sql,readers,stage}.mjs
// 로 분해했다(안전 가드 배선 계약은 tests/unit/prod-data-recovery-core.test.mjs 가
// 이 파일과 분해 모듈 전체를 대상으로 단정한다).
async function buildPlan(token) {
  const [devColumns, prodColumns, primaryKeys, foreignKeys] = await Promise.all([
    readColumns({ projectRef: DEV_REF, token, descriptors: TABLES }),
    readColumns({ projectRef: PROD_REF, token, descriptors: TABLES }),
    readPrimaryKeys({ projectRef: PROD_REF, token, descriptors: TABLES }),
    readForeignKeys({ projectRef: PROD_REF, token, descriptors: TABLES }),
  ]);

  const inventories = await mapLimit(TABLES, 4, async (descriptor) => {
    const [devRows, prodRows] = await Promise.all([
      readTableRows({ projectRef: DEV_REF, token, descriptor }),
      readTableRows({ projectRef: PROD_REF, token, descriptor }),
    ]);
    return { descriptor, devRows, prodRows };
  });
  const byKey = new Map(inventories.map((item) => [tableKey(item.descriptor), item]));

  const devUsers = byKey.get('auth.users').devRows;
  const prodUsers = byKey.get('auth.users').prodRows;
  const devIdentities = byKey.get('auth.identities').devRows;
  const prodIdentities = byKey.get('auth.identities').prodRows;
  const userPlan = buildUserMergePlan({ devUsers, prodUsers });
  const devAuthColumns = new Set(
    (devColumns.get('auth.users') ?? []).map((column) => column.column_name),
  );
  const prodAuthColumns = new Set(
    (prodColumns.get('auth.users') ?? []).map((column) => column.column_name),
  );
  const authTokenCleanup = buildCopiedAuthTokenCleanupPlan({
    overlaps: userPlan.overlaps,
    devUsers,
    prodUsers,
    columns: AUTH_USER_ONE_TIME_TOKEN_COLUMNS.filter(
      (column) => devAuthColumns.has(column) && prodAuthColumns.has(column),
    ),
  });
  assertMatchingOverlapProviders({
    overlaps: userPlan.overlaps,
    devIdentities,
    prodIdentities,
  });
  const importedUserIds = new Set(userPlan.inserts.map((row) => row.id));
  const importedIdentities = devIdentities.filter(
    (row) => importedUserIds.has(row.user_id),
  );
  assertNoImportedIdentityCollision(importedIdentities, prodIdentities);

  const problemInventory = byKey.get('private.problem_identities');
  const problemPlan = partialProblemIdentityPlan(
    problemInventory.devRows,
    problemInventory.prodRows,
  );

  const [devTemplates, prodTemplates, devPolicies, prodPolicies] = await Promise.all([
    readTableRows({
      projectRef: DEV_REF,
      token,
      descriptor: { schema: 'public', table: 'notification_templates' },
    }),
    readTableRows({
      projectRef: PROD_REF,
      token,
      descriptor: { schema: 'public', table: 'notification_templates' },
    }),
    readTableRows({
      projectRef: DEV_REF,
      token,
      descriptor: { schema: 'public', table: 'pdf_export_quota_policies' },
    }),
    readTableRows({
      projectRef: PROD_REF,
      token,
      descriptor: { schema: 'public', table: 'pdf_export_quota_policies' },
    }),
  ]);
  const templateMap = buildNaturalKeyMap({
    label: 'notification template',
    sourceRows: devTemplates,
    targetRows: prodTemplates,
    keyFields: ['template_key', 'channel'],
  });
  const policyMap = buildNaturalKeyMap({
    label: 'PDF quota policy',
    sourceRows: devPolicies,
    targetRows: prodPolicies,
    keyFields: ['subject_scope', 'resource_scope'],
  });

  const mappings = new Map([
    [DEV_REF, PROD_REF],
    ...userPlan.overlaps.map((row) => [row.devUserId, row.prodUserId]),
    ...problemPlan.mappings,
    ...templateMap,
    ...policyMap,
  ]);

  const plannedTables = [];
  for (const inventory of inventories) {
    const key = tableKey(inventory.descriptor);
    const sourceColumns = devColumns.get(key) ?? [];
    const targetColumns = prodColumns.get(key) ?? [];
    if (sourceColumns.length === 0 || targetColumns.length === 0) {
      throw new Error(`${key} is missing from one database.`);
    }
    const targetByName = new Map(
      targetColumns.map((column) => [column.column_name, column]),
    );
    for (const column of sourceColumns) {
      const target = targetByName.get(column.column_name);
      if (target && target.udt_name !== column.udt_name) {
        throw new Error(`${key}.${column.column_name} has an incompatible type.`);
      }
    }
    const columns = selectCommonInsertableColumns({
      devColumns: sourceColumns,
      prodColumns: targetColumns,
      allowedColumns: inventory.descriptor.allowedColumns ?? null,
    });
    const primaryKeyColumns = primaryKeys.get(key);
    if (!primaryKeyColumns?.length) {
      throw new Error(`${key} has no production primary key.`);
    }
    if (primaryKeyColumns.some((column) => !columns.includes(column))) {
      throw new Error(`${key} primary key is not insertable.`);
    }

    let sourceRows = inventory.devRows;
    if (inventory.descriptor.special === 'auth-users') {
      sourceRows = userPlan.inserts.map(sanitizeAuthUserForProduction);
    } else if (inventory.descriptor.special === 'auth-identities') {
      sourceRows = importedIdentities;
    } else if (inventory.descriptor.special === 'problem-identities') {
      sourceRows = problemPlan.inserts;
    }
    if (inventory.descriptor.excludePrimaryKeys?.length) {
      sourceRows = filterExcludedPrimaryKeys({
        rows: sourceRows,
        primaryKeyColumns,
        excludedKeys: inventory.descriptor.excludePrimaryKeys,
      });
    }
    sourceRows = sourceRows
      .map((row) => replaceMappedStrings(row, mappings))
      .map((row) => pickColumns(row, columns));
    let targetRowsForFinal = inventory.prodRows.map((row) => pickColumns(row, columns));
    if (inventory.descriptor.deletePlaceholders) {
      targetRowsForFinal = inventory.prodRows
        .filter((row) => !row.is_placeholder)
        .map((row) => pickColumns(row, columns));
    }
    if (!inventory.descriptor.updateOnConflict) {
      assertNoConflictingPrimaryKeys({
        label: key,
        sourceRows,
        targetRows: targetRowsForFinal,
        primaryKeyColumns,
      });
    }
    plannedTables.push({
      ...inventory,
      key,
      columns,
      primaryKeyColumns,
      sourceRows,
      expectedFinalCount: expectedUnionCount({
        sourceRows,
        targetRows: targetRowsForFinal,
        primaryKeyColumns,
      }),
    });
  }

  const [devStorageClient, prodStorageClient] = await Promise.all([
    getStorageClient(DEV_REF, token),
    getStorageClient(PROD_REF, token),
  ]);
  const [devStorage, prodStorage] = await Promise.all([
    collectStorage({
      client: devStorageClient,
      mappings,
      includeBytes: true,
    }),
    collectStorage({
      client: prodStorageClient,
      includeBytes: true,
    }),
  ]);
  const prodStorageSummary = storageSummary(prodStorage);
  const storageReplayMode = assertStorageReplaySafe({
    sourceSummary: storageSummary(devStorage),
    targetSummary: prodStorageSummary,
  });
  const devBucketById = new Map(devStorage.map((bucket) => [bucket.bucketId, bucket]));
  for (const targetBucket of prodStorage.filter((bucket) => !bucket.missing)) {
    const sourceBucket = devBucketById.get(targetBucket.bucketId);
    if (
      sourceBucket
      && stableStringify(sourceBucket.options) !== stableStringify(targetBucket.options)
    ) {
      throw new Error(`storage bucket settings differ for ${targetBucket.bucketId}.`);
    }
  }

  const manifestBody = {
    sourceRef: DEV_REF,
    targetRef: PROD_REF,
    authInventory: {
      devUsers: { count: devUsers.length, hash: hashValue(devUsers) },
      prodUsers: { count: prodUsers.length, hash: hashValue(prodUsers) },
      devIdentities: { count: devIdentities.length, hash: hashValue(devIdentities) },
      prodIdentities: { count: prodIdentities.length, hash: hashValue(prodIdentities) },
    },
    mappings: {
      existingProdUsersKept: userPlan.overlaps.length,
      prodOnlyUsersKept: userPlan.prodOnly.length,
      usersToInsert: userPlan.inserts.length,
      existingProblemIdentitiesKept: problemPlan.mappings.size,
      problemIdentitiesToInsert: problemPlan.inserts.length,
      notificationTemplates: templateMap.size,
      pdfQuotaPolicies: policyMap.size,
    },
    authTokenCleanup: {
      count: authTokenCleanup.records.length,
      hash: hashValue(authTokenCleanup.records),
    },
    tables: Object.fromEntries(plannedTables.map((table) => [
      table.key,
      {
        sourceCount: table.sourceRows.length,
        sourceHash: hashValue(table.sourceRows),
        targetCount: table.prodRows.length,
        targetHash: hashValue(table.prodRows),
        expectedFinalCount: table.expectedFinalCount,
      },
    ])),
    storage: {
      source: storageSummary(devStorage),
      target: prodStorageSummary,
    },
    mappingInputs: {
      devTemplates: { count: devTemplates.length, hash: hashValue(devTemplates) },
      prodTemplates: { count: prodTemplates.length, hash: hashValue(prodTemplates) },
      devPolicies: { count: devPolicies.length, hash: hashValue(devPolicies) },
      prodPolicies: { count: prodPolicies.length, hash: hashValue(prodPolicies) },
    },
  };
  const manifestHash = createManifestHash(manifestBody);
  const legalSource = byKey.get('public.legal_documents').devRows;
  const legalTarget = byKey.get('public.legal_documents').prodRows;

  return {
    token,
    manifestBody,
    manifestHash,
    plannedTables,
    foreignKeys,
    mappings,
    authTokenCleanup,
    auth: {
      devUsers: devUsers.length,
      prodUsers: prodUsers.length,
      overlaps: userPlan.overlaps.length,
      prodOnly: userPlan.prodOnly.length,
      inserts: userPlan.inserts.length,
      devIdentities: devIdentities.length,
      importedIdentities: importedIdentities.length,
      copiedOneTimeTokenUsers: authTokenCleanup.records.length,
      copiedOneTimeTokens: Object.values(authTokenCleanup.countsByColumn)
        .reduce((sum, count) => sum + count, 0),
      copiedOneTimeTokensByColumn: authTokenCleanup.countsByColumn,
    },
    legal: {
      sourceDocuments: legalSource.length,
      sourcePlaceholders: legalSource.filter((row) => row.is_placeholder).length,
      targetPlaceholders: legalTarget.filter((row) => row.is_placeholder).length,
    },
    storage: {
      source: devStorage,
      target: prodStorage,
      replayMode: storageReplayMode,
      sourceClient: devStorageClient,
      targetClient: prodStorageClient,
    },
  };
}

async function buildAuthTokenCleanupOnlyPlan(token) {
  const descriptor = TABLES.find((table) => table.special === 'auth-users');
  const [devColumns, prodColumns, devUsers, prodUsers] = await Promise.all([
    readColumns({ projectRef: DEV_REF, token, descriptors: [descriptor] }),
    readColumns({ projectRef: PROD_REF, token, descriptors: [descriptor] }),
    readTableRows({ projectRef: DEV_REF, token, descriptor }),
    readTableRows({ projectRef: PROD_REF, token, descriptor }),
  ]);
  const devAuthColumns = new Set(
    (devColumns.get('auth.users') ?? []).map((column) => column.column_name),
  );
  const prodAuthColumns = new Set(
    (prodColumns.get('auth.users') ?? []).map((column) => column.column_name),
  );
  const userPlan = buildUserMergePlan({ devUsers, prodUsers });
  const authTokenCleanup = buildCopiedAuthTokenCleanupPlan({
    overlaps: userPlan.overlaps,
    devUsers,
    prodUsers,
    columns: AUTH_USER_ONE_TIME_TOKEN_COLUMNS.filter(
      (column) => devAuthColumns.has(column) && prodAuthColumns.has(column),
    ),
  });
  const manifestHash = createAuthTokenCleanupManifestHash({
    sourceRef: DEV_REF,
    targetRef: PROD_REF,
    columns: authTokenCleanup.columns,
    records: authTokenCleanup.records,
  });

  return {
    token,
    manifestHash,
    authTokenCleanup,
    auth: {
      devUsers: devUsers.length,
      prodUsers: prodUsers.length,
      overlaps: userPlan.overlaps.length,
      copiedOneTimeTokenUsers: authTokenCleanup.records.length,
      copiedOneTimeTokens: Object.values(authTokenCleanup.countsByColumn)
        .reduce((sum, count) => sum + count, 0),
      copiedOneTimeTokensByColumn: authTokenCleanup.countsByColumn,
    },
  };
}

async function applyDatabase({
  plan,
  stageSchema,
  backupSchema,
  rollbackOnly = false,
}) {
  const authTokenCleanupSql = buildAuthTokenCleanupSql({
    stageSchema,
    columns: plan.authTokenCleanup.columns,
  });
  const inserts = plan.plannedTables.map((table, index) => {
    const insertSql = buildInsertFromStageSql({
      stageSchema,
      sourceKey: table.key,
      targetSchema: table.descriptor.schema,
      targetTable: table.descriptor.table,
      columns: table.columns,
      primaryKeyColumns: table.primaryKeyColumns,
      updateOnConflict: Boolean(table.descriptor.updateOnConflict),
      preserveOnConflictColumns: table.descriptor.preserveOnConflictColumns ?? [],
    });
    return `
do $recovery_insert_${index}$
begin
${insertSql}
exception when others then
  raise exception 'recovery_insert_failed:${table.key}:%', sqlstate;
end
$recovery_insert_${index}$;`;
  }).join('\n');
  const assertions = [
    ...plan.plannedTables.map(countAssertionSql),
    ...plan.foreignKeys.map(foreignKeyAssertionSql),
  ].join('\n');

  const completionSql = rollbackOnly
    ? 'rollback;'
    : `
update ${quoteTable(backupSchema, 'recovery_manifest')}
set status = 'applied', applied_at = now()
where manifest_hash = ${sqlLiteral(plan.manifestHash)};
drop schema ${quoteIdentifier(stageSchema)} cascade;
commit;`;

  await safeRunSql({
    projectRef: PROD_REF,
    token: plan.token,
    phase: 'apply production recovery transaction',
    sql: `
begin;
set local lock_timeout = '10s';
set local statement_timeout = '10min';
select pg_advisory_xact_lock(hashtextextended('topik-prod-data-recovery', 0));
set local session_replication_role = replica;
delete from public.legal_documents where is_placeholder;
${authTokenCleanupSql}
${inserts}
set local session_replication_role = origin;
do $recovery_verify$
begin
${assertions}
if exists (
  select 1
  from auth.users user_row
  where not exists (
    select 1 from auth.identities identity_row
    where identity_row.user_id = user_row.id
  )
) then
  raise exception 'recovery_auth_user_without_identity';
end if;
if exists (select 1 from public.legal_documents where is_placeholder) then
  raise exception 'recovery_legal_placeholder_remaining';
end if;
if exists (
  select 1
  from public.operation_policies policy_row
  where policy_row.current_version_id is not null
    and not exists (
      select 1
      from public.operation_policy_histories history_row
      where history_row.id = policy_row.current_version_id
        and history_row.policy_id = policy_row.id
    )
) then
  raise exception 'recovery_invalid_policy_history_link';
end if;
end
$recovery_verify$;
${completionSql}`,
  });
}

async function applyAuthTokenCleanup({
  plan,
  stageSchema,
  backupSchema,
  rollbackOnly = false,
}) {
  const authTokenCleanupSql = buildAuthTokenCleanupSql({
    stageSchema,
    columns: plan.authTokenCleanup.columns,
  });
  const completionSql = rollbackOnly
    ? 'rollback;'
    : `
update ${quoteTable(backupSchema, 'recovery_manifest')}
set status = 'applied', applied_at = now()
where manifest_hash = ${sqlLiteral(plan.manifestHash)};
drop schema ${quoteIdentifier(stageSchema)} cascade;
commit;`;

  await safeRunSql({
    projectRef: PROD_REF,
    token: plan.token,
    phase: 'apply auth token cleanup transaction',
    sql: `
begin;
set local lock_timeout = '10s';
set local statement_timeout = '2min';
select pg_advisory_xact_lock(hashtextextended('topik-prod-auth-token-cleanup', 0));
${authTokenCleanupSql}
${completionSql}`,
  });
}

async function verifyDatabase(plan) {
  const expectedAuthUsers = plan.plannedTables.find(
    (table) => table.key === 'auth.users',
  )?.expectedFinalCount;
  const expectedProfiles = plan.plannedTables.find(
    (table) => table.key === 'public.profiles',
  )?.expectedFinalCount;
  const countSelects = plan.plannedTables.map((table) => `
select ${sqlLiteral(table.key)} as table_key,
       count(*)::integer as count
from ${quoteTable(table.descriptor.schema, table.descriptor.table)}`);
  const rows = await safeRunSql({
    projectRef: PROD_REF,
    token: plan.token,
    phase: 'verify recovered table counts',
    readOnly: true,
    sql: countSelects.join('\nunion all\n'),
  });
  const counts = new Map(rows.map((row) => [row.table_key, row.count]));
  for (const table of plan.plannedTables) {
    if (counts.get(table.key) !== table.expectedFinalCount) {
      throw new Error(`post-apply count mismatch for ${table.key}.`);
    }
  }
  const [checks] = await safeRunSql({
    projectRef: PROD_REF,
    token: plan.token,
    phase: 'verify recovered invariants',
    readOnly: true,
    sql: `
select
  (select count(*)::integer from auth.users) as auth_users,
  (select count(*)::integer from public.profiles) as profiles,
  (select count(*)::integer from public.legal_documents where is_placeholder) as placeholders,
  (
    select count(*)::integer
    from auth.users user_row
    where not exists (
      select 1 from auth.identities identity_row
      where identity_row.user_id = user_row.id
   )
  ) as users_without_identity,
  (
    select count(*)::integer
    from public.operation_policies policy_row
    where policy_row.current_version_id is not null
      and not exists (
        select 1
        from public.operation_policy_histories history_row
        where history_row.id = policy_row.current_version_id
          and history_row.policy_id = policy_row.id
      )
  ) as invalid_policy_history_links`,
  });
  if (
    checks.auth_users !== expectedAuthUsers
    || checks.profiles !== expectedProfiles
    || checks.placeholders !== 0
    || checks.users_without_identity !== 0
    || checks.invalid_policy_history_links !== 0
  ) {
    throw new Error('post-apply auth/profile/legal invariant failed.');
  }
  return checks;
}

async function verifyStorage(plan) {
  const target = await collectStorage({
    client: plan.storage.targetClient,
    includeBytes: true,
  });
  const expected = plan.storage.source.flatMap((bucket) => bucket.objects.map((object) => ({
    bucketId: bucket.bucketId,
    path: object.path,
    digest: object.digest,
  })));
  const actual = new Map(target.flatMap((bucket) => bucket.objects.map((object) => [
    `${bucket.bucketId}\u0000${object.path}`,
    object.digest,
  ])));
  for (const object of expected) {
    if (actual.get(`${object.bucketId}\u0000${object.path}`) !== object.digest) {
      throw new Error(`post-apply storage verification failed for ${object.bucketId}.`);
    }
  }
  return storageSummary(target);
}

async function main() {
  loadLocalEnv();
  const args = process.argv.slice(2);
  const workflow = selectRecoveryWorkflow({
    apply: args.includes('--apply'),
    validateTransaction: args.includes('--validate-transaction'),
    authTokenCleanupOnly: args.includes('--auth-token-cleanup-only'),
  });
  const apply = workflow.endsWith('-apply');
  const validateTransaction = workflow.endsWith('-validate');
  const authTokenCleanupOnly = workflow.startsWith('auth-token-cleanup-');
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required.');

  const plan = authTokenCleanupOnly
    ? await buildAuthTokenCleanupOnlyPlan(token)
    : await buildPlan(token);
  if (!apply && !validateTransaction) {
    const report = authTokenCleanupOnly
      ? redactedAuthTokenCleanupReport(plan, 'auth-token-cleanup-dry-run')
      : redactedReport(plan, 'dry-run');
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (authTokenCleanupOnly && plan.authTokenCleanup.records.length === 0) {
    throw new Error('no copied auth tokens require cleanup.');
  }

  assertProductionApplyGuards({
    targetRef: PROD_REF,
    expectedTargetRef: process.env.SUPABASE_EXPECTED_PROJECT_REF,
    productionConfirm: process.env.SUPABASE_PRODUCTION_CONFIRM,
    suppliedManifestHash: argValue(args, '--manifest-hash'),
    actualManifestHash: plan.manifestHash,
  });

  const suffix = new Date().toISOString().replace(/\D/g, '').slice(0, 17);
  const backupSchema = authTokenCleanupOnly
    ? `auth_token_cleanup_backup_${suffix}`
    : `recovery_backup_${suffix}`;
  const stageSchema = authTokenCleanupOnly
    ? `auth_token_cleanup_stage_${suffix}`
    : `recovery_stage_${suffix}`;
  if (validateTransaction) {
    try {
      await createAndLoadStage({ plan, stageSchema, authTokenCleanupOnly });
      if (authTokenCleanupOnly) {
        await applyAuthTokenCleanup({
          plan,
          stageSchema,
          backupSchema: null,
          rollbackOnly: true,
        });
      } else {
        await applyDatabase({
          plan,
          stageSchema,
          backupSchema: null,
          rollbackOnly: true,
        });
      }
    } finally {
      await cleanupStage({ token, stageSchema });
    }
    const report = authTokenCleanupOnly
      ? redactedAuthTokenCleanupReport(
        plan,
        'auth-token-cleanup-validated-and-rolled-back',
      )
      : redactedReport(plan, 'transaction-validated-and-rolled-back');
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (authTokenCleanupOnly) {
    try {
      await createAndLoadStage({ plan, stageSchema, authTokenCleanupOnly: true });
      await createAuthTokenCleanupBackup({ plan, stageSchema, backupSchema });
      await applyAuthTokenCleanup({ plan, stageSchema, backupSchema });
    } catch (error) {
      if (!shouldCleanupAuthTokenStageAfterFailure(error)) {
        console.error(
          'Auth token cleanup outcome is unknown; private stage and backup were preserved.',
        );
      } else {
        await cleanupStage({ token, stageSchema });
      }
      throw error;
    }

    const verificationPlan = await buildAuthTokenCleanupOnlyPlan(token);
    if (verificationPlan.authTokenCleanup.records.length !== 0) {
      throw new Error('post-apply copied auth token cleanup verification failed.');
    }
    console.log(JSON.stringify({
      ...redactedAuthTokenCleanupReport(
        plan,
        'auth-token-cleanup-applied-and-verified',
      ),
      backupSchema,
      verification: {
        copiedOneTimeTokenUsersRemaining: 0,
        copiedOneTimeTokensRemaining: 0,
      },
    }, null, 2));
    return;
  }

  const uploadState = createStorageUploadState();
  try {
    await createBackup({ plan, backupSchema });
    await createAndLoadStage({ plan, stageSchema });
    await uploadStorage(plan.storage, uploadState);
    await applyDatabase({ plan, stageSchema, backupSchema });
  } catch (error) {
    if (shouldRollbackStorageAfterFailure(error)) {
      try {
        await rollbackUploadedStorage(plan.storage, uploadState);
      } catch {
        console.error('Storage rollback needs manual review; no object paths were logged.');
      }
    } else {
      console.error(
        error?.storageOutcomeUnknown
          ? 'Storage write outcome is unknown; automatic rollback was skipped for manual verification.'
          : 'Database write outcome is unknown; Storage was preserved for manual verification.',
      );
    }
    await cleanupStage({ token, stageSchema });
    throw error;
  }

  const [database, storage] = await Promise.all([
    verifyDatabase(plan),
    verifyStorage(plan),
  ]);
  console.log(JSON.stringify({
    ...redactedReport(plan, 'applied-and-verified'),
    backupSchema,
    verification: {
      database,
      storage,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
