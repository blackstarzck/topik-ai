import { createHash } from 'node:crypto';

import { createClient } from '@supabase/supabase-js';

import { replaceMappedStrings, runSupabaseSql } from './prod-data-recovery-core.mjs';
import { STORAGE_BUCKETS } from './prod-recovery-catalog.mjs';
import {
  bucketOptions,
  parseTextArray,
  quoteTable,
  tableKey,
  targetValuesSql
} from './prod-recovery-sql.mjs';

// 복구 도구의 읽기 I/O 계층 — 분해로 recover-prod-from-dev.mjs 에서 이동(동작 동일).
// Management API 키 조회·스토리지 클라이언트/목록/수집·행 및 스키마 메타데이터 조회.

export async function safeRunSql(options) {
  return runSupabaseSql(options);
}

export async function getApiKeys(projectRef, token) {
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

export async function getStorageClient(projectRef, token) {
  const key = await getApiKeys(projectRef, token);
  return createClient(`https://${projectRef}.supabase.co`, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export async function listStorageObjects(client, bucketId, prefix = '') {
  const objects = [];
  let offset = 0;
  for (;;) {
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

export async function collectStorage({
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

export async function mapLimit(items, limit, handler) {
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

export async function readTableRows({ projectRef, token, descriptor }) {
  const relation = quoteTable(descriptor.schema, descriptor.table);
  const where = descriptor.where ?? 'true';
  const rows = await safeRunSql({
    projectRef,
    token,
    phase: `read ${tableKey(descriptor)}`,
    readOnly: true,
    sql: `
select to_jsonb(source_row) as row_data
from ${relation} source_row
where ${where}
order by to_jsonb(source_row)::text`,
  });
  return rows.map((row) => row.row_data);
}

export async function readColumns({ projectRef, token, descriptors }) {
  const rows = await safeRunSql({
    projectRef,
    token,
    phase: 'read column metadata',
    readOnly: true,
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

export async function readPrimaryKeys({ projectRef, token, descriptors }) {
  const rows = await safeRunSql({
    projectRef,
    token,
    phase: 'read primary-key metadata',
    readOnly: true,
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

export async function readForeignKeys({ projectRef, token, descriptors }) {
  const rows = await safeRunSql({
    projectRef,
    token,
    phase: 'read foreign-key metadata',
    readOnly: true,
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
