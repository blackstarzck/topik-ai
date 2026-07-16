import { describe, expect, it } from 'vitest';

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
});
