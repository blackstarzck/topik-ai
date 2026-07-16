#!/usr/bin/env node

import { createHash } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import { loadLocalEnv } from './migrate-core.mjs';
import {
  assertStorageReplaySafe,
  assertProductionApplyGuards,
  buildInsertFromStageSql,
  buildNaturalKeyMap,
  buildUserMergePlan,
  createManifestHash,
  replaceMappedStrings,
  selectCommonInsertableColumns,
  stableStringify,
} from './prod-data-recovery-core.mjs';

const DEV_REF = 'fglggyfvzjdsbyckinqa';
const PROD_REF = 'eymlabowhfgtxbiqwxqh';
const STORAGE_BUCKETS = [
  'assets',
  'avatars',
  'generated-exports',
  'problem-assets',
];

const TABLES = [
  { schema: 'auth', table: 'users', special: 'auth-users' },
  { schema: 'auth', table: 'identities', special: 'auth-identities' },
  { schema: 'public', table: 'profiles', updateOnConflict: true },
  { schema: 'private', table: 'problem_identities', special: 'problem-identities' },
  { schema: 'public', table: 'topik_writing_51_questions' },
  { schema: 'public', table: 'topik_writing_52_questions' },
  { schema: 'public', table: 'topik_writing_53_questions' },
  { schema: 'public', table: 'topik_writing_54_questions' },
  { schema: 'public', table: 'topik_writing_question_import' },
  { schema: 'public', table: 'topik_writing_question_source_map' },
  { schema: 'public', table: 'topik_writing_problem_aliases' },
  { schema: 'public', table: 'topik_writing_question_institution_exposure' },
  { schema: 'public', table: 'problems' },
  { schema: 'public', table: 'problem_assets' },
  { schema: 'public', table: 'problem_attempts' },
  { schema: 'public', table: 'operation_policies', updateOnConflict: true },
  { schema: 'public', table: 'operation_policy_histories' },
  { schema: 'public', table: 'legal_documents', deletePlaceholders: true },
  { schema: 'public', table: 'institution_codes' },
  { schema: 'public', table: 'notification_groups' },
  { schema: 'public', table: 'learning_goals' },
  { schema: 'public', table: 'writing_drafts' },
  { schema: 'public', table: 'writing_submissions' },
  { schema: 'public', table: 'writing_feedback' },
  { schema: 'public', table: 'sentence_feedback' },
  { schema: 'public', table: 'feedback_dimension_scores' },
  { schema: 'public', table: 'writing_submission_metrics' },
  { schema: 'public', table: 'comparison_reports' },
  { schema: 'public', table: 'export_files' },
  { schema: 'public', table: 'library_items' },
  { schema: 'public', table: 'study_events' },
  { schema: 'public', table: 'user_consents' },
  { schema: 'public', table: 'user_marketing_consent' },
  { schema: 'public', table: 'notification_settings' },
  { schema: 'public', table: 'user_notifications' },
  { schema: 'public', table: 'notification_log' },
  { schema: 'public', table: 'recommendation_runs' },
  { schema: 'public', table: 'recommendation_items' },
  { schema: 'public', table: 'notification_dispatches' },
  { schema: 'public', table: 'notification_delivery_attempts' },
  { schema: 'public', table: 'pdf_export_quota_resets' },
  { schema: 'public', table: 'pdf_export_quota_reset_targets' },
  { schema: 'public', table: 'pdf_export_quota_usages' },
  { schema: 'public', table: 'institution_code_invitations' },
  { schema: 'public', table: 'user_admin_memos' },
  { schema: 'public', table: 'payment_history' },
  { schema: 'public', table: 'subscriptions' },
];

const BACKUP_ONLY_TABLES = [
  ['public', 'admin_accounts'],
  ['public', 'admin_audit_logs'],
  ['public', 'auth_email_templates'],
  ['public', 'notification_templates'],
  ['public', 'pdf_export_quota_policies'],
];

