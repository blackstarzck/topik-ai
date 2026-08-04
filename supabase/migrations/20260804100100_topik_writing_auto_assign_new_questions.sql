-- =====================================================================
-- 신규 문항 자동 배정 옵션 — 문항이 노출 전환될 때 지정 기관에 자동으로 배정한다.
--
-- 배경: `배정분만` 모드 기관은 배정된 문항만 학습자에게 보인다. 따라서 새 문항을
--   노출 전환해도 그 기관 학습자에게는 나타나지 않고, 운영자가 기관별로 배정을
--   다시 해줘야 한다(20260801100000 헤더가 지적한 드리프트 ①). 기관 단위 모드
--   `제한 없음` 은 그 문제를 "전량 허용" 으로 풀지만, 일부만 보여주면서도 신규 문항은
--   따라오게 하고 싶은 기관에는 답이 없었다. 이 옵션이 그 칸을 채운다.
--
-- "신규 문항 등록" 의 정의 — dev 실측(2026-08-04)으로 확정:
--   · 문항 승격(admin_promote_writing_questions)은 문항 테이블에 **DELETE + INSERT**
--     로 들어가고, 기존 행이 있으면 그 service_status 를 그대로 보존하며 없으면
--     `internal_test` 로 넣는다(prosrc 150·155·158행). 즉 **INSERT 는 신규와 갱신을
--     구분할 수 없다** — 재승격도 INSERT 다.
--   · 문항이 학습자에게 보이기 시작하는 순간은 `service_status` 가 `available` 로
--     바뀌는 시점이며, 그 경로는 admin_bulk_set_writing_question_service_status 와
--     admin_update_topik_question 둘뿐이다(둘 다 문항당 UPDATE 1건, 실측).
--   따라서 훅은 **AFTER UPDATE OF service_status** 이고, 재승격(상태 보존 DELETE+INSERT)
--   에서는 발화하지 않는다 — 의도한 대로 신규 노출만 잡는다.
--   문항당 UPDATE 1건이므로 statement 트리거가 아니라 **row 트리거**로 충분하다.
--
-- 소급 적용하지 않는다: 옵션을 켠 시점에 이미 `available` 인 문항은 배정하지 않는다.
--   소급하면 "지금 보이는 문항 수 불변" 이 깨져 옵션 하나가 대량 노출 변경이 된다.
--   기존 문항을 넣고 싶으면 기관 중심 배정 화면에서 명시적으로 하면 된다.
--
-- 모드와 독립이다: 플래그가 켜진 활성 기관이면 노출 모드와 무관하게 배정 행을 넣는다.
--   `제한 없음` 기관에서는 배정 행이 게이팅에 참여하지 않으므로 즉시 효과는 없고,
--   나중에 `배정분만` 으로 전환할 때 신규 문항이 빠지지 않도록 목록을 미리 채워두는
--   의미만 갖는다. 모드에 따라 다르게 동작하면 숨은 상호작용이 되므로 단순하게 둔다.
--
-- 짝 마이그: supabase/migrations/20260804100000 (계약 원장 — 이 파일보다 먼저 적용)
-- down: supabase/migrations/down/20260804100100_topik_writing_auto_assign_new_questions.sql
-- =====================================================================

-- ---------------------------------------------------------------- 옵션 컬럼
alter table public.topik_writing_institution_exposure_mode
  add column if not exists auto_assign_new_questions boolean not null default false;

comment on column public.topik_writing_institution_exposure_mode.auto_assign_new_questions is
  '문항이 노출 전환(service_status → available)될 때 이 기관에 자동 배정할지(관리자 옵션, 기본 false). 옵션을 켠 시점에 이미 available 인 문항은 소급 배정하지 않는다. 노출 모드와 독립이며 `제한 없음` 기관에서는 즉시 효과가 없고 나중의 모드 전환에 대비해 배정 목록만 채운다.';

