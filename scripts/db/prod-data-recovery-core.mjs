import { createHash } from 'node:crypto';

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
  indexUsersByEmail(devUsers, 'dev');
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

  return { overlaps, inserts };
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

export function selectCommonInsertableColumns({ devColumns, prodColumns }) {
  const prodByName = new Map(
    prodColumns.map((column) => [column.column_name, column]),
  );
  return devColumns
    .filter((column) => (
      column.is_generated === 'NEVER'
      && prodByName.get(column.column_name)?.is_generated === 'NEVER'
    ))
    .map((column) => column.column_name);
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
}) {
  if (columns.length === 0) throw new Error('stage insert requires columns.');
  if (primaryKeyColumns.length === 0) throw new Error('stage insert requires a primary key.');

  const stage = quoteIdentifier(stageSchema);
  const schema = quoteIdentifier(targetSchema);
  const table = quoteIdentifier(targetTable);
  const columnSql = columns.map(quoteIdentifier).join(', ');
  const conflictSql = primaryKeyColumns.map(quoteIdentifier).join(', ');
  const updateColumns = columns.filter((column) => !primaryKeyColumns.includes(column));
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
