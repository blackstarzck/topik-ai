import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../../supabase/migrations/20260713072205_topik_writing_problem_alias.sql',
    import.meta.url
  ),
  'utf8'
);

const rollback = readFileSync(
  new URL(
    '../../supabase/migrations/down/20260713072205_topik_writing_problem_alias.sql',
    import.meta.url
  ),
  'utf8'
);

describe('TOPIK writing problem alias migration', () => {
  it('enforces one question per problem and preserves canonical source-map history', () => {
    expect(migration).toMatch(/problem_id\s+uuid\s+primary key/i);
    expect(migration).toMatch(/question_id\s+text\s+not null\s+references\s+public\.topik_writing_question_source_map\(question_id\)[\s\S]*?on delete restrict/i);
    expect(migration).not.toMatch(/references\s+public\.problems/i);
    expect(migration).not.toMatch(/(?:update|delete from)\s+public\.topik_writing_question_source_map/i);
  });

  it('models hold state on the alias edge and keeps canonical hold state separate in the unified view', () => {
    expect(migration).toMatch(/mapping_status\s+text\s+not null\s+default\s+'active'[\s\S]*?mapping_status\s+in\s*\('active',\s*'held'\)/i);
    expect(migration).toMatch(/mapping_status\s*=\s*'active'\s+and\s+hold_reason\s+is\s+null/i);
    expect(migration).toMatch(/mapping_status\s*=\s*'held'\s+and\s+nullif\(btrim\(hold_reason\),\s*''\)\s+is\s+not\s+null/i);

    const canonicalBranch = migration.slice(
      migration.indexOf('select\n    sm.legacy_problem_id'),
      migration.indexOf('union all')
    );
    const aliasBranch = migration.slice(migration.indexOf('union all'));
    expect(canonicalBranch).toContain("case when sm.hold_reason is null then 'active'::text else 'held'::text end");
    expect(canonicalBranch).toContain('sm.hold_reason');
    expect(aliasBranch).toContain('alias.mapping_status');
    expect(aliasBranch).toContain('alias.hold_reason');
  });

  it('enables RLS and limits browser reads to authenticated administrators', () => {
    expect(migration).toContain('alter table public.topik_writing_problem_aliases enable row level security;');
    expect(migration).toMatch(/create policy topik_writing_problem_aliases_admin_select[\s\S]*?for select to authenticated[\s\S]*?private\.is_admin\(\(select auth\.uid\(\)\)\)/i);
    expect(migration).toContain('revoke all on table public.topik_writing_problem_aliases from public, anon, authenticated;');
    expect(migration).toContain('grant select on table public.topik_writing_problem_aliases to authenticated;');
    expect(migration).toContain('grant all on table public.topik_writing_problem_aliases to service_role;');
    expect(migration).not.toMatch(/for\s+(?:insert|update|delete)\s+to\s+authenticated/i);
  });

  it('exposes the unified mapping only through a security-invoker admin-readable view', () => {
    expect(migration).toMatch(/create view public\.topik_writing_problem_question_map\s+with \(security_invoker = true\)/i);
    expect(migration).toContain('revoke all on table public.topik_writing_problem_question_map from public, anon, authenticated;');
    expect(migration).toContain('grant select on table public.topik_writing_problem_question_map to authenticated;');
    expect(migration).toMatch(/from public\.topik_writing_question_source_map sm[\s\S]*?where sm\.legacy_problem_id is not null[\s\S]*?union all[\s\S]*?from public\.topik_writing_problem_aliases alias/i);
  });

  it('drops the dependent view and policy before dropping the alias table', () => {
    const viewIndex = rollback.indexOf('drop view if exists public.topik_writing_problem_question_map;');
    const policyIndex = rollback.indexOf('drop policy if exists topik_writing_problem_aliases_admin_select');
    const tableIndex = rollback.indexOf('drop table if exists public.topik_writing_problem_aliases;');

    expect(viewIndex).toBeGreaterThanOrEqual(0);
    expect(policyIndex).toBeGreaterThan(viewIndex);
    expect(tableIndex).toBeGreaterThan(policyIndex);
  });
});
