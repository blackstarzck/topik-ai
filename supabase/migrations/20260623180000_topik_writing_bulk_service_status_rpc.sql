-- =====================================================================
-- topik-ai admin · TOPIK 쓰기 문항 운영 조치 일괄 처리 · 0005
-- admin_bulk_set_writing_question_service_status: 선택한 문항 N건의 노출 상태
--   (service_status)를 한 번의 DB 왕복으로 변경.
--
-- 배경: 단건 admin_update_topik_question 은 문항마다 모달+사유 입력+RPC 1회라
--   수백 건 운영에 부적합하다. 이 RPC 는 question_id 배열을 받아 서버측에서
--   문항별로 루프하며 단건 RPC 와 동일한 계약(auth.uid() 게이트·diff·감사·무변경
--   무감사)을 항목별로 재현한다. 한 번의 호출로 집계를 반환한다.
--
-- 안전장치(2026-06-23 오너 결정, Opus 4.8 + GPT-5.5 설계):
--   1) 권한: auth.uid() + private.is_content_admin (단건 RPC 와 동일 경계).
--      UI 인증 세션 호출이므로 actor 파라미터를 받지 않는다(spoof 방지).
--   2) 멱등: 이미 목표 상태면 건너뛴다(unchanged) — 감사 행을 만들지 않는다.
--   3) 노출(available) 게이트: 검수 컬럼은 인바운드 전환(20260611190100)으로
--      삭제됐고 노출에 DB 백스톱이 없다. 그래서 이 RPC 가 유일한 서버측 가드다 —
--      '운영주의' 그룹 태그가 활성인 문항의 available 전환은 차단(blocked)하고
--      사유를 보고한다(silently 변경 금지). '반복방지'는 권고이므로 차단하지 않음.
--   4) 항목 격리: 문항별 BEGIN/EXCEPTION 서브트랜잭션 — 한 건 오류가 배치 전체를
--      중단시키지 않는다(admin_ingest_writing_tasks_bulk 선례와 동일).
--   5) cardinality cap: 단일 호출 최대 1000건(타임아웃·blast radius 한계).
--   6) 감사: 변경 문항마다 audit 행 1건(service_status_changed, target_id=question_id),
--      payload 에 공통 batch_id 를 넣어 한 번의 일괄 작업을 묶어 역추적한다.
--      set-based UPDATE 금지 — 반드시 문항별 루프(target_id·무변경 무감사 보존).
--
-- 반환(jsonb): { total, changed, unchanged, blocked, failed, details[], batch_id }
--   - details: 차단/실패 항목 {question_id, kind('blocked'|'failed'), message} (≤50)
-- down: supabase/migrations/down/20260623180000_topik_writing_bulk_service_status_rpc.sql
-- =====================================================================

create or replace function public.admin_bulk_set_writing_question_service_status(
  p_question_ids text[],
  p_next_status  text,
  p_reason       text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id    uuid := auth.uid();
  v_batch_id   uuid := gen_random_uuid();
  v_ids        text[];
  v_qid        text;
  v_item       int;
  v_table      text;
  v_current    text;
  v_caution    boolean;
  v_changed    integer := 0;
  v_unchanged  integer := 0;
  v_blocked    integer := 0;
  v_failed     integer := 0;
  v_total      integer := 0;
  v_details    jsonb   := '[]'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if p_next_status not in ('available', 'excluded', 'internal_test') then
    raise exception 'next_status must be one of available/excluded/internal_test';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'reason required';
  end if;
  if p_question_ids is null or array_length(p_question_ids, 1) is null then
    raise exception 'question_ids must be a non-empty array';
  end if;

  -- 중복 제거 + null 제거. total 은 실제로 처리하는 distinct 건수와 일치한다.
  v_ids := array(select distinct x from unnest(p_question_ids) x where x is not null);
  if cardinality(v_ids) > 1000 then
    raise exception 'too many question_ids: % (max 1000 per call)', cardinality(v_ids);
  end if;

  foreach v_qid in array v_ids loop
    v_total := v_total + 1;
    begin
      v_item := (substring(v_qid from '^topik-writing-(51|52|53|54)-'))::int;
      if v_item is null then
        raise exception 'invalid question_id format: %', v_qid;
      end if;
      v_table := format('topik_writing_%s_questions', v_item);

      execute format('select service_status from public.%I where question_id = $1', v_table)
        into v_current using v_qid;
      if v_current is null then
        raise exception 'question not found: %', v_qid;
      end if;

      -- 멱등: 이미 목표 상태 → 무변경(감사 없음)
      if v_current is not distinct from p_next_status then
        v_unchanged := v_unchanged + 1;
        continue;
      end if;

      -- 노출(available) 서버 게이트: '운영주의' 활성 태그 문항 차단(보고만)
      if p_next_status = 'available' then
        select exists(
          select 1
          from public.topik_writing_question_tags qt
          join public.topik_writing_tag_master tm on tm.tag_code = qt.tag_code
          where qt.question_id = v_qid
            and qt.is_active
            and tm.tag_group = '운영주의'
        ) into v_caution;
        if v_caution then
          v_blocked := v_blocked + 1;
          if jsonb_array_length(v_details) < 50 then
            v_details := v_details || jsonb_build_object(
              'question_id', v_qid,
              'kind', 'blocked',
              'message', '운영주의 태그 활성 — 노출(available) 차단'
            );
          end if;
          continue;
        end if;
      end if;

      execute format(
        'update public.%I set service_status = $1, updated_at = now() where question_id = $2',
        v_table)
        using p_next_status, v_qid;

      insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
      values (
        caller_id,
        'service_status_changed',
        'AssessmentQuestion',
        v_qid,
        jsonb_build_object('service_status', jsonb_build_object('from', v_current, 'to', p_next_status)),
        jsonb_build_object('note', p_reason, 'reason', p_reason, 'batch_id', v_batch_id, 'bulk', true)
      );
      v_changed := v_changed + 1;
    exception when others then
      -- 항목별 격리: 한 건 오류는 그 항목만 롤백하고 배치는 계속. 사유(SQLERRM) 보존.
      v_failed := v_failed + 1;
      if jsonb_array_length(v_details) < 50 then
        v_details := v_details || jsonb_build_object(
          'question_id', v_qid,
          'kind', 'failed',
          'message', left(coalesce(sqlerrm, ''), 300)
        );
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'total', v_total,
    'changed', v_changed,
    'unchanged', v_unchanged,
    'blocked', v_blocked,
    'failed', v_failed,
    'details', v_details,
    'batch_id', v_batch_id
  );
end;
$$;

revoke all on function public.admin_bulk_set_writing_question_service_status(text[], text, text) from public;
revoke all on function public.admin_bulk_set_writing_question_service_status(text[], text, text) from anon;
grant execute on function public.admin_bulk_set_writing_question_service_status(text[], text, text) to authenticated;

comment on function public.admin_bulk_set_writing_question_service_status(text[], text, text) is
  'content_admin 전용(UI 세션·auth.uid()). 선택 문항 N건의 service_status 를 한 번에 변경 — 문항별 격리·멱등(무변경 무감사)·노출 시 운영주의 태그 차단·변경 문항마다 감사(batch_id 묶음). {total,changed,unchanged,blocked,failed,details,batch_id} 반환.';