-- ---------------------------------------------------------------- 자동 배정 트리거 함수
create or replace function private.auto_assign_writing_question_to_institutions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_inserted integer := 0;
begin
  -- institution_codes 는 admin 네임스페이스(별도 tracker·러너) 소유라 적용 순서가
  -- 보장되지 않는다. 없으면 배정할 기관 목록 자체를 알 수 없으므로 조용히 통과한다
  -- (fail-open — 20260731100100·20260801100000 의 폴더 간 참조 관례).
  if to_regclass('public.institution_codes') is null then
    return null;
  end if;

  insert into public.topik_writing_question_institution_exposure (
    question_id, item_number, institution_code, created_by, reason
  )
  select new.question_id,
         new.item_number,
         m.institution_code,
         auth.uid(),
         '자동 배정(신규 문항 노출 전환)'
    from public.topik_writing_institution_exposure_mode m
    join public.institution_codes c
      on c.code = m.institution_code
   where m.auto_assign_new_questions
     and c.status = '활성'
  on conflict (question_id, institution_code) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted > 0 then
    raise notice 'auto-assigned writing question % (item %) to % institution(s)',
      new.question_id, new.item_number, v_inserted;
  end if;

  return null;
end;
$$;

revoke all on function private.auto_assign_writing_question_to_institutions() from public;
revoke all on function private.auto_assign_writing_question_to_institutions() from anon;
revoke all on function private.auto_assign_writing_question_to_institutions() from authenticated;
revoke all on function private.auto_assign_writing_question_to_institutions() from service_role;

comment on function private.auto_assign_writing_question_to_institutions() is
  '문항이 노출 전환될 때 auto_assign_new_questions 가 켜진 활성 기관에 배정 행을 넣는 row 트리거(AFTER UPDATE OF service_status). 배정 테이블의 PK 는 (question_id, institution_code) 이므로 on conflict do nothing 이 중복 배정을 흡수한다. 행을 추가만 하므로 마지막-배정 삭제 가드(G2, DELETE·UPDATE 방향)와 충돌하지 않는다. institution_codes 가 아직 없으면 fail-open. 2026-08-04.';

-- ---------------------------------------------------------------- 문항 4테이블 트리거
-- 20260713082500 선례대로 4테이블에 같은 트리거를 반복 정의한다(문항 테이블은 항목별로
-- 분리돼 있고 공통 부모가 없다). WHEN 절로 "available 로 처음 바뀌는 전환" 만 잡는다 —
-- available → available 재저장이나 available → excluded 는 발화하지 않는다.
drop trigger if exists topik_writing_51_auto_assign_on_available
  on public.topik_writing_51_questions;
create trigger topik_writing_51_auto_assign_on_available
after update of service_status on public.topik_writing_51_questions
for each row
when (new.service_status = 'available' and old.service_status is distinct from 'available')
execute function private.auto_assign_writing_question_to_institutions();

drop trigger if exists topik_writing_52_auto_assign_on_available
  on public.topik_writing_52_questions;
create trigger topik_writing_52_auto_assign_on_available
after update of service_status on public.topik_writing_52_questions
for each row
when (new.service_status = 'available' and old.service_status is distinct from 'available')
execute function private.auto_assign_writing_question_to_institutions();

drop trigger if exists topik_writing_53_auto_assign_on_available
  on public.topik_writing_53_questions;
create trigger topik_writing_53_auto_assign_on_available
after update of service_status on public.topik_writing_53_questions
for each row
when (new.service_status = 'available' and old.service_status is distinct from 'available')
execute function private.auto_assign_writing_question_to_institutions();

drop trigger if exists topik_writing_54_auto_assign_on_available
  on public.topik_writing_54_questions;
create trigger topik_writing_54_auto_assign_on_available
after update of service_status on public.topik_writing_54_questions
for each row
when (new.service_status = 'available' and old.service_status is distinct from 'available')
execute function private.auto_assign_writing_question_to_institutions();

