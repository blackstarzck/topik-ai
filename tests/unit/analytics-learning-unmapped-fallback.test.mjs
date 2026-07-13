import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../../supabase/migrations-admin/20260713103000_admin_learning_analytics_unmapped_fallback.sql',
    import.meta.url
  ),
  'utf8'
);

const rollback = readFileSync(
  new URL(
    '../../supabase/migrations-admin/down/20260713103000_admin_learning_analytics_unmapped_fallback.sql',
    import.meta.url
  ),
  'utf8'
);

describe('학습 분석 미매핑 제출 fallback 마이그레이션', () => {
  it('기본 문항 통계는 problems.question_no로 현재 제출을 복구한다', () => {
    expect(migration).toContain('join public.problems problem on problem.id = ws.problem_id');
    expect(migration).toContain('coalesce(m.item_number, problem.question_no) as question_no');
    expect(migration).toContain(
      "(p_topic_main is null and p_topic_detail is null and v_detail_filters = '{}'::jsonb)"
    );
    expect(migration).toContain('or m.problem_id is not null');
  });

  it('주제 성과에는 메타데이터가 없는 제출을 섞지 않는다', () => {
    expect(migration).toMatch(/current_topics as \([\s\S]*?where s\.topic_main is not null/);
    expect(migration).toMatch(/previous_topics as \([\s\S]*?where s\.topic_main is not null/);
  });

  it('롤백은 기존의 메타데이터 필수 연결 계약을 복원한다', () => {
    expect(rollback).toContain('join metadata_filtered m on m.problem_id = ws.problem_id');
    expect(rollback).not.toContain('coalesce(m.item_number, problem.question_no)');
  });
});
