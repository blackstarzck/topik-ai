import { createHash } from 'node:crypto';

export const AUTH_USER_COPY_COLUMN_ALLOWLIST = [
  'instance_id',
  'id',
  'aud',
  'role',
  'email',
  'encrypted_password',
  'email_confirmed_at',
  'invited_at',
  'last_sign_in_at',
  'raw_app_meta_data',
  'raw_user_meta_data',
  'is_super_admin',
  'created_at',
  'updated_at',
  'phone',
  'phone_confirmed_at',
  'confirmed_at',
  'banned_until',
  'is_sso_user',
  'deleted_at',
  'is_anonymous',
];

export const AUTH_USER_ONE_TIME_TOKEN_COLUMNS = [
  'confirmation_token',
  'recovery_token',
  'email_change_token_new',
  'email_change_token_current',
  'phone_change_token',
  'reauthentication_token',
];

const AUTH_TOKEN_CLEANUP_STAGE_KEY = 'auth.user-token-cleanup';

export function sanitizeAuthUserForProduction(user) {
  const appMetadata = user?.raw_app_meta_data;
  const safeAppMetadata = {};
  if (
    appMetadata
    && typeof appMetadata === 'object'
    && !Array.isArray(appMetadata)
  ) {
    if (typeof appMetadata.provider === 'string') {
      safeAppMetadata.provider = appMetadata.provider;
    }
    if (Array.isArray(appMetadata.providers)) {
      safeAppMetadata.providers = appMetadata.providers.filter(
        (provider) => typeof provider === 'string',
      );
    }
  }

  return {
    ...user,
    aud: 'authenticated',
    role: 'authenticated',
    raw_app_meta_data: safeAppMetadata,
    is_super_admin: false,
  };
}

function assertSupportedAuthTokenColumns(columns) {
  const allowed = new Set(AUTH_USER_ONE_TIME_TOKEN_COLUMNS);
  for (const column of columns) {
    if (!allowed.has(column)) {
      throw new Error(`unsupported auth token column: ${column}`);
    }
  }
}

export function buildCopiedAuthTokenCleanupPlan({
  overlaps,
  devUsers,
  prodUsers,
  columns = AUTH_USER_ONE_TIME_TOKEN_COLUMNS,
}) {
  assertSupportedAuthTokenColumns(columns);
  const devById = new Map(devUsers.map((user) => [user.id, user]));
  const prodById = new Map(prodUsers.map((user) => [user.id, user]));
  const records = [];
  const countsByColumn = {};

  for (const overlap of overlaps) {
    const devUser = devById.get(overlap.devUserId);
    const prodUser = prodById.get(overlap.prodUserId);
    if (!devUser || !prodUser) {
      throw new Error('auth token cleanup overlap references a missing user.');
    }
    const tokens = {};
    for (const column of columns) {
      const devToken = devUser[column];
      if (
        typeof devToken === 'string'
        && devToken.length > 0
        && prodUser[column] === devToken
      ) {
        tokens[column] = devToken;
        countsByColumn[column] = (countsByColumn[column] ?? 0) + 1;
      }
    }
    if (Object.keys(tokens).length > 0) {
      records.push({ user_id: overlap.prodUserId, tokens });
    }
  }

  return { columns: [...columns], records, countsByColumn };
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function indexUsersByEmail(users, label) {
  const byEmail = new Map();
  for (const user of users) {
    const email = normalizeEmail(user.email);
    if (!email) throw new Error(`${label} auth user is missing email.`);
    if (byEmail.has(email)) {
      throw new Error(`${label} auth users contain a duplicate normalized email.`);
    }
    byEmail.set(email, user);
  }
  return byEmail;
}

export function buildUserMergePlan({ devUsers, prodUsers }) {
  const devByEmail = indexUsersByEmail(devUsers, 'dev');
  const prodByEmail = indexUsersByEmail(prodUsers, 'prod');
  const overlaps = [];
  const inserts = [];

  for (const devUser of devUsers) {
    const prodUser = prodByEmail.get(normalizeEmail(devUser.email));
    if (prodUser) {
      overlaps.push({
        devUserId: devUser.id,
        prodUserId: prodUser.id,
      });
      continue;
    }
    inserts.push(devUser);
  }

  const prodOnly = prodUsers.filter(
    (prodUser) => !devByEmail.has(normalizeEmail(prodUser.email)),
  );

  return { overlaps, inserts, prodOnly };
}

export function replaceMappedStrings(value, mappings) {
  if (typeof value === 'string') {
    let replaced = value;
    const orderedMappings = [...mappings.entries()]
      .sort(([left], [right]) => right.length - left.length);
    for (const [source, target] of orderedMappings) {
      replaced = replaced.replaceAll(source, target);
    }
    return replaced;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => replaceMappedStrings(entry, mappings));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        replaceMappedStrings(entry, mappings),
      ]),
    );
  }
  return value;
}

