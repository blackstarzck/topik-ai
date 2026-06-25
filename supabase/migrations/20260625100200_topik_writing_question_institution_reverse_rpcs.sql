-- =====================================================================
-- topik-ai admin · 기관 중심 노출 문항 관리 RPC 3종 (역방향 진입)
--   admin_add_institution_writing_questions    (기관에 문항 전용 노출 추가)
--   admin_remove_institution_writing_questions (기관 전용 노출 해제)
--   admin_list_institution_writing_questions   (전체 문항 + 이 기관 노출 여부)
--
-- 배경: 20260625100100 의 문항 중심 RPC(admin_set/clear_writing_question_institutions)는
--   "문항 → 허용 기관 집합" set-semantics 다. 회원>기관 코드 화면의 "기관 중심" 진입은
--   "기관 X → 전용 노출 문항"을 다루며, 추가/제거가 그 문항의 **다른 기관 매핑을 보존**해야
--   한다(set 으로는 stale 스냅샷 덮어쓰기로 동시편집 손실 위험). 그래서 institution_code=X
--   에만 작용하는 add/remove 를 별도로 둔다. 같은 매핑 테이블
--   (topik_writing_question_institution_exposure)을 양방향으로 쓰는 것이며 새 테이블은 없다.
--
-- 계약(20260625100100 선례 동일): auth.uid() + private.is_content_admin 가드, reason 필수,
--   문항별 BEGIN/EXCEPTION 격리, item 파싱·번호별 테이블 실재 검증, 멱등(무변경 무감사),
--   {total,changed,unchanged,blocked,failed,details,batch_id} 반환, admin_audit_logs 기록
--   (action='question_institutions_changed', payload.mode='add'|'remove').
-- 기존 RPC 3종·매핑 테이블은 건드리지 않는다(회귀 0).
-- down: supabase/migrations/down/20260625100200_topik_writing_question_institution_reverse_rpcs.sql
-- =====================================================================

-- ── Write: 기관 X 에 문항들 전용 노출 추가(다른 기관 매핑 보존) ────────────────────
create or replace function public.admin_add_institution_writing_questions(
  p_institution_code text,
  p_question_ids     text[],
  p_reason           text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id    uuid := auth.uid();
  v_batch_id   uuid := gen_random_uuid();
  v_reason     text := nullif(btrim(coalesce(p_reason, '')), '');
  v_code       text := btrim(coalesce(p_institution_code, ''));
  v_status     text;
  v_ids        text[];
  v_qid        text;
  v_item       int;
  v_table      text;
  v_exists     boolean;
  v_present    boolean;
  v_changed    integer := 0;
  v_unchanged  integer := 0;
  v_failed     integer := 0;
  v_total      integer := 0;
  v_details    jsonb   := '[]'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if v_code = '' then raise exception 'institution_code required'; end if;
  if p_question_ids is null or array_length(p_question_ids, 1) is null then
    raise exception 'question_ids must be a non-empty array';
  end if;

  -- 신규 부여이므로 활성 코드만 허용(20260625100100 set RPC 의 신규 코드 검증과 동일 정신).
  select status into v_status from public.institution_codes where code = v_code;
  if not found then raise exception 'unknown institution code: %', v_code; end if;
  if v_status <> '활성' then raise exception 'cannot add to a non-active code: %', v_code; end if;

  v_ids := array(select distinct x from unnest(p_question_ids) x where x is not null and btrim(x) <> '');
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
      execute format('select exists(select 1 from public.%I where question_id = $1)', v_table)
        into v_exists using v_qid;
      if not v_exists then
        raise exception 'question not found: % (item %)', v_qid, v_item;
      end if;

      select exists(
        select 1 from public.topik_writing_question_institution_exposure
         where question_id = v_qid and institution_code = v_code
      ) into v_present;
      if v_present then
        v_unchanged := v_unchanged + 1;
        continue;
      end if;

      insert into public.topik_writing_question_institution_exposure
        (question_id, item_number, institution_code, created_by, reason)
      values (v_qid, v_item::smallint, v_code, caller_id, v_reason)
      on conflict (question_id, institution_code) do nothing;

      insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
      values (
        caller_id,
        'question_institutions_changed',
        'AssessmentQuestion',
        v_qid,
        jsonb_build_object('institution_codes',
          jsonb_build_object('added', jsonb_build_array(v_code), 'removed', '[]'::jsonb)),
        jsonb_build_object('reason', v_reason, 'batch_id', v_batch_id,
          'added', jsonb_build_array(v_code), 'removed', '[]'::jsonb,
          'bulk', true, 'mode', 'add', 'institution_code', v_code)
      );
      v_changed := v_changed + 1;
    exception when others then
      v_failed := v_failed + 1;
      if jsonb_array_length(v_details) < 50 then
        v_details := v_details || jsonb_build_object(
          'question_id', v_qid, 'kind', 'failed', 'message', left(coalesce(sqlerrm, ''), 300));
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'total', v_total, 'changed', v_changed, 'unchanged', v_unchanged,
    'blocked', 0, 'failed', v_failed, 'details', v_details, 'batch_id', v_batch_id
  );
end;
$$;

