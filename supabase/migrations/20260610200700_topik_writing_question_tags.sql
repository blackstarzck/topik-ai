-- =====================================================================
-- topik-ai admin · 메타데이터·태그 스키마 전환 P1 · 0007
-- topik_writing_question_tags: 문제-태그 매핑 (v0.8 §7.7, 이력 보존형)
--
-- 4분할 부모 테이블을 단일 FK로 참조할 수 없으므로 (question_id, item_number)
-- 합성 참조의 무결성은 RPC(admin_assign_question_tag)에서 검증한다 + 부분 인덱스.
-- down: supabase/migrations/down/20260610200700_topik_writing_question_tags.sql
-- =====================================================================

create table if not exists public.topik_writing_question_tags (
  tag_assignment_id bigint generated always as identity primary key,
  question_id       text not null,
  item_number       smallint not null check (item_number in (51, 52, 53, 54)),
  tag_code          text not null references public.topik_writing_tag_master (tag_code),
  tag_value         text,
  is_active         boolean not null default true,
  assigned_by       text,
  assigned_at       timestamptz not null default now(),
  removed_at        timestamptz,
  memo              text
);

-- 같은 문항에 같은 태그를 중복 활성 부여하는 것을 차단 (이력 행은 is_active=false로 보존)
create unique index if not exists topik_writing_question_tags_active_unique
  on public.topik_writing_question_tags (question_id, tag_code)
  where is_active;

comment on table public.topik_writing_question_tags is
  'TOPIK 쓰기 문제-태그 매핑 (v0.8 §7.7). 제거는 is_active=false+removed_at 갱신(이력 보존). 부여/제거는 admin_assign/remove_question_tag RPC 단일 경로.';