export function selectCommonInsertableColumns({
  devColumns,
  prodColumns,
  allowedColumns = null,
}) {
  const prodByName = new Map(
    prodColumns.map((column) => [column.column_name, column]),
  );
  const allowed = allowedColumns ? new Set(allowedColumns) : null;
  return devColumns
    .filter((column) => (
      column.is_generated === 'NEVER'
      && prodByName.get(column.column_name)?.is_generated === 'NEVER'
      && (!allowed || allowed.has(column.column_name))
    ))
    .map((column) => column.column_name);
}

function primaryKeyValue(row, primaryKeyColumns) {
  const key = Object.fromEntries(
    primaryKeyColumns.map((column) => [column, row[column]]),
  );
  if (Object.values(key).some((value) => value === null || value === undefined)) {
    throw new Error('recovery row is missing a primary key value.');
  }
  return stableStringify(key);
}

export function filterExcludedPrimaryKeys({
  rows,
  primaryKeyColumns,
  excludedKeys = [],
}) {
  const excluded = new Set(
    excludedKeys.map((row) => primaryKeyValue(row, primaryKeyColumns)),
  );
  return rows.filter(
    (row) => !excluded.has(primaryKeyValue(row, primaryKeyColumns)),
  );
}

export function assertNoConflictingPrimaryKeys({
  label,
  sourceRows,
  targetRows,
  primaryKeyColumns,
}) {
  const targetByKey = new Map(
    targetRows.map((row) => [primaryKeyValue(row, primaryKeyColumns), row]),
  );
  for (const sourceRow of sourceRows) {
    const targetRow = targetByKey.get(primaryKeyValue(sourceRow, primaryKeyColumns));
    if (targetRow && stableStringify(targetRow) !== stableStringify(sourceRow)) {
      throw new Error(`${label} has a conflicting primary key in production.`);
    }
  }
}

function naturalKey(row, keyFields) {
  return keyFields.map((field) => JSON.stringify(row[field] ?? null)).join('\u0000');
}