function tableKey({ schema, table }) {
  return `${schema}.${table}`;
}

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(`invalid SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function quoteTable(schema, table) {
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function hashValue(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

async function safeRunSql({ projectRef, token, sql, phase }) {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await response.text();
    if (response.ok) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      continue;
    }
    let code = 'unknown';
    let marker = null;
    try {
      const payload = JSON.parse(text);
      code = payload?.code ?? code;
      marker = String(payload?.message ?? '').match(
        /recovery_[a-z0-9_.:-]+/i,
      )?.[0] ?? null;
    } catch {
      // Response bodies can contain SQL fragments or row values; never echo them.
    }
    const markerSuffix = marker ? `, marker ${marker}` : '';
    throw new Error(
      `${phase} failed (HTTP ${response.status}, code ${code}${markerSuffix}).`,
    );
  }
  throw new Error(`${phase} exhausted retries.`);
}

async function getApiKeys(projectRef, token) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/api-keys`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new Error(`api-key lookup failed for ${projectRef} (HTTP ${response.status}).`);
  }
  const rows = await response.json();
  const serviceRole = rows.find(
    (row) => row.name === 'service_role' && row.type === 'legacy',
  );
  if (!serviceRole?.api_key) {
    throw new Error(`service-role key is unavailable for ${projectRef}.`);
  }
  return serviceRole.api_key;
}

async function getStorageClient(projectRef, token) {
  const key = await getApiKeys(projectRef, token);
  return createClient(`https://${projectRef}.supabase.co`, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

async function listStorageObjects(client, bucketId, prefix = '') {
  const objects = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.storage.from(bucketId).list(prefix, {
      limit: 1000,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`storage listing failed for bucket ${bucketId}.`);
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        objects.push({ ...entry, path });
      } else {
        objects.push(...await listStorageObjects(client, bucketId, path));
      }
    }
    if ((data?.length ?? 0) < 1000) break;
    offset += data.length;
  }
  return objects;
}

function bucketOptions(bucket) {
  return {
    public: Boolean(bucket.public),
    fileSizeLimit: bucket.file_size_limit ?? bucket.fileSizeLimit ?? null,
    allowedMimeTypes: bucket.allowed_mime_types ?? bucket.allowedMimeTypes ?? null,
  };
}

async function collectStorage({
  client,
  mappings = new Map(),
  includeBytes,
}) {
  const { data: buckets, error } = await client.storage.listBuckets();
  if (error) throw new Error('storage bucket listing failed.');
  const byId = new Map((buckets ?? []).map((bucket) => [bucket.id, bucket]));
  const result = [];
  for (const bucketId of STORAGE_BUCKETS) {
    const bucket = byId.get(bucketId);
    if (!bucket) {
      result.push({ bucketId, missing: true, options: null, objects: [] });
      continue;
    }
    const listed = await listStorageObjects(client, bucketId);
    const objects = [];
    for (const entry of listed) {
      let bytes = null;
      let digest = entry.metadata?.eTag ?? entry.metadata?.etag ?? null;
      let contentType = entry.metadata?.mimetype ?? null;
      if (includeBytes || !digest) {
        const { data, error: downloadError } = await client.storage
          .from(bucketId)
          .download(entry.path);
        if (downloadError || !data) {
          throw new Error(`storage download failed for bucket ${bucketId}.`);
        }
        bytes = Buffer.from(await data.arrayBuffer());
        digest = createHash('sha256').update(bytes).digest('hex');
        contentType = contentType ?? data.type ?? 'application/octet-stream';
      }
      objects.push({
        path: replaceMappedStrings(entry.path, mappings),
        sourcePath: entry.path,
        size: Number(entry.metadata?.size ?? bytes?.byteLength ?? 0),
        digest,
        contentType: contentType ?? 'application/octet-stream',
        bytes,
      });
    }
    objects.sort((left, right) => left.path.localeCompare(right.path));
    result.push({
      bucketId,
      missing: false,
      options: bucketOptions(bucket),
      objects,
    });
  }
  return result;
}

function storageSummary(storage) {
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

async function mapLimit(items, limit, handler) {
  const result = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      result[index] = await handler(items[index], index);
    }
  }
  await Promise.all(Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  ));
  return result;
}

async function readTableRows({ projectRef, token, descriptor }) {
  const relation = quoteTable(descriptor.schema, descriptor.table);
  const where = descriptor.where ?? 'true';
  const rows = await safeRunSql({
    projectRef,
    token,
    phase: `read ${tableKey(descriptor)}`,
    sql: `
select to_jsonb(source_row) as row_data
from ${relation} source_row
where ${where}
order by to_jsonb(source_row)::text`,
  });
  return rows.map((row) => row.row_data);
}

function targetValuesSql(descriptors) {
  return descriptors.map(
    ({ schema, table }) => `(${sqlLiteral(schema)}, ${sqlLiteral(table)})`,
  ).join(',\n');
}