-- ---------------------------------------------------------------- 옵션 토글 RPC
create or replace function public.admin_set_institution_auto_assign(
  p_code    text,
  p_enabled boolean,
  p_reason  text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
  v_code    text := btrim(coalesce(p_code, ''));
  v_reason  text := nullif(btrim(coalesce(p_reason, '')), '');
  v_enabled boolean := coalesce(p_enabled, false);
  v_old     boolean;
  v_assigned bigint;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.institution-codes.manage') then
    raise exception 'forbidden: missing permission users.institution-codes.manage';
  end if;
  if v_code = '' then raise exception 'code required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;

  perform 1
    from public.institution_codes c
   where c.code = v_code
   for update;
  if not found then
    raise exception 'unknown code: %', v_code;
  end if;

  select m.auto_assign_new_questions
    into v_old
    from public.topik_writing_institution_exposure_mode m
   where m.institution_code = v_code
   for update;

  v_old := coalesce(v_old, false);
  if v_old = v_enabled then
    return v_code;  -- 변경 없음 — 감사 행을 남기지 않는다.
  end if;

  -- 20260804100000 의 auto_hide 토글과 같은 이유로 do update 목록에 exposure_mode 를
  -- 넣지 않는다(기존 모드 덮어쓰기 + `update of exposure_mode` 트리거 오발화 방지).
  insert into public.topik_writing_institution_exposure_mode (
    institution_code, auto_assign_new_questions, reason, changed_by, updated_at
  ) values (
    v_code, v_enabled, v_reason, caller_id, now()
  )
  on conflict (institution_code) do update set
    auto_assign_new_questions = excluded.auto_assign_new_questions,
    reason = excluded.reason,
    changed_by = excluded.changed_by,
    updated_at = now();

  select count(*)
    into v_assigned
    from public.topik_writing_question_institution_exposure e
   where e.institution_code = v_code;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'institution_auto_assign_changed',
    'InstitutionCode',
    v_code,
    jsonb_build_object('auto_assign_new_questions', jsonb_build_object('from', v_old, 'to', v_enabled)),
    jsonb_build_object(
      'reason', v_reason,
      'code', v_code,
      'assignment_count', v_assigned,
      'retroactive', false
    )
  );

  return v_code;
end;
$$;

revoke all on function public.admin_set_institution_auto_assign(text, boolean, text) from public;
revoke all on function public.admin_set_institution_auto_assign(text, boolean, text) from anon;
grant execute on function public.admin_set_institution_auto_assign(text, boolean, text) to authenticated;

comment on function public.admin_set_institution_auto_assign(text, boolean, text) is
  '기관의 "신규 문항 자동 배정" 옵션을 켜고 끈다(사유 필수, 권한 users.institution-codes.manage). 값이 그대로면 감사 행 없이 조기 반환한다. 소급 배정하지 않으며(payload.retroactive=false 로 계약 명시) 옵션을 켠 이후 노출 전환되는 문항만 배정된다. 감사 action = institution_auto_assign_changed. 2026-08-04.';

-- ---------------------------------------------------------------- 사후 단정
do $verify$
declare
  v_count integer;
  v_def   text;
begin
  if not exists (
    select 1
      from pg_attribute a
     where a.attrelid = 'public.topik_writing_institution_exposure_mode'::regclass
       and a.attname = 'auto_assign_new_questions'
       and not a.attisdropped
  ) then
    raise exception 'auto_assign_column_missing';
  end if;

  -- 4테이블 전부에 트리거가 걸렸는지. 개수 단정이라 한 테이블을 빠뜨리면 잡힌다.
  select count(*)
    into v_count
    from pg_trigger t
   where not t.tgisinternal
     and t.tgname in (
       'topik_writing_51_auto_assign_on_available',
       'topik_writing_52_auto_assign_on_available',
       'topik_writing_53_auto_assign_on_available',
       'topik_writing_54_auto_assign_on_available'
     );
  if v_count <> 4 then
    raise exception 'auto_assign_trigger_count_mismatch: expected 4, found %', v_count;
  end if;

  -- 트리거가 UPDATE 전용인지(INSERT 에도 걸리면 재승격이 신규로 오인된다).
  select count(*)
    into v_count
    from pg_trigger t
   where not t.tgisinternal
     and t.tgname like 'topik_writing_5%_auto_assign_on_available'
     and (t.tgtype & 4) <> 0;  -- 4 = INSERT
  if v_count <> 0 then
    raise exception 'auto_assign_trigger_must_not_fire_on_insert: %', v_count;
  end if;

  v_def := pg_get_functiondef(
    to_regprocedure('private.auto_assign_writing_question_to_institutions()')
  );
  if position('auto_assign_new_questions' in v_def) = 0 then
    raise exception 'auto_assign_trigger_flag_not_wired';
  end if;
  -- 배정 행만 추가해야 한다 — 삭제가 섞이면 G2 와 충돌하고 노출이 줄어든다.
  if position('delete' in lower(v_def)) > 0 then
    raise exception 'auto_assign_trigger_must_not_remove_assignments';
  end if;

  if has_function_privilege('anon', 'public.admin_set_institution_auto_assign(text,boolean,text)', 'EXECUTE') then
    raise exception 'auto_assign_rpc_anon_execute_present';
  end if;
end
$verify$;
