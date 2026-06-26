-- =====================================================================
-- TOPIK writing institution exposure global status guard
--
-- service_status is the top-level exposure switch. Institution mappings are
-- an additional allow-list layer and cannot newly expose a question whose
-- service_status is not available. Existing mappings are preserved; removal
-- and clear flows remain allowed so stale mappings can be cleaned up.
--
-- down: supabase/migrations/down/20260626110000_topik_writing_institution_exposure_global_status_guard.sql
-- =====================================================================

create or replace function public.admin_set_writing_question_institutions(
  p_question_ids      text[],
  p_institution_codes text[],
  p_reason            text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id        uuid := auth.uid();
  v_batch_id       uuid := gen_random_uuid();
  v_reason         text := nullif(btrim(coalesce(p_reason, '')), '');
  v_ids            text[];
  v_codes          text[];
  v_invalid        text[];
  v_target         text[];
  v_qid            text;
  v_item           int;
  v_table          text;
  v_exists         boolean;
  v_service_status text;
  v_current        text[];
  v_added          text[];
  v_removed        text[];
  v_verify         text[];
  v_changed        integer := 0;
  v_unchanged      integer := 0;
  v_blocked        integer := 0;
  v_failed         integer := 0;
  v_total          integer := 0;
  v_details        jsonb   := '[]'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_content_admin(caller_id) then
    raise exception 'forbidden: content_admin required';
  end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if p_question_ids is null or array_length(p_question_ids, 1) is null then
    raise exception 'question_ids must be a non-empty array';
  end if;

  v_ids := array(select distinct x from unnest(p_question_ids) x where x is not null and btrim(x) <> '');
  if cardinality(v_ids) > 1000 then
    raise exception 'too many question_ids: % (max 1000 per call)', cardinality(v_ids);
  end if;

  v_codes := array(select distinct btrim(x)
                     from unnest(coalesce(p_institution_codes, array[]::text[])) x
                    where x is not null and btrim(x) <> '');
  v_target := array(select c from unnest(v_codes) c order by c);

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

      execute format('select service_status from public.%I where question_id = $1', v_table)
        into v_service_status using v_qid;

      select coalesce(array_agg(institution_code), array[]::text[])
        into v_current
        from public.topik_writing_question_institution_exposure
       where question_id = v_qid;

      v_added   := array(select c from unnest(v_codes)   c where c <> all(v_current));
      v_removed := array(select c from unnest(v_current) c where c <> all(v_codes));

      if cardinality(v_added) > 0 then
        select array(select c from unnest(v_added) c
                      where not exists (select 1 from public.institution_codes ic
                                         where ic.code = c and ic.status = '활성'))
          into v_invalid;
        if v_invalid is not null and cardinality(v_invalid) > 0 then
          raise exception 'unknown or inactive institution code(s): %', array_to_string(v_invalid, ', ');
        end if;
      end if;

      if cardinality(v_added) > 0 and v_service_status is distinct from 'available' then
        v_blocked := v_blocked + 1;
        if jsonb_array_length(v_details) < 50 then
          v_details := v_details || jsonb_build_object(
            'question_id', v_qid,
            'kind', 'blocked',
            'message', '전역 노출 상태가 노출 가능이 아니어서 기관 노출에 추가할 수 없습니다.'
          );
        end if;

        insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
        values (
          caller_id,
          'question_institutions_changed',
          'AssessmentQuestion',
          v_qid,
          jsonb_build_object('institution_codes',
            jsonb_build_object('added', '[]'::jsonb, 'removed', '[]'::jsonb)),
          jsonb_build_object(
            'reason', v_reason,
            'batch_id', v_batch_id,
            'blocked', true,
            'blocked_reason', 'global_service_status',
            'service_status', v_service_status,
            'attempted_added', to_jsonb(v_added),
            'attempted_removed', to_jsonb(v_removed),
            'bulk', true
          )
        );
        continue;
      end if;

      if cardinality(v_added) = 0 and cardinality(v_removed) = 0 then
        v_unchanged := v_unchanged + 1;
        continue;
      end if;

      if cardinality(v_added) > 0 then
        insert into public.topik_writing_question_institution_exposure
          (question_id, item_number, institution_code, created_by, reason)
        select v_qid, v_item::smallint, c, caller_id, v_reason from unnest(v_added) c
        on conflict (question_id, institution_code) do nothing;
      end if;
      if cardinality(v_removed) > 0 then
        delete from public.topik_writing_question_institution_exposure
         where question_id = v_qid and institution_code = any(v_removed);
      end if;

      select array(select institution_code
                     from public.topik_writing_question_institution_exposure
                    where question_id = v_qid order by institution_code)
        into v_verify;
      if v_verify is distinct from v_target then
        raise exception 'institution set mismatch after write for % (got %, expected %)',
          v_qid, v_verify, v_target;
      end if;

      insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
      values (
        caller_id,
        'question_institutions_changed',
        'AssessmentQuestion',
        v_qid,
        jsonb_build_object('institution_codes',
          jsonb_build_object('added', to_jsonb(v_added), 'removed', to_jsonb(v_removed))),
        jsonb_build_object('reason', v_reason, 'batch_id', v_batch_id,
          'added', to_jsonb(v_added), 'removed', to_jsonb(v_removed), 'bulk', true)
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
    'blocked', v_blocked, 'failed', v_failed, 'details', v_details, 'batch_id', v_batch_id
  );
end;
$$;

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
  caller_id        uuid := auth.uid();
  v_batch_id       uuid := gen_random_uuid();
  v_reason         text := nullif(btrim(coalesce(p_reason, '')), '');
  v_code           text := btrim(coalesce(p_institution_code, ''));
  v_status         text;
  v_ids            text[];
  v_qid            text;
  v_item           int;
  v_table          text;
  v_exists         boolean;
  v_service_status text;
  v_present        boolean;
  v_changed        integer := 0;
  v_unchanged      integer := 0;
  v_blocked        integer := 0;
  v_failed         integer := 0;
  v_total          integer := 0;
  v_details        jsonb   := '[]'::jsonb;
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

      execute format('select service_status from public.%I where question_id = $1', v_table)
        into v_service_status using v_qid;

      if v_service_status is distinct from 'available' then
        v_blocked := v_blocked + 1;
        if jsonb_array_length(v_details) < 50 then
          v_details := v_details || jsonb_build_object(
            'question_id', v_qid,
            'kind', 'blocked',
            'message', '전역 노출 상태가 노출 가능이 아니어서 기관 노출에 추가할 수 없습니다.'
          );
        end if;

        insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
        values (
          caller_id,
          'question_institutions_changed',
          'AssessmentQuestion',
          v_qid,
          jsonb_build_object('institution_codes',
            jsonb_build_object('added', '[]'::jsonb, 'removed', '[]'::jsonb)),
          jsonb_build_object(
            'reason', v_reason,
            'batch_id', v_batch_id,
            'blocked', true,
            'blocked_reason', 'global_service_status',
            'service_status', v_service_status,
            'attempted_added', jsonb_build_array(v_code),
            'removed', '[]'::jsonb,
            'bulk', true,
            'mode', 'add',
            'institution_code', v_code
          )
        );
        continue;
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
    'blocked', v_blocked, 'failed', v_failed, 'details', v_details, 'batch_id', v_batch_id
  );
end;
$$;

comment on function public.admin_set_writing_question_institutions(text[], text[], text) is
  'content_admin 전용. 선택 문항 N건의 기관 노출 허용 집합을 set-semantics 로 동기화한다. 신규 기관 추가는 service_status=available 문항에만 허용하며, excluded/internal_test 문항의 기존 매핑 제거는 허용한다. 차단 건은 blocked details와 admin_audit_logs payload.blocked=true로 기록한다.';
comment on function public.admin_add_institution_writing_questions(text, text[], text) is
  'content_admin 전용. 기관 중심 문항 노출 추가. service_status=available 문항만 신규 추가하고, excluded/internal_test 문항은 blocked로 반환하며 매핑을 만들지 않는다. 제거 RPC는 stale 매핑 정리를 위해 상태와 무관하게 허용한다.';