async function readColumns({ projectRef, token, descriptors }) {
  const rows = await safeRunSql({
    projectRef,
    token,
    phase: 'read column metadata',
    sql: `
with targets(schema_name, table_name) as (
  values ${targetValuesSql(descriptors)}
)
select c.table_schema, c.table_name, c.column_name, c.udt_name,
       c.is_generated, c.is_identity, c.ordinal_position
from information_schema.columns c
join targets t
  on t.schema_name = c.table_schema and t.table_name = c.table_name
order by c.table_schema, c.table_name, c.ordinal_position`,
  });
  const byTable = new Map();
  for (const row of rows) {
    const key = `${row.table_schema}.${row.table_name}`;
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key).push(row);
  }
  return byTable;
}

async function readPrimaryKeys({ projectRef, token, descriptors }) {
  const rows = await safeRunSql({
    projectRef,
    token,
    phase: 'read primary-key metadata',
    sql: `
with targets(schema_name, table_name) as (
  values ${targetValuesSql(descriptors)}
)
select ns.nspname as table_schema, cls.relname as table_name,
       array_agg(att.attname order by key_column.ordinality) as columns
from pg_constraint constraint_row
join pg_class cls on cls.oid = constraint_row.conrelid
join pg_namespace ns on ns.oid = cls.relnamespace
join targets t on t.schema_name = ns.nspname and t.table_name = cls.relname
join lateral unnest(constraint_row.conkey) with ordinality key_column(attnum, ordinality)
  on true
join pg_attribute att
  on att.attrelid = cls.oid and att.attnum = key_column.attnum
where constraint_row.contype = 'p'
group by ns.nspname, cls.relname`,
  });
  return new Map(rows.map((row) => {
    const columns = parseTextArray(row.columns);
    return [`${row.table_schema}.${row.table_name}`, columns];
  }));
}

function parseTextArray(value) {
  return Array.isArray(value)
    ? value
    : String(value)
      .replace(/^\{|\}$/g, '')
      .split(',')
      .filter(Boolean);
}

async function readForeignKeys({ projectRef, token, descriptors }) {
  const rows = await safeRunSql({
    projectRef,
    token,
    phase: 'read foreign-key metadata',
    sql: `
with targets(schema_name, table_name) as (
  values ${targetValuesSql(descriptors)}
)
select
  child_ns.nspname as child_schema,
  child.relname as child_table,
  constraint_row.conname,
  array_agg(child_att.attname order by child_key.ordinality) as child_columns,
  parent_ns.nspname as parent_schema,
  parent.relname as parent_table,
  array_agg(parent_att.attname order by child_key.ordinality) as parent_columns,
  constraint_row.confmatchtype as match_type
from pg_constraint constraint_row
join pg_class child on child.oid = constraint_row.conrelid
join pg_namespace child_ns on child_ns.oid = child.relnamespace
join targets target
  on target.schema_name = child_ns.nspname and target.table_name = child.relname
join pg_class parent on parent.oid = constraint_row.confrelid
join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
join lateral unnest(constraint_row.conkey) with ordinality
  child_key(attnum, ordinality) on true
join lateral unnest(constraint_row.confkey) with ordinality
  parent_key(attnum, ordinality) on parent_key.ordinality = child_key.ordinality
join pg_attribute child_att
  on child_att.attrelid = child.oid and child_att.attnum = child_key.attnum
join pg_attribute parent_att
  on parent_att.attrelid = parent.oid and parent_att.attnum = parent_key.attnum
where constraint_row.contype = 'f'
group by
  child_ns.nspname,
  child.relname,
  constraint_row.conname,
  parent_ns.nspname,
  parent.relname,
  constraint_row.confmatchtype
order by child_ns.nspname, child.relname, constraint_row.conname`,
  });
  return rows.map((row) => ({
    ...row,
    child_columns: parseTextArray(row.child_columns),
    parent_columns: parseTextArray(row.parent_columns),
  }));
}

function pickColumns(row, columns) {
  return Object.fromEntries(columns.map((column) => [column, row[column] ?? null]));
}

function rowKey(row, columns) {
  return stableStringify(columns.map((column) => row[column] ?? null));
}

function expectedUnionCount({ sourceRows, targetRows, primaryKeyColumns }) {
  return new Set([
    ...sourceRows.map((row) => rowKey(row, primaryKeyColumns)),
    ...targetRows.map((row) => rowKey(row, primaryKeyColumns)),
  ]).size;
}