-- ── Write: 기관 X 의 문항 전용 노출 해제(다른 기관 매핑 보존) ──────────────────────
create or replace function public.admin_remove_institution_writing_questions(
  p_institution_code text,
  p_question_ids     text[],
  p_reason           text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id    uuid := auth.uid();
  v_batch_id   uuid := gen_random_uuid();
  v_reason     text := nullif(btrim(coalesce(p_reason, '')), '');
  v_code       text := btrim(coalesce(p_institution_code, ''));
  v_ids        text[];
  v_qid        text;
  v_present    boolean;
  v_changed    integer := 0;
  v_unchanged  integer := 0;
  v_failed     integer := 0;
  v_total      integer := 0;
  v_details    jsonb   := '[]'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if v_code = '' then raise exception 'institution_code required'; end if;
  if p_question_ids is null or array_length(p_question_ids, 1) is null then
    raise exception 'question_ids must be a non-empty array';
  end if;

  -- 제거는 종료 코드도 허용(정리). 코드 실재 검증 생략 — 매핑 없으면 자연히 unchanged.
  v_ids := array(select distinct x from unnest(p_question_ids) x where x is not null and btrim(x) <> '');
  if cardinality(v_ids) > 1000 then
    raise exception 'too many question_ids: % (max 1000 per call)', cardinality(v_ids);
  end if;

  foreach v_qid in array v_ids loop
    v_total := v_total + 1;
    begin
      select exists(
        select 1 from public.topik_writing_question_institution_exposure
         where question_id = v_qid and institution_code = v_code
      ) into v_present;
      if not v_present then
        v_unchanged := v_unchanged + 1;
        continue;
      end if;

      delete from public.topik_writing_question_institution_exposure
       where question_id = v_qid and institution_code = v_code;

      insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
      values (
        caller_id,
        'question_institutions_changed',
        'AssessmentQuestion',
        v_qid,
        jsonb_build_object('institution_codes',
          jsonb_build_object('added', '[]'::jsonb, 'removed', jsonb_build_array(v_code))),
        jsonb_build_object('reason', v_reason, 'batch_id', v_batch_id,
          'added', '[]'::jsonb, 'removed', jsonb_build_array(v_code),
          'bulk', true, 'mode', 'remove', 'institution_code', v_code)
      );
      v_changed := v_changed + 1;
    exception when others then
      v_failed := v_failed + 1;
      if jsonb_array_length(v_details) < 50 then
        v_details := v_details || jsonb_build_object(
          'question_id', v_qid, 'kind', 'failed', 'message', left(coalesce(sqlerrm, ''), 300));
      end if;
    end;
  end loop;

  return jsonb_build_object(
    'total', v_total, 'changed', v_changed, 'unchanged', v_unchanged,
    'blocked', 0, 'failed', v_failed, 'details', v_details, 'batch_id', v_batch_id
  );
end;
$$;

-- ── Read: 전체 쓰기 문항 + 이 기관 노출 여부(is_exposed) + 문항 메타 ─────────────────
--   추천 뷰 전체에 exposure(institution_code=X) 존재 여부를 얹어 한 번에 반환한다.
--   is_exposed=true = 현재 이 기관 전용 노출, false = 추가 후보. 클라 조인 불필요.
create or replace function public.admin_list_institution_writing_questions(
  p_institution_code text
)
returns table (
  question_id        text,
  item_number        smallint,
  topic_main         text,
  situation_summary  text,
  question_type_name text,
  service_status     text,
  is_exposed         boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_code    text := btrim(coalesce(p_institution_code, ''));
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if v_code = '' then raise exception 'institution_code required'; end if;

  return query
    select v.question_id, v.item_number, v.topic_main, v.situation_summary,
           v.question_type_name, v.service_status,
           exists(
             select 1 from public.topik_writing_question_institution_exposure e
              where e.question_id = v.question_id and e.institution_code = v_code
           ) as is_exposed
      from public.topik_writing_question_recommendation_view v
     order by v.item_number, v.question_id;
end;
$$;

revoke all     on function public.admin_add_institution_writing_questions(text, text[], text) from public;
revoke all     on function public.admin_add_institution_writing_questions(text, text[], text) from anon;
grant  execute on function public.admin_add_institution_writing_questions(text, text[], text) to authenticated;
revoke all     on function public.admin_remove_institution_writing_questions(text, text[], text) from public;
revoke all     on function public.admin_remove_institution_writing_questions(text, text[], text) from anon;
grant  execute on function public.admin_remove_institution_writing_questions(text, text[], text) to authenticated;
revoke all     on function public.admin_list_institution_writing_questions(text) from public;
revoke all     on function public.admin_list_institution_writing_questions(text) from anon;
grant  execute on function public.admin_list_institution_writing_questions(text) to authenticated;

comment on function public.admin_add_institution_writing_questions(text, text[], text) is
  'content_admin 전용. 기관(활성 코드)에 선택 문항들을 전용 노출로 추가 — institution_code 매핑 INSERT(다른 기관 매핑 보존)·문항별 격리·멱등(무변경 무감사)·감사(mode=add). 동일 jsonb shape 반환.';
comment on function public.admin_remove_institution_writing_questions(text, text[], text) is
  'content_admin 전용. 기관의 선택 문항 전용 노출 해제 — institution_code 매핑 DELETE(다른 기관 매핑 보존)·멱등·감사(mode=remove). 종료 코드 정리 허용. 동일 jsonb shape 반환.';
comment on function public.admin_list_institution_writing_questions(text) is
  'content_admin 전용 read. 전체 쓰기 문항(recommendation_view)에 이 기관 노출 여부(is_exposed)+문항 메타를 얹어 반환(기관 중심 모달: 현재 노출=is_exposed true, 추가 후보=false).';