export function buildNaturalKeyMap({
  label,
  sourceRows,
  targetRows,
  keyFields,
}) {
  const targetByKey = new Map();
  for (const row of targetRows) {
    const key = naturalKey(row, keyFields);
    if (targetByKey.has(key)) {
      throw new Error(`${label} has a duplicate target natural key.`);
    }
    targetByKey.set(key, row);
  }

  const result = new Map();
  for (const row of sourceRows) {
    const target = targetByKey.get(naturalKey(row, keyFields));
    if (!target) throw new Error(`${label} is missing target natural-key mapping.`);
    if (!row.id || !target.id) throw new Error(`${label} mapping is missing an id.`);
    result.set(row.id, target.id);
  }
  return result;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

export function createManifestHash(manifest) {
  return createHash('sha256').update(stableStringify(manifest)).digest('hex');
}

export function createAuthTokenCleanupManifestHash({
  sourceRef,
  targetRef,
  columns,
  records,
}) {
  assertSupportedAuthTokenColumns(columns);
  return createManifestHash({
    mode: 'auth-token-cleanup-only',
    sourceRef,
    targetRef,
    columns,
    records,
  });
}

export function selectRecoveryWorkflow({
  apply,
  validateTransaction,
  authTokenCleanupOnly,
}) {
  if (apply && validateTransaction) {
    throw new Error('choose either apply or validate-transaction, not both.');
  }
  if (authTokenCleanupOnly) {
    if (apply) return 'auth-token-cleanup-apply';
    if (validateTransaction) return 'auth-token-cleanup-validate';
    return 'auth-token-cleanup-dry-run';
  }
  if (apply) return 'full-recovery-apply';
  if (validateTransaction) return 'full-recovery-validate';
  return 'full-recovery-dry-run';
}

export function shouldCleanupAuthTokenStageAfterFailure(error) {
  return !error?.outcomeUnknown;
}

export function assertProductionApplyGuards({
  targetRef,
  expectedTargetRef,
  productionConfirm,
  suppliedManifestHash,
  actualManifestHash,
}) {
  if (!targetRef || expectedTargetRef !== targetRef) {
    throw new Error('expected target ref does not match the production target.');
  }
  if (productionConfirm !== targetRef) {
    throw new Error('production confirmation does not match the production target.');
  }
  if (!suppliedManifestHash || suppliedManifestHash !== actualManifestHash) {
    throw new Error('dry-run manifest hash does not match the current recovery plan.');
  }
}

export function assertStorageReplaySafe({ sourceSummary, targetSummary }) {
  if (targetSummary.objectCount === 0) return 'copy';

  const isExactReplay = (
    targetSummary.bucketCount === sourceSummary.bucketCount
    && targetSummary.missingBuckets === sourceSummary.missingBuckets
    && targetSummary.objectCount === sourceSummary.objectCount
    && targetSummary.totalBytes === sourceSummary.totalBytes
    && targetSummary.hash === sourceSummary.hash
  );
  if (isExactReplay) return 'already-synced';

  throw new Error(
    'production storage differs from dev; manual merge review is required.',
  );
}

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(`invalid SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function buildInsertFromStageSql({
  stageSchema,
  sourceKey,
  targetSchema,
  targetTable,
  columns,
  primaryKeyColumns,
  updateOnConflict,
  preserveOnConflictColumns = [],
}) {
  if (columns.length === 0) throw new Error('stage insert requires columns.');
  if (primaryKeyColumns.length === 0) throw new Error('stage insert requires a primary key.');

  const stage = quoteIdentifier(stageSchema);
  const schema = quoteIdentifier(targetSchema);
  const table = quoteIdentifier(targetTable);
  const columnSql = columns.map(quoteIdentifier).join(', ');
  const conflictSql = primaryKeyColumns.map(quoteIdentifier).join(', ');
  const preserved = new Set(preserveOnConflictColumns);
  const updateColumns = columns.filter((column) => (
    !primaryKeyColumns.includes(column) && !preserved.has(column)
  ));
  const conflictAction = updateOnConflict && updateColumns.length > 0
    ? `do update set ${updateColumns
      .map((column) => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`)
      .join(', ')}`
    : 'do nothing';

  return `
insert into ${schema}.${table} (${columnSql})
select ${columnSql}
from jsonb_populate_recordset(
  null::${schema}.${table},
  coalesce(
    (
      select jsonb_agg(row_data order by ordinal)
      from ${stage}.rows
      where table_key = ${sqlLiteral(sourceKey)}
    ),
    '[]'::jsonb
  )
)
on conflict (${conflictSql}) ${conflictAction};`.trim();
}

export function buildStageLoadSql({ stageSchema, records }) {
  const stage = quoteIdentifier(stageSchema);
  const encoded = Buffer.from(JSON.stringify(records), 'utf8').toString('base64');
  return `
insert into ${stage}.rows (table_key, ordinal, row_data)
select table_key, ordinal, row_data
from jsonb_to_recordset(
  convert_from(decode('${encoded}', 'base64'), 'UTF8')::jsonb
)
  as staged(table_key text, ordinal bigint, row_data jsonb);`.trim();
}

export function buildAuthTokenCleanupSql({
  stageSchema,
  columns = AUTH_USER_ONE_TIME_TOKEN_COLUMNS,
}) {
  assertSupportedAuthTokenColumns(columns);
  const stage = quoteIdentifier(stageSchema);
  return columns.map((column, index) => {
    const identifier = quoteIdentifier(column);
    return `
update auth.users as user_row
set ${identifier} = ''
from (
  select (row_data->>'user_id')::uuid as user_id,
         row_data->'tokens'->>${sqlLiteral(column)} as expected_token
  from ${stage}.rows
  where table_key = ${sqlLiteral(AUTH_TOKEN_CLEANUP_STAGE_KEY)}
) copied
where copied.expected_token is not null
  and user_row.id = copied.user_id
  and user_row.${identifier} = copied.expected_token;
do $recovery_auth_token_cleanup_${index}$
begin
  if exists (
    select 1
    from auth.users as user_row
    join ${stage}.rows staged
      on user_row.id = (staged.row_data->>'user_id')::uuid
    where staged.table_key = ${sqlLiteral(AUTH_TOKEN_CLEANUP_STAGE_KEY)}
      and staged.row_data->'tokens'->>${sqlLiteral(column)} is not null
      and user_row.${identifier} = staged.row_data->'tokens'->>${sqlLiteral(column)}
  ) then
    raise exception 'recovery_auth_token_cleanup_failed:${column}';
  end if;
end
$recovery_auth_token_cleanup_${index}$;`.trim();
  }).join('\n');
}

export function buildAuthTokenCleanupBackupSql({
  stageSchema,
  backupSchema,
  expectedUserCount,
  manifestHash,
  sourceRef,
  targetRef,
}) {
  if (!Number.isInteger(expectedUserCount) || expectedUserCount < 0) {
    throw new Error('expected auth token cleanup backup count must be a non-negative integer.');
  }
  const stage = quoteIdentifier(stageSchema);
  const backup = quoteIdentifier(backupSchema);
  return `
begin;
create schema ${backup};
revoke all on schema ${backup} from public;
create table ${backup}."auth__users" as
select user_row.*
from auth.users user_row
join ${stage}."rows" staged
  on user_row.id = (staged.row_data->>'user_id')::uuid
where staged.table_key = ${sqlLiteral(AUTH_TOKEN_CLEANUP_STAGE_KEY)};
revoke all on table ${backup}."auth__users"
  from public, anon, authenticated, service_role;
do $auth_token_cleanup_backup$
begin
  if (select count(*) from ${backup}."auth__users")
     <> ${expectedUserCount} then
    raise exception 'auth_token_cleanup_backup_count_mismatch';
  end if;
end
$auth_token_cleanup_backup$;
create table ${backup}."recovery_manifest" (
  manifest_hash text primary key,
  source_ref text not null,
  target_ref text not null,
  status text not null,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);
insert into ${backup}."recovery_manifest" (
  manifest_hash, source_ref, target_ref, status
) values (
  ${sqlLiteral(manifestHash)}, ${sqlLiteral(sourceRef)}, ${sqlLiteral(targetRef)},
  'backup_created'
);
revoke all on table ${backup}."recovery_manifest"
  from public, anon, authenticated, service_role;
commit;`.trim();
}

export function createStorageUploadState() {
  return { createdBuckets: [], uploaded: new Map() };
}

function isStorageWriteOutcomeUnknown(error) {
  return error?.name === 'StorageUnknownError'
    || error?.name === 'StorageVectorsUnknownError'
    || Number(error?.status) >= 500;
}

function storageWriteError(message, cause) {
  const error = new Error(message, { cause });
  if (isStorageWriteOutcomeUnknown(cause)) {
    error.outcomeUnknown = true;
    error.storageOutcomeUnknown = true;
  }
  return error;
}

function removeLastValue(values, value) {
  const index = values.lastIndexOf(value);
  if (index >= 0) values.splice(index, 1);
}

export async function uploadStorage(storagePlan, state = createStorageUploadState()) {
  if (storagePlan.replayMode === 'already-synced') return state;
  const targetById = new Map(
    storagePlan.target.map((bucket) => [bucket.bucketId, bucket]),
  );
  for (const sourceBucket of storagePlan.source) {
    if (sourceBucket.missing) continue;
    const targetBucket = targetById.get(sourceBucket.bucketId);
    if (!targetBucket || targetBucket.missing) {
      state.createdBuckets.push(sourceBucket.bucketId);
      const { error } = await storagePlan.targetClient.storage.createBucket(
        sourceBucket.bucketId,
        sourceBucket.options,
      );
      if (error) {
        if (!isStorageWriteOutcomeUnknown(error)) {
          removeLastValue(state.createdBuckets, sourceBucket.bucketId);
        }
        throw storageWriteError(
          `storage bucket creation failed for ${sourceBucket.bucketId}.`,
          error,
        );
      }
    }
    for (const object of sourceBucket.objects) {
      if (!state.uploaded.has(sourceBucket.bucketId)) {
        state.uploaded.set(sourceBucket.bucketId, []);
      }
      state.uploaded.get(sourceBucket.bucketId).push(object.path);
      const { error } = await storagePlan.targetClient.storage
        .from(sourceBucket.bucketId)
        .upload(object.path, object.bytes, {
          cacheControl: '3600',
          contentType: object.contentType,
          upsert: false,
        });
      if (error) {
        if (!isStorageWriteOutcomeUnknown(error)) {
          const candidates = state.uploaded.get(sourceBucket.bucketId) ?? [];
          removeLastValue(candidates, object.path);
          if (candidates.length === 0) state.uploaded.delete(sourceBucket.bucketId);
        }
        throw storageWriteError(
          `storage upload failed for bucket ${sourceBucket.bucketId}.`,
          error,
        );
      }
      const { data, error: verifyError } = await storagePlan.targetClient.storage
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
  return state;
}

export async function rollbackUploadedStorage(storagePlan, state) {
  const failures = [];
  for (const [bucketId, paths] of state.uploaded) {
    for (let index = 0; index < paths.length; index += 100) {
      const { error } = await storagePlan.targetClient.storage
        .from(bucketId)
        .remove(paths.slice(index, index + 100));
      if (error) failures.push(`remove:${bucketId}`);
    }
  }
  for (const bucketId of state.createdBuckets) {
    const { error } = await storagePlan.targetClient.storage.deleteBucket(bucketId);
    if (error) failures.push(`bucket:${bucketId}`);
  }
  if (failures.length > 0) {
    throw new Error(`storage rollback failed for ${failures.length} operation(s).`);
  }
}

export function shouldRollbackStorageAfterFailure(error) {
  return error?.outcomeUnknown !== true;
}

function sqlResponseError({ phase, responseText, status }) {
  let code = 'unknown';
  let marker = null;
  try {
    const payload = JSON.parse(responseText);
    code = payload?.code ?? code;
    marker = String(payload?.message ?? '').match(
      /recovery_[a-z0-9_.:-]+/i,
    )?.[0] ?? null;
  } catch {
    // Response bodies can contain SQL fragments or row values; never echo them.
  }
  const markerSuffix = marker ? `, marker ${marker}` : '';
  return new Error(`${phase} failed (HTTP ${status}, code ${code}${markerSuffix}).`);
}

export async function runSupabaseSql({
  fetchImpl = globalThis.fetch,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  maxAttempts = 4,
  projectRef,
  token,
  sql,
  phase,
  readOnly = false,
}) {
  const attempts = readOnly ? maxAttempts : 1;
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      });
    } catch (cause) {
      if (readOnly && attempt < attempts) {
        await sleep(attempt * 750);
        continue;
      }
      const error = new Error(`${phase} failed before a response was received.`, { cause });
      if (!readOnly) error.outcomeUnknown = true;
      throw error;
    }
    let responseText;
    try {
      responseText = await response.text();
    } catch (cause) {
      if (readOnly && attempt < attempts) {
        await sleep(attempt * 750);
        continue;
      }
      const error = new Error(`${phase} failed while reading the response.`, { cause });
      if (!readOnly) error.outcomeUnknown = true;
      throw error;
    }
    if (response.ok) {
      try {
        return JSON.parse(responseText);
      } catch {
        return responseText;
      }
    }
    const retryable = response.status === 429 || response.status >= 500;
    if (readOnly && retryable && attempt < attempts) {
      await sleep(attempt * 750);
      continue;
    }
    const error = sqlResponseError({
      phase,
      responseText,
      status: response.status,
    });
    if (!readOnly && response.status >= 500) error.outcomeUnknown = true;
    throw error;
  }
  throw new Error(`${phase} exhausted retries.`);
}
