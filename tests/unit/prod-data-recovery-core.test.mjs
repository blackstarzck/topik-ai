import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import * as recoveryCore from '../../scripts/db/prod-data-recovery-core.mjs';
import {
  assertStorageReplaySafe,
  assertProductionApplyGuards,
  buildInsertFromStageSql,
  buildNaturalKeyMap,
  buildUserMergePlan,
  createManifestHash,
  replaceMappedStrings,
  selectCommonInsertableColumns,
} from '../../scripts/db/prod-data-recovery-core.mjs';

describe('prod data recovery core', () => {
  it('keeps an existing prod auth id and maps the matching dev user to it', () => {
    const plan = buildUserMergePlan({
      devUsers: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          email: 'existing@example.com',
        },
        {
          id: '22222222-2222-4222-8222-222222222222',
          email: 'missing@example.com',
        },
      ],
      prodUsers: [
        {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          email: 'EXISTING@example.com',
        },
      ],
    });

    expect(plan.overlaps).toEqual([
      {
        devUserId: '11111111-1111-4111-8111-111111111111',
        prodUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    ]);
    expect(plan.inserts).toEqual([
      {
        id: '22222222-2222-4222-8222-222222222222',
        email: 'missing@example.com',
      },
    ]);
  });

  it('rejects duplicate or missing normalized auth emails before planning writes', () => {
    expect(() => buildUserMergePlan({
      devUsers: [
        { id: '11111111-1111-4111-8111-111111111111', email: 'same@example.com' },
        { id: '22222222-2222-4222-8222-222222222222', email: ' SAME@example.com ' },
      ],
      prodUsers: [],
    })).toThrow('duplicate normalized email');

    expect(() => buildUserMergePlan({
      devUsers: [{ id: '11111111-1111-4111-8111-111111111111', email: null }],
      prodUsers: [],
    })).toThrow('missing email');
  });

  it('replaces mapped ids and project refs inside nested values and paths', () => {
    const transformed = replaceMappedStrings({
      owner_id: '11111111-1111-4111-8111-111111111111',
      avatar_path: '11111111-1111-4111-8111-111111111111/avatar.png',
      endpoint: 'https://fglggyfvzjdsbyckinqa.supabase.co/storage/v1/object',
      payload: {
        members: ['11111111-1111-4111-8111-111111111111'],
      },
    }, new Map([
      ['11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      ['fglggyfvzjdsbyckinqa', 'eymlabowhfgtxbiqwxqh'],
    ]));

    expect(transformed).toEqual({
      owner_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      avatar_path: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/avatar.png',
      endpoint: 'https://eymlabowhfgtxbiqwxqh.supabase.co/storage/v1/object',
      payload: {
        members: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
      },
    });
  });

  it('uses only columns shared by both databases and excludes generated columns', () => {
    const selected = selectCommonInsertableColumns({
      devColumns: [
        { column_name: 'id', is_generated: 'NEVER' },
        { column_name: 'phone', is_generated: 'NEVER' },
        { column_name: 'phone_number', is_generated: 'NEVER' },
        { column_name: 'confirmed_at', is_generated: 'ALWAYS' },
      ],
      prodColumns: [
        { column_name: 'id', is_generated: 'NEVER' },
        { column_name: 'phone_number', is_generated: 'NEVER' },
        { column_name: 'confirmed_at', is_generated: 'ALWAYS' },
      ],
    });

    expect(selected).toEqual(['id', 'phone_number']);
  });

  it('copies auth users through an explicit allowlist and never copies one-time token columns', () => {
    const selected = selectCommonInsertableColumns({
      devColumns: [
        { column_name: 'id', is_generated: 'NEVER' },
        { column_name: 'email', is_generated: 'NEVER' },
        { column_name: 'encrypted_password', is_generated: 'NEVER' },
        { column_name: 'confirmation_token', is_generated: 'NEVER' },
        { column_name: 'recovery_token', is_generated: 'NEVER' },
        { column_name: 'future_security_token', is_generated: 'NEVER' },
      ],
      prodColumns: [
        { column_name: 'id', is_generated: 'NEVER' },
        { column_name: 'email', is_generated: 'NEVER' },
        { column_name: 'encrypted_password', is_generated: 'NEVER' },
        { column_name: 'confirmation_token', is_generated: 'NEVER' },
        { column_name: 'recovery_token', is_generated: 'NEVER' },
        { column_name: 'future_security_token', is_generated: 'NEVER' },
      ],
      allowedColumns: ['id', 'email', 'encrypted_password'],
    });

    expect(selected).toEqual(['id', 'email', 'encrypted_password']);
  });

  it('normalizes imported auth users to non-privileged production claims', () => {
    expect(typeof recoveryCore.sanitizeAuthUserForProduction).toBe('function');
    if (typeof recoveryCore.sanitizeAuthUserForProduction !== 'function') return;

    const source = {
      id: '11111111-1111-4111-8111-111111111111',
      aud: 'service_role',
      role: 'service_role',
      is_super_admin: true,
      raw_app_meta_data: {
        provider: 'google',
        providers: ['email', 'google'],
        role: 'platform_admin',
        permissions: ['*'],
      },
      raw_user_meta_data: { name: 'Learner' },
    };

    expect(recoveryCore.sanitizeAuthUserForProduction(source)).toEqual({
      ...source,
      aud: 'authenticated',
      role: 'authenticated',
      is_super_admin: false,
      raw_app_meta_data: {
        provider: 'google',
        providers: ['email', 'google'],
      },
    });
    expect(source.role).toBe('service_role');
    expect(source.raw_app_meta_data).toHaveProperty('permissions');
  });

  it('plans cleanup only for non-empty one-time tokens copied exactly from dev', () => {
    expect(typeof recoveryCore.buildCopiedAuthTokenCleanupPlan).toBe('function');
    if (typeof recoveryCore.buildCopiedAuthTokenCleanupPlan !== 'function') return;

    const plan = recoveryCore.buildCopiedAuthTokenCleanupPlan({
      overlaps: [{ devUserId: 'dev-user', prodUserId: 'prod-user' }],
      devUsers: [{
        id: 'dev-user',
        confirmation_token: 'copied-confirmation',
        recovery_token: 'old-dev-recovery',
        phone_change_token: '',
      }],
      prodUsers: [{
        id: 'prod-user',
        confirmation_token: 'copied-confirmation',
        recovery_token: 'new-prod-recovery',
        phone_change_token: '',
      }],
      columns: ['confirmation_token', 'recovery_token', 'phone_change_token'],
    });

    expect(plan.records).toEqual([{
      user_id: 'prod-user',
      tokens: { confirmation_token: 'copied-confirmation' },
    }]);
    expect(plan.countsByColumn).toEqual({ confirmation_token: 1 });
  });

  it('cleans staged copied tokens only when the current prod value still matches', () => {
    expect(typeof recoveryCore.buildAuthTokenCleanupSql).toBe('function');
    if (typeof recoveryCore.buildAuthTokenCleanupSql !== 'function') return;

    const sql = recoveryCore.buildAuthTokenCleanupSql({
      stageSchema: 'recovery_stage_20260717',
      columns: ['confirmation_token', 'recovery_token'],
    });

    expect(sql).toContain("table_key = 'auth.user-token-cleanup'");
    expect(sql).toContain('user_row."confirmation_token" = copied.expected_token');
    expect(sql).toContain('set "confirmation_token" = \'\'');
    expect(sql).toContain('recovery_auth_token_cleanup_failed:confirmation_token');
    expect(sql).not.toContain('copied-confirmation');
    expect(() => recoveryCore.buildAuthTokenCleanupSql({
      stageSchema: 'recovery_stage_20260717',
      columns: ['unsafe;drop schema public'],
    })).toThrow('unsupported auth token column');
  });

  it('keeps the token-only manifest stable across unrelated production activity', () => {
    expect(typeof recoveryCore.createAuthTokenCleanupManifestHash).toBe('function');
    if (typeof recoveryCore.createAuthTokenCleanupManifestHash !== 'function') return;
    const devUsers = [{
      id: 'dev-shared',
      email: 'shared@example.com',
      confirmation_token: 'copied-token',
    }];
    const hashFor = (prodUsers) => {
      const mergePlan = buildUserMergePlan({ devUsers, prodUsers });
      const cleanup = recoveryCore.buildCopiedAuthTokenCleanupPlan({
        overlaps: mergePlan.overlaps,
        devUsers,
        prodUsers,
        columns: ['confirmation_token'],
      });
      return recoveryCore.createAuthTokenCleanupManifestHash({
        sourceRef: 'dev-ref',
        targetRef: 'prod-ref',
        columns: cleanup.columns,
        records: cleanup.records,
      });
    };

    const first = hashFor([{
      id: 'prod-shared',
      email: 'shared@example.com',
      confirmation_token: 'copied-token',
      last_sign_in_at: '2026-07-16T00:00:00Z',
    }]);
    const second = hashFor([
      {
        id: 'prod-shared',
        email: 'shared@example.com',
        confirmation_token: 'copied-token',
        last_sign_in_at: '2026-07-17T00:00:00Z',
      },
      {
        id: 'new-prod-only-user',
        email: 'prod-only@example.com',
        confirmation_token: 'unrelated-prod-token',
      },
    ]);
    expect(first).toBe(second);
  });

  it('changes the token-only manifest when the cleanup target changes', () => {
    const devUsers = [{
      id: 'dev-shared',
      email: 'shared@example.com',
      confirmation_token: 'copied-token',
    }];
    const hashFor = (confirmationToken) => {
      const prodUsers = [{
        id: 'prod-shared',
        email: 'shared@example.com',
        confirmation_token: confirmationToken,
      }];
      const mergePlan = buildUserMergePlan({ devUsers, prodUsers });
      const cleanup = recoveryCore.buildCopiedAuthTokenCleanupPlan({
        overlaps: mergePlan.overlaps,
        devUsers,
        prodUsers,
        columns: ['confirmation_token'],
      });
      return recoveryCore.createAuthTokenCleanupManifestHash({
        sourceRef: 'dev-ref',
        targetRef: 'prod-ref',
        columns: cleanup.columns,
        records: cleanup.records,
      });
    };
    const first = hashFor('copied-token');
    const second = hashFor('new-prod-token');

    expect(first).not.toBe(second);
  });

  it('backs up only staged auth users and revokes access to the sensitive copy', () => {
    expect(typeof recoveryCore.buildAuthTokenCleanupBackupSql).toBe('function');
    if (typeof recoveryCore.buildAuthTokenCleanupBackupSql !== 'function') return;
    const sql = recoveryCore.buildAuthTokenCleanupBackupSql({
      stageSchema: 'auth_token_cleanup_stage_20260717',
      backupSchema: 'auth_token_cleanup_backup_20260717',
      expectedUserCount: 22,
      manifestHash: 'manifest-hash',
      sourceRef: 'dev-ref',
      targetRef: 'prod-ref',
    });

    expect(sql).toContain('join "auth_token_cleanup_stage_20260717"."rows" staged');
    expect(sql).toContain("where staged.table_key = 'auth.user-token-cleanup'");
    expect(sql).toContain('revoke all on schema "auth_token_cleanup_backup_20260717" from public');
    expect(sql).toContain('from public, anon, authenticated, service_role');
    expect(sql).toContain('<> 22');
    expect(sql).not.toContain('as table auth.users');
  });

  it('preserves private token cleanup evidence only for an unknown write outcome', () => {
    expect(typeof recoveryCore.shouldCleanupAuthTokenStageAfterFailure).toBe('function');
    if (typeof recoveryCore.shouldCleanupAuthTokenStageAfterFailure !== 'function') return;
    expect(recoveryCore.shouldCleanupAuthTokenStageAfterFailure(new Error('known failure')))
      .toBe(true);
    const unknown = new Error('response lost');
    unknown.outcomeUnknown = true;
    expect(recoveryCore.shouldCleanupAuthTokenStageAfterFailure(unknown)).toBe(false);
  });

  it('selects explicit dry-run, validation, and apply workflows', () => {
    const select = recoveryCore.selectRecoveryWorkflow;
    expect(select({ apply: false, validateTransaction: false, authTokenCleanupOnly: true }))
      .toBe('auth-token-cleanup-dry-run');
    expect(select({ apply: false, validateTransaction: true, authTokenCleanupOnly: true }))
      .toBe('auth-token-cleanup-validate');
    expect(select({ apply: true, validateTransaction: false, authTokenCleanupOnly: true }))
      .toBe('auth-token-cleanup-apply');
    expect(select({ apply: false, validateTransaction: true, authTokenCleanupOnly: false }))
      .toBe('full-recovery-validate');
    expect(() => select({
      apply: true,
      validateTransaction: true,
      authTokenCleanupOnly: true,
    })).toThrow('choose either apply or validate-transaction');
  });

  it('keeps prod-only users in the merge plan', () => {
    const plan = buildUserMergePlan({
      devUsers: [{ id: 'dev-user', email: 'shared@example.com' }],
      prodUsers: [
        { id: 'prod-shared', email: 'shared@example.com' },
        { id: 'prod-only', email: 'prod-only@example.com' },
      ],
    });

    expect(plan.prodOnly).toEqual([
      { id: 'prod-only', email: 'prod-only@example.com' },
    ]);
  });

  it('maps environment-specific ids by stable natural keys', () => {
    const idMap = buildNaturalKeyMap({
      label: 'notification template',
      sourceRows: [
        { id: 'dev-email', template_key: 'welcome', channel: 'email' },
        { id: 'dev-in-app', template_key: 'welcome', channel: 'in_app' },
      ],
      targetRows: [
        { id: 'prod-in-app', template_key: 'welcome', channel: 'in_app' },
        { id: 'prod-email', template_key: 'welcome', channel: 'email' },
      ],
      keyFields: ['template_key', 'channel'],
    });

    expect(Object.fromEntries(idMap)).toEqual({
      'dev-email': 'prod-email',
      'dev-in-app': 'prod-in-app',
    });
  });

  it('rejects a missing or ambiguous natural-key target mapping', () => {
    expect(() => buildNaturalKeyMap({
      label: 'quota policy',
      sourceRows: [{ id: 'dev-policy', subject_scope: 'user', resource_scope: 'all' }],
      targetRows: [],
      keyFields: ['subject_scope', 'resource_scope'],
    })).toThrow('missing target');

    expect(() => buildNaturalKeyMap({
      label: 'quota policy',
      sourceRows: [{ id: 'dev-policy', subject_scope: 'user', resource_scope: 'all' }],
      targetRows: [
        { id: 'prod-a', subject_scope: 'user', resource_scope: 'all' },
        { id: 'prod-b', subject_scope: 'user', resource_scope: 'all' },
      ],
      keyFields: ['subject_scope', 'resource_scope'],
    })).toThrow('duplicate target natural key');
  });

  it('creates a stable manifest hash without exposing sensitive row values', () => {
    const first = createManifestHash({
      source: { users: { count: 200, hash: 'source-hash' } },
      target: { users: { count: 3, hash: 'target-hash' } },
      mappings: { users: 3 },
    });
    const second = createManifestHash({
      mappings: { users: 3 },
      target: { users: { hash: 'target-hash', count: 3 } },
      source: { users: { hash: 'source-hash', count: 200 } },
    });

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(second);
    expect(first).not.toContain('source-hash');
  });

  it('requires all production apply confirmations and the exact dry-run hash', () => {
    const expectedRef = 'eymlabowhfgtxbiqwxqh';
    const manifestHash = 'a'.repeat(64);

    expect(() => assertProductionApplyGuards({
      targetRef: expectedRef,
      expectedTargetRef: expectedRef,
      productionConfirm: expectedRef,
      suppliedManifestHash: manifestHash,
      actualManifestHash: manifestHash,
    })).not.toThrow();

    expect(() => assertProductionApplyGuards({
      targetRef: expectedRef,
      expectedTargetRef: expectedRef,
      productionConfirm: expectedRef,
      suppliedManifestHash: 'b'.repeat(64),
      actualManifestHash: manifestHash,
    })).toThrow('manifest hash');
  });

  it('allows an empty storage target or an exact already-synced replay only', () => {
    const source = {
      bucketCount: 4,
      missingBuckets: 0,
      objectCount: 43,
      totalBytes: 1_999_432,
      hash: 'a'.repeat(64),
    };

    expect(assertStorageReplaySafe({
      sourceSummary: source,
      targetSummary: {
        bucketCount: 0,
        missingBuckets: 4,
        objectCount: 0,
        totalBytes: 0,
        hash: 'b'.repeat(64),
      },
    })).toBe('copy');

    expect(assertStorageReplaySafe({
      sourceSummary: source,
      targetSummary: { ...source },
    })).toBe('already-synced');

    expect(() => assertStorageReplaySafe({
      sourceSummary: source,
      targetSummary: {
        ...source,
        objectCount: 44,
        hash: 'c'.repeat(64),
      },
    })).toThrow('manual merge review');
  });

  it('builds a typed stage insert without embedding row values', () => {
    const sql = buildInsertFromStageSql({
      stageSchema: 'recovery_stage_20260717',
      sourceKey: 'public.profiles',
      targetSchema: 'public',
      targetTable: 'profiles',
      columns: ['id', 'display_name', 'app_role'],
      primaryKeyColumns: ['id'],
      updateOnConflict: true,
    });

    expect(sql).toContain('jsonb_populate_recordset(');
    expect(sql).toContain('null::"public"."profiles"');
    expect(sql).toContain('on conflict ("id") do update set');
    expect(sql).toContain('"display_name" = excluded."display_name"');
    expect(sql).not.toContain('example.com');
    expect(() => buildInsertFromStageSql({
      stageSchema: 'unsafe;drop schema public',
      sourceKey: 'public.profiles',
      targetSchema: 'public',
      targetTable: 'profiles',
      columns: ['id'],
      primaryKeyColumns: ['id'],
      updateOnConflict: false,
    })).toThrow('invalid SQL identifier');
  });

  it('preserves trusted prod profile fields during an overlap upsert', () => {
    const sql = buildInsertFromStageSql({
      stageSchema: 'recovery_stage_20260717',
      sourceKey: 'public.profiles',
      targetSchema: 'public',
      targetTable: 'profiles',
      columns: ['id', 'display_name', 'app_role', 'plan_label', 'status', 'deleted_at'],
      primaryKeyColumns: ['id'],
      updateOnConflict: true,
      preserveOnConflictColumns: ['app_role', 'plan_label', 'status', 'deleted_at'],
    });

    expect(sql).toContain('"display_name" = excluded."display_name"');
    expect(sql).not.toContain('"app_role" = excluded."app_role"');
    expect(sql).not.toContain('"plan_label" = excluded."plan_label"');
    expect(sql).not.toContain('"status" = excluded."status"');
    expect(sql).not.toContain('"deleted_at" = excluded."deleted_at"');
  });

  it('filters only explicitly identified development fixtures', () => {
    expect(typeof recoveryCore.filterExcludedPrimaryKeys).toBe('function');
    if (typeof recoveryCore.filterExcludedPrimaryKeys !== 'function') return;

    const rows = recoveryCore.filterExcludedPrimaryKeys({
      rows: [
        { code: 'EXPO2026-BOOTH-A', label: 'fixture' },
        { code: 'CAMPAIGN-01', label: 'real operation code' },
      ],
      primaryKeyColumns: ['code'],
      excludedKeys: [{ code: 'EXPO2026-BOOTH-A' }],
    });

    expect(rows).toEqual([{ code: 'CAMPAIGN-01', label: 'real operation code' }]);
  });

  it('rejects a reused primary key when the source and prod rows mean different things', () => {
    expect(typeof recoveryCore.assertNoConflictingPrimaryKeys).toBe('function');
    if (typeof recoveryCore.assertNoConflictingPrimaryKeys !== 'function') return;

    expect(() => recoveryCore.assertNoConflictingPrimaryKeys({
      label: 'operation_policy_histories',
      sourceRows: [{ id: 'PH-001', policy_id: 'POLICY-A', body: 'dev' }],
      targetRows: [{ id: 'PH-001', policy_id: 'POLICY-B', body: 'prod' }],
      primaryKeyColumns: ['id'],
    })).toThrow('conflicting primary key');
  });

  it('loads stage JSON through base64 so user content cannot terminate the SQL literal', () => {
    expect(typeof recoveryCore.buildStageLoadSql).toBe('function');
    if (typeof recoveryCore.buildStageLoadSql !== 'function') return;

    const records = [{
      table_key: 'public.writing_drafts',
      ordinal: 1,
      row_data: { content: "$recovery_0$'); drop schema public; --" },
    }];
    const sql = recoveryCore.buildStageLoadSql({
      stageSchema: 'recovery_stage_20260717',
      records,
    });
    const encoded = sql.match(/decode\('([A-Za-z0-9+/=]+)', 'base64'\)/)?.[1];

    expect(sql).not.toContain(records[0].row_data.content);
    expect(encoded).toBeTruthy();
    expect(JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'))).toEqual(records);
  });

  it('keeps partial upload state available and rolls it back after an upload failure', async () => {
    expect(typeof recoveryCore.createStorageUploadState).toBe('function');
    expect(typeof recoveryCore.uploadStorage).toBe('function');
    expect(typeof recoveryCore.rollbackUploadedStorage).toBe('function');
    if (
      typeof recoveryCore.createStorageUploadState !== 'function'
      || typeof recoveryCore.uploadStorage !== 'function'
      || typeof recoveryCore.rollbackUploadedStorage !== 'function'
    ) return;

    const removed = [];
    const deletedBuckets = [];
    let uploads = 0;
    const targetClient = {
      storage: {
        async createBucket() { return { error: null }; },
        from(bucketId) {
          return {
            async upload() {
              uploads += 1;
              if (uploads === 1) return { error: null };
              const error = new Error('upload response lost');
              error.name = 'StorageUnknownError';
              return { error };
            },
            async download() {
              return { data: { arrayBuffer: async () => Buffer.from('first') }, error: null };
            },
            async remove(paths) {
              removed.push({ bucketId, paths });
              return { error: null };
            },
          };
        },
        async deleteBucket(bucketId) {
          deletedBuckets.push(bucketId);
          return { error: null };
        },
      },
    };
    const storagePlan = {
      replayMode: 'copy',
      targetClient,
      target: [],
      source: [{
        bucketId: 'assets',
        missing: false,
        options: { public: false },
        objects: [
          {
            path: 'first.txt',
            bytes: Buffer.from('first'),
            contentType: 'text/plain',
            digest: 'a7937b64b8caa58f03721bb6bacf5c78cb235febe0e70b1b84cd99541461a08e',
          },
          {
            path: 'second.txt',
            bytes: Buffer.from('second'),
            contentType: 'text/plain',
            digest: 'unused',
          },
        ],
      }],
    };
    const uploadState = recoveryCore.createStorageUploadState();

    await expect(recoveryCore.uploadStorage(storagePlan, uploadState))
      .rejects.toMatchObject({ outcomeUnknown: true, storageOutcomeUnknown: true });
    expect(uploadState.createdBuckets).toEqual(['assets']);
    expect(uploadState.uploaded.get('assets')).toEqual(['first.txt', 'second.txt']);

    await recoveryCore.rollbackUploadedStorage(storagePlan, uploadState);
    expect(removed).toEqual([{
      bucketId: 'assets',
      paths: ['first.txt', 'second.txt'],
    }]);
    expect(deletedBuckets).toEqual(['assets']);
  });

  it('records a bucket rollback candidate before an ambiguous creation failure', async () => {
    expect(typeof recoveryCore.createStorageUploadState).toBe('function');
    expect(typeof recoveryCore.uploadStorage).toBe('function');
    if (
      typeof recoveryCore.createStorageUploadState !== 'function'
      || typeof recoveryCore.uploadStorage !== 'function'
    ) return;

    const storagePlan = {
      replayMode: 'copy',
      targetClient: {
        storage: {
          async createBucket() {
            const error = new Error('response lost');
            error.name = 'StorageUnknownError';
            return { error };
          },
        },
      },
      target: [],
      source: [{
        bucketId: 'assets',
        missing: false,
        options: { public: false },
        objects: [],
      }],
    };
    const uploadState = recoveryCore.createStorageUploadState();

    await expect(recoveryCore.uploadStorage(storagePlan, uploadState))
      .rejects.toMatchObject({ outcomeUnknown: true, storageOutcomeUnknown: true });
    expect(uploadState.createdBuckets).toEqual(['assets']);
  });

  it('drops rollback candidates for known storage conflicts owned by another writer', async () => {
    expect(typeof recoveryCore.createStorageUploadState).toBe('function');
    expect(typeof recoveryCore.uploadStorage).toBe('function');
    if (
      typeof recoveryCore.createStorageUploadState !== 'function'
      || typeof recoveryCore.uploadStorage !== 'function'
    ) return;

    const conflict = new Error('The resource already exists');
    conflict.name = 'StorageApiError';
    conflict.status = 409;
    const storagePlan = {
      replayMode: 'copy',
      targetClient: {
        storage: {
          from() {
            return {
              async upload() { return { error: conflict }; },
            };
          },
        },
      },
      target: [{ bucketId: 'assets', missing: false }],
      source: [{
        bucketId: 'assets',
        missing: false,
        options: { public: false },
        objects: [{
          path: 'shared.txt',
          bytes: Buffer.from('ours'),
          contentType: 'text/plain',
          digest: 'unused',
        }],
      }],
    };
    const uploadState = recoveryCore.createStorageUploadState();

    await expect(recoveryCore.uploadStorage(storagePlan, uploadState))
      .rejects.toThrow('storage upload failed');
    expect(uploadState.uploaded.get('assets') ?? []).toEqual([]);
  });

  it('reports rollback API errors instead of silently accepting incomplete cleanup', async () => {
    expect(typeof recoveryCore.rollbackUploadedStorage).toBe('function');
    if (typeof recoveryCore.rollbackUploadedStorage !== 'function') return;

    const storagePlan = {
      targetClient: {
        storage: {
          from() {
            return { async remove() { return { error: new Error('remove failed') }; } };
          },
          async deleteBucket() { return { error: new Error('delete failed') }; },
        },
      },
    };
    const uploadState = {
      uploaded: new Map([['assets', ['first.txt']]]),
      createdBuckets: ['assets'],
    };

    await expect(recoveryCore.rollbackUploadedStorage(storagePlan, uploadState))
      .rejects.toThrow('storage rollback failed');
  });

  it('retries read-only SQL but never retries a write with an ambiguous 5xx result', async () => {
    expect(typeof recoveryCore.runSupabaseSql).toBe('function');
    if (typeof recoveryCore.runSupabaseSql !== 'function') return;

    let readCalls = 0;
    const readResult = await recoveryCore.runSupabaseSql({
      fetchImpl: async () => {
        readCalls += 1;
        if (readCalls === 1) {
          return { ok: false, status: 503, text: async () => '{}' };
        }
        return { ok: true, status: 200, text: async () => '[{"ok":true}]' };
      },
      sleep: async () => {},
      maxAttempts: 2,
      projectRef: 'project-ref',
      token: 'secret',
      sql: 'select 1',
      phase: 'read test',
      readOnly: true,
    });
    expect(readCalls).toBe(2);
    expect(readResult).toEqual([{ ok: true }]);

    let writeCalls = 0;
    const write = recoveryCore.runSupabaseSql({
      fetchImpl: async () => {
        writeCalls += 1;
        return { ok: false, status: 503, text: async () => '{}' };
      },
      sleep: async () => {},
      maxAttempts: 4,
      projectRef: 'project-ref',
      token: 'secret',
      sql: 'begin; insert into x values (1); commit;',
      phase: 'write test',
      readOnly: false,
    });

    await expect(write).rejects.toMatchObject({ outcomeUnknown: true });
    expect(writeCalls).toBe(1);
  });

  it('marks a write outcome unknown when reading the database response body fails', async () => {
    expect(typeof recoveryCore.runSupabaseSql).toBe('function');
    if (typeof recoveryCore.runSupabaseSql !== 'function') return;

    const write = recoveryCore.runSupabaseSql({
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        text: async () => {
          throw new Error('response stream interrupted');
        },
      }),
      projectRef: 'project-ref',
      token: 'secret',
      sql: 'begin; insert into x values (1); commit;',
      phase: 'write response body test',
      readOnly: false,
    });

    await expect(write).rejects.toMatchObject({ outcomeUnknown: true });
  });

  it('does not roll storage back when the final database write outcome is unknown', () => {
    expect(typeof recoveryCore.shouldRollbackStorageAfterFailure).toBe('function');
    if (typeof recoveryCore.shouldRollbackStorageAfterFailure !== 'function') return;

    expect(recoveryCore.shouldRollbackStorageAfterFailure(new Error('known failure'))).toBe(true);
    const unknown = new Error('gateway failed after write');
    unknown.outcomeUnknown = true;
    expect(recoveryCore.shouldRollbackStorageAfterFailure(unknown)).toBe(false);
  });

  it('wires every recovery safety guard into the executable runner', () => {
    const source = readFileSync(
      new URL('../../scripts/db/recover-prod-from-dev.mjs', import.meta.url),
      'utf8',
    );

    expect(source).toContain('AUTH_USER_COPY_COLUMN_ALLOWLIST');
    expect(source).toContain('buildCopiedAuthTokenCleanupPlan');
    expect(source).toContain('buildAuthTokenCleanupSql');
    expect(source).toContain("args.includes('--auth-token-cleanup-only')");
    expect(source).toContain('createAuthTokenCleanupBackup');
    expect(source).toContain('applyAuthTokenCleanup');
    expect(source).toContain('filterExcludedPrimaryKeys');
    expect(source).toContain('assertNoConflictingPrimaryKeys');
    expect(source).toContain('buildStageLoadSql');
    expect(source).toContain('createStorageUploadState');
    expect(source).toContain('shouldRollbackStorageAfterFailure');
    expect(source).toContain('runSupabaseSql');
    expect(source).toContain('invalid_policy_history_links');
    expect(source).not.toContain('production contains an auth user that is absent from dev');
    expect(source).not.toContain('const delimiter = `$recovery_');
  });
});
