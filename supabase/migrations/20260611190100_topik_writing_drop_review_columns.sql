-- =====================================================================
-- topik-ai admin · 인바운드 모델 전환(2026-06-11, 결정 기록 §0) · P3 재정의 · 0013
-- 검수 개념 전면 삭제: 검수 컬럼 물리 제거 + 추천 뷰 재생성 + 쓰기 RPC 축소.
--
--   - 4테이블 공통: review_status / review_workflow_status(편차 E1 철회) /
--     review_passed 제거. 51 전용: validation_result 제거.
--     (auto_checks_passed는 수신·적재 자동 정합 검사 표식으로 존치,
--      content_team_memo는 수신 메타데이터로 존치 — admin 쓰기 없음)
--   - 뷰: review_status·review_workflow_status 컬럼 제외 16컬럼으로 재생성
--     (security_invoker 유지). 컬럼 집합이 줄어 drop 후 create.
--   - RPC admin_update_topik_question: 화이트리스트를 service_status 단일로
--     축소, 검수 결합 가드(구 POL-018 ①)·검수 액션 파생 제거.
--     감사 액션은 'service_status_changed' 단일, 예약 키 '__note'는
--     payload.note로 기록(구 review_note 키 폐기 — D-8 개정).
--   - 검수 인덱스 4종은 컬럼 drop으로 함께 제거된다.
-- down: supabase/migrations/down/20260611190100_topik_writing_drop_review_columns.sql
-- =====================================================================

-- 1) 뷰 선제 drop (검수 컬럼 의존 해제)
drop view if exists public.topik_writing_question_recommendation_view;

-- 2) 검수 컬럼 제거 (4테이블 동시 — 공통 컬럼 동결 원칙 §3.2-2)
alter table public.topik_writing_51_questions
  drop column if exists review_status,
  drop column if exists review_workflow_status,
  drop column if exists review_passed,
  drop column if exists validation_result;

alter table public.topik_writing_52_questions
  drop column if exists review_status,
  drop column if exists review_workflow_status,
  drop column if exists review_passed;

alter table public.topik_writing_53_questions
  drop column if exists review_status,
  drop column if exists review_workflow_status,
  drop column if exists review_passed;

alter table public.topik_writing_54_questions
  drop column if exists review_status,
  drop column if exists review_workflow_status,
  drop column if exists review_passed;

-- 3) 추천 뷰 재생성 (16컬럼 — 검수 2컬럼 제외, security_invoker 유지)
create view public.topik_writing_question_recommendation_view
with (security_invoker = true)
as
select
  question_id, item_number, target_level, difficulty_level,
  topic_main, topic_detail, speech_act, scenario_type,
  recommendation_keys, avoid_repeat_keys, service_status,
  situation_summary, question_type_name, content_team_memo,
  created_at, updated_at
from public.topik_writing_51_questions
union all
select
  question_id, item_number, target_level, difficulty_level,
  topic_main, topic_detail, speech_act, scenario_type,
  recommendation_keys, avoid_repeat_keys, service_status,
  situation_summary, question_type_name, content_team_memo,
  created_at, updated_at
from public.topik_writing_52_questions
union all
select
  question_id, item_number, target_level, difficulty_level,
  topic_main, topic_detail, speech_act, scenario_type,
  recommendation_keys, avoid_repeat_keys, service_status,
  situation_summary, question_type_name, content_team_memo,
  created_at, updated_at
from public.topik_writing_53_questions
union all
select
  question_id, item_number, target_level, difficulty_level,
  topic_main, topic_detail, speech_act, scenario_type,
  recommendation_keys, avoid_repeat_keys, service_status,
  situation_summary, question_type_name, content_team_memo,
  created_at, updated_at
from public.topik_writing_54_questions;

comment on view public.topik_writing_question_recommendation_view is
  '51~54 공통 컬럼 UNION ALL 읽기전용 뷰 (인바운드 모델 — 검수 컬럼 제거, 2026-06-11 §0). security_invoker=true로 베이스 테이블 RLS 상속.';

-- 4) 쓰기 RPC 축소 — service_status 단일 화이트리스트 (D-8 개정)
create or replace function public.admin_update_topik_question(
  p_question_id text,
  p_item_number smallint,
  p_patch       jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id  uuid := auth.uid();
  v_table    text;
  v_old      jsonb;
  v_diff     jsonb := '{}'::jsonb;
  v_note     text  := nullif(p_patch->>'__note', '');
  v_payload  jsonb := '{}'::jsonb;
  k          text;
  v_from     text;
  v_to       text;
  allowed    text[] := array['service_status'];
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if p_question_id is null then raise exception 'question_id required'; end if;
  if p_item_number not in (51, 52, 53, 54) then
    raise exception 'item_number must be one of 51/52/53/54';
  end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be a json object';
  end if;

  v_table := format('topik_writing_%s_questions', p_item_number);

  execute format(
    'select to_jsonb(t) from public.%I t where t.question_id = $1', v_table)
    into v_old using p_question_id;
  if v_old is null then raise exception 'question not found: %', p_question_id; end if;

  for k in select jsonb_object_keys(p_patch) loop
    if not (k = any(allowed)) then
      continue; -- '__note' 포함 미허용 키는 컬럼에 닿지 않는다
    end if;
    v_from := v_old->>k;
    v_to   := p_patch->>k;
    if v_from is distinct from v_to then
      execute format('update public.%I set %I = $1, updated_at = now() where question_id = $2', v_table, k)
        using v_to, p_question_id;
      v_diff := v_diff || jsonb_build_object(k, jsonb_build_object('from', v_from, 'to', v_to));
    end if;
  end loop;

  if v_diff = '{}'::jsonb then
    return; -- 변경 없음 → 감사 행 없음
  end if;

  if v_note is not null then
    v_payload := jsonb_build_object('note', v_note);
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'service_status_changed', 'AssessmentQuestion', p_question_id, v_diff, v_payload);
end;
$$;
revoke all on function public.admin_update_topik_question(text, smallint, jsonb) from public;
grant execute on function public.admin_update_topik_question(text, smallint, jsonb) to authenticated;
comment on function public.admin_update_topik_question(text, smallint, jsonb) is
  'content_admin 전용. topik_writing_5x_questions의 service_status(노출 통제) patch + admin_audit_logs diff 기록(인바운드 모델 — 검수 화이트리스트 철회, 2026-06-11 §0). 예약 키 __note는 payload.note로 저장.';
