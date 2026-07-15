-- =====================================================================
-- TOPIK 쓰기 · 환경별 problem_id 별칭 계약
--
-- v13 problems 재적재로 UUID가 바뀌어도 canonical question_id와 과거
-- legacy_problem_id를 보존한 채 현재 학습 기록을 같은 메타데이터에 연결한다.
-- 환경별 UUID 데이터는 이 마이그레이션에 넣지 않고 ETL reconciliation으로 적재한다.
-- down: supabase/migrations/down/20260713072205_topik_writing_problem_alias.sql
-- =====================================================================

create table public.topik_writing_problem_aliases (
  problem_id uuid primary key,
  question_id text not null references public.topik_writing_question_source_map(question_id)
    on update cascade on delete restrict,
  alias_kind text not null check (alias_kind in ('environment_reseed', 'historical', 'canonical')),
  source text not null,
  backfill_batch text not null,
  mapping_status text not null default 'active' check (mapping_status in ('active', 'held')),
  hold_reason text,
  match_hash text not null check (match_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check (
    (mapping_status = 'active' and hold_reason is null)
    or (mapping_status = 'held' and nullif(btrim(hold_reason), '') is not null)
  )
);

comment on table public.topik_writing_problem_aliases is
  '환경별 problems.id를 canonical TOPIK 쓰기 question_id에 추가 연결하는 이력 보존형 별칭. 환경 UUID DML은 reconciliation manifest로만 관리한다.';
comment on column public.topik_writing_problem_aliases.problem_id is
  'v13 problems.id 참조값. v13 소유 테이블과의 FK는 만들지 않고 coverage 검사에서 orphan을 차단한다.';
comment on column public.topik_writing_problem_aliases.match_hash is
  '문제 번호·정규화 본문·정답 구조가 완전 일치했음을 나타내는 SHA-256 증적.';
comment on column public.topik_writing_problem_aliases.mapping_status is
  '별칭 edge 자체의 상태. 과거 canonical source map의 hold_reason을 현재 결정적 별칭에 전파하지 않는다.';

create index topik_writing_problem_aliases_question_id_idx
  on public.topik_writing_problem_aliases(question_id);

alter table public.topik_writing_problem_aliases enable row level security;

create policy topik_writing_problem_aliases_admin_select
  on public.topik_writing_problem_aliases
  for select to authenticated
  using (private.is_admin((select auth.uid())));

revoke all on table public.topik_writing_problem_aliases from public, anon, authenticated;
grant select on table public.topik_writing_problem_aliases to authenticated;
grant all on table public.topik_writing_problem_aliases to service_role;

create view public.topik_writing_problem_question_map
with (security_invoker = true)
as
  select
    sm.legacy_problem_id as problem_id,
    sm.question_id,
    sm.item_number,
    'legacy'::text as mapping_kind,
    sm.backfill_batch,
    case when sm.hold_reason is null then 'active'::text else 'held'::text end as mapping_status,
    sm.hold_reason
  from public.topik_writing_question_source_map sm
  where sm.legacy_problem_id is not null

  union all

  select
    alias.problem_id,
    alias.question_id,
    sm.item_number,
    alias.alias_kind as mapping_kind,
    alias.backfill_batch,
    alias.mapping_status,
    alias.hold_reason
  from public.topik_writing_problem_aliases alias
  join public.topik_writing_question_source_map sm
    on sm.question_id = alias.question_id;

comment on view public.topik_writing_problem_question_map is
  'canonical legacy_problem_id와 환경별 별칭을 합친 problem_id -> question_id 읽기 계약. problem_id fan-out은 pre-deploy coverage 검사로 차단한다.';

revoke all on table public.topik_writing_problem_question_map from public, anon, authenticated;
grant select on table public.topik_writing_problem_question_map to authenticated;