function partialProblemIdentityPlan(sourceRows, targetRows) {
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

function providerSetByUser(identityRows) {
  const result = new Map();
  for (const row of identityRows) {
    if (!result.has(row.user_id)) result.set(row.user_id, new Set());
    result.get(row.user_id).add(row.provider);
  }
  return result;
}

function assertMatchingOverlapProviders({ overlaps, devIdentities, prodIdentities }) {
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

function assertNoImportedIdentityCollision(sourceRows, targetRows) {
  const targetKeys = new Set(
    targetRows.map((row) => stableStringify([row.provider, row.provider_id])),
  );
  if (sourceRows.some(
    (row) => targetKeys.has(stableStringify([row.provider, row.provider_id])),
  )) {
    throw new Error('an imported auth identity collides with a production identity.');
  }
}

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
  const devEmails = new Set(devUsers.map((row) => row.email.trim().toLowerCase()));
  if (prodUsers.some((row) => !devEmails.has(row.email.trim().toLowerCase()))) {
    throw new Error('production contains an auth user that is absent from dev.');
  }
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
      sourceRows = userPlan.inserts;
    } else if (inventory.descriptor.special === 'auth-identities') {
      sourceRows = importedIdentities;
    } else if (inventory.descriptor.special === 'problem-identities') {
      sourceRows = problemPlan.inserts;
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
      usersToInsert: userPlan.inserts.length,
      existingProblemIdentitiesKept: problemPlan.mappings.size,
      problemIdentitiesToInsert: problemPlan.inserts.length,
      notificationTemplates: templateMap.size,
      pdfQuotaPolicies: policyMap.size,
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
    auth: {
      devUsers: devUsers.length,
      prodUsers: prodUsers.length,
      overlaps: userPlan.overlaps.length,
      inserts: userPlan.inserts.length,
      devIdentities: devIdentities.length,
      importedIdentities: importedIdentities.length,
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

function redactedReport(plan, mode) {
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
        0,
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

function backupTableName(schema, table) {
  return `${schema}__${table}`;
}

async function createBackup({ plan, backupSchema }) {
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

function chunkRecords(records, maxCharacters = 450_000) {
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

async function createAndLoadStage({ plan, stageSchema }) {
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
  const records = plan.plannedTables.flatMap((table) => (
    table.sourceRows.map((row, index) => ({
      table_key: table.key,
      ordinal: index + 1,
      row_data: row,
    }))
  ));
  const chunks = chunkRecords(records);
  for (let index = 0; index < chunks.length; index += 1) {
    const delimiter = `$recovery_${index}$`;
    const json = JSON.stringify(chunks[index]);
    await safeRunSql({
      projectRef: PROD_REF,
      token: plan.token,
      phase: `load recovery stage chunk ${index + 1}/${chunks.length}`,
      sql: `
insert into ${quoteTable(stageSchema, 'rows')} (table_key, ordinal, row_data)
select table_key, ordinal, row_data
from jsonb_to_recordset(${delimiter}${json}${delimiter}::jsonb)
  as staged(table_key text, ordinal bigint, row_data jsonb);`,
    });
  }
  const stageCounts = await safeRunSql({
    projectRef: PROD_REF,
    token: plan.token,
    phase: 'verify recovery stage',
    sql: `
select table_key, count(*)::integer as count
from ${quoteTable(stageSchema, 'rows')}
group by table_key
order by table_key`,
  });
  const actual = new Map(stageCounts.map((row) => [row.table_key, row.count]));
  for (const table of plan.plannedTables) {
    if ((actual.get(table.key) ?? 0) !== table.sourceRows.length) {
      throw new Error(`recovery stage count mismatch for ${table.key}.`);
    }
  }
}

async function cleanupStage({ token, stageSchema }) {
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

async function uploadStorage(plan) {
  const createdBuckets = [];
  const uploaded = new Map();
  if (plan.storage.replayMode === 'already-synced') {
    return { createdBuckets, uploaded };
  }
  const targetById = new Map(
    plan.storage.target.map((bucket) => [bucket.bucketId, bucket]),
  );
  for (const sourceBucket of plan.storage.source) {
    if (sourceBucket.missing) continue;
    const targetBucket = targetById.get(sourceBucket.bucketId);
    if (!targetBucket || targetBucket.missing) {
      const { error } = await plan.storage.targetClient.storage.createBucket(
        sourceBucket.bucketId,
        sourceBucket.options,
      );
      if (error) throw new Error(`storage bucket creation failed for ${sourceBucket.bucketId}.`);
      createdBuckets.push(sourceBucket.bucketId);
    }
    for (const object of sourceBucket.objects) {
      const { error } = await plan.storage.targetClient.storage
        .from(sourceBucket.bucketId)
        .upload(object.path, object.bytes, {
          cacheControl: '3600',
          contentType: object.contentType,
          upsert: false,
        });
      if (error) throw new Error(`storage upload failed for bucket ${sourceBucket.bucketId}.`);
      if (!uploaded.has(sourceBucket.bucketId)) uploaded.set(sourceBucket.bucketId, []);
      uploaded.get(sourceBucket.bucketId).push(object.path);
      const { data, error: verifyError } = await plan.storage.targetClient.storage
        .from(sourceBucket.bucketId)
        .download(object.path);
      if (verifyError || !data) {
        throw new Error(`storage verification download failed for ${sourceBucket.bucketId}.`);
      }
      const digest = createHash('sha256')
        .update(Buffer.from(await data.arrayBuffer()))
        .digest('hex');
      if (digest !== object.digest) {
        throw new Error(`storage checksum mismatch for bucket ${sourceBucket.bucketId}.`);
      }
    }
  }
  return { createdBuckets, uploaded };
}

async function rollbackUploadedStorage(plan, uploadState) {
  for (const [bucketId, paths] of uploadState.uploaded) {
    for (let index = 0; index < paths.length; index += 100) {
      await plan.storage.targetClient.storage
        .from(bucketId)
        .remove(paths.slice(index, index + 100));
    }
  }
  for (const bucketId of uploadState.createdBuckets) {
    await plan.storage.targetClient.storage.deleteBucket(bucketId);
  }
}

function countAssertionSql(table) {
  return `
if (select count(*) from ${quoteTable(
    table.descriptor.schema,
    table.descriptor.table,
  )}) <> ${table.expectedFinalCount} then
  raise exception 'recovery_count_mismatch:${table.key}';
end if;`;
}

function foreignKeyAssertionSql(foreignKey) {
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

async function applyDatabase({
  plan,
  stageSchema,
  backupSchema,
  rollbackOnly = false,
}) {
  const inserts = plan.plannedTables.map((table, index) => {
    const insertSql = buildInsertFromStageSql({
      stageSchema,
      sourceKey: table.key,
      targetSchema: table.descriptor.schema,
      targetTable: table.descriptor.table,
      columns: table.columns,
      primaryKeyColumns: table.primaryKeyColumns,
      updateOnConflict: Boolean(table.descriptor.updateOnConflict),
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
end
$recovery_verify$;
${completionSql}`,
  });
}

async function verifyDatabase(plan) {
  const countSelects = plan.plannedTables.map((table) => `
select ${sqlLiteral(table.key)} as table_key,
       count(*)::integer as count
from ${quoteTable(table.descriptor.schema, table.descriptor.table)}`);
  const rows = await safeRunSql({
    projectRef: PROD_REF,
    token: plan.token,
    phase: 'verify recovered table counts',
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
  ) as users_without_identity`,
  });
  if (
    checks.auth_users !== plan.auth.devUsers
    || checks.profiles !== plan.auth.devUsers
    || checks.placeholders !== 0
    || checks.users_without_identity !== 0
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

function argValue(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

async function main() {
  loadLocalEnv();
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const validateTransaction = args.includes('--validate-transaction');
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required.');

  const plan = await buildPlan(token);
  if (!apply && !validateTransaction) {
    console.log(JSON.stringify(redactedReport(plan, 'dry-run'), null, 2));
    return;
  }

  assertProductionApplyGuards({
    targetRef: PROD_REF,
    expectedTargetRef: process.env.SUPABASE_EXPECTED_PROJECT_REF,
    productionConfirm: process.env.SUPABASE_PRODUCTION_CONFIRM,
    suppliedManifestHash: argValue(args, '--manifest-hash'),
    actualManifestHash: plan.manifestHash,
  });

  const suffix = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const backupSchema = `recovery_backup_${suffix}`;
  const stageSchema = `recovery_stage_${suffix}`;
  if (validateTransaction) {
    try {
      await createAndLoadStage({ plan, stageSchema });
      await applyDatabase({
        plan,
        stageSchema,
        backupSchema: null,
        rollbackOnly: true,
      });
    } finally {
      await cleanupStage({ token, stageSchema });
    }
    console.log(JSON.stringify(
      redactedReport(plan, 'transaction-validated-and-rolled-back'),
      null,
      2,
    ));
    return;
  }

  let uploadState = null;
  try {
    await createBackup({ plan, backupSchema });
    await createAndLoadStage({ plan, stageSchema });
    uploadState = await uploadStorage(plan);
    await applyDatabase({ plan, stageSchema, backupSchema });
  } catch (error) {
    if (uploadState) {
      try {
        await rollbackUploadedStorage(plan, uploadState);
      } catch {
        console.error('Storage rollback needs manual review; no object paths were logged.');
      }
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
