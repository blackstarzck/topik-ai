-- down: 2단계 2A 시스템·회원 권한 정렬 원복
--
-- 🚨 이 원복은 보안 완화다. 관리자 표면 20종이 권한 키 검사를 잃고 "관리자면 통과"로
--    돌아가며, 직접 조회를 닫은 11테이블이 다시 열리고, 회원 원문 이메일·전화가
--    권한 키 없이 노출된다. 운영 실행은 별도 승인 후에만.
--
-- ② 로 완화했던 6종은 원래의 platform 전용으로 되돌린다(원복이 완화를 남기지 않는다).
-- ③ 의 PII 화이트리스트는 선언·투영·검색 앵커를 역방향으로 제거한다.
-- 감사 로그의 platform 마스킹(2026-08-05 복원분)은 이 파일이 건드리지 않는다 — 사후
--    단정으로 생존을 확인한다.
--
-- forward: supabase/migrations-admin/20260806120000_admin_permission_alignment_system_users.sql

begin;

do $revert_system_users$
declare
  v_role_inline constant text :=
    $anchor$if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;$anchor$;
  v_role_block constant text := $anchor$if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;$anchor$;
  v_role_authuid constant text := $anchor$if not private.is_admin(auth.uid()) then
    raise exception 'forbidden: admin required';
  end if;$anchor$;
  v_platform_block constant text := $anchor$if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;$anchor$;
  v_declare_old constant text := $anchor$declare
  caller_id uuid := auth.uid();$anchor$;

  v_targets jsonb;
  v_target jsonb;
  v_identity text;
  v_key text;
  v_proc regprocedure;
  v_definition text;
  v_pair jsonb;
  v_old text;
  v_new text;
  v_label text;
  v_count int := 0;
begin
  v_targets := jsonb_build_array(
    jsonb_build_object('identity', 'public.admin_get_admin(uuid)',
      'key', 'system.admins.manage', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_list_admins(text)',
      'key', 'system.admins.manage', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_list_audit_logs(text,text,text,timestamptz,timestamptz,integer,integer)',
      'key', 'system.audit.read', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_get_instructor(text)',
      'key', 'users.groups.manage', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_list_instructors(text,text,text,text,text)',
      'key', 'users.groups.manage', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_list_referrals(text,text,text)',
      'key', 'users.referrals.manage', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_list_user_memos(text)',
      'key', 'users.read', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_get_user_access_logs(uuid,integer)',
      'key', 'users.read', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_get_user_activity(uuid,integer)',
      'key', 'users.read', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_get_user_payment_history(uuid,integer)',
      'key', 'users.read', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_get_user_payments(uuid,integer)',
      'key', 'users.read', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_get_user_study_events(uuid,integer)',
      'key', 'users.read', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_get_user_community_posts(text,integer)',
      'key', 'users.read', 'shape', 'block'),
    jsonb_build_object('identity', 'public.admin_get_user_legal_consents(uuid)',
      'key', 'users.read', 'shape', 'authuid'),
    jsonb_build_object('identity', 'public.admin_delete_system_report(uuid,text)',
      'key', 'system.reports.delete', 'shape', 'platform'),
    jsonb_build_object('identity', 'public.admin_list_admin_app_roles(text)',
      'key', 'system.permissions.manage', 'shape', 'platform'),
    jsonb_build_object('identity', 'public.get_admin_user_learning_overview(uuid)',
      'key', 'users.read', 'shape', 'platform'),
    jsonb_build_object('identity', 'public.admin_export_users(text,boolean,text,text,uuid[],text,text,date,date,text[],text[],text[],text[],text[],text[],text[])',
      'key', 'users.export', 'shape', 'platform'),
    jsonb_build_object('identity', 'public.get_admin_users(text,text,integer,integer,text)',
      'key', 'users.read', 'shape', 'platform-users-list'),
    jsonb_build_object('identity', 'public.get_admin_user(uuid)',
      'key', 'users.read', 'shape', 'platform-user-detail')
  );

  for v_target in select value from jsonb_array_elements(v_targets)
  loop
    v_identity := v_target->>'identity';
    v_key := v_target->>'key';
    v_proc := to_regprocedure(v_identity);
    if v_proc is null then
      raise exception 'alignment revert: % is missing', v_identity;
    end if;
    select pg_get_functiondef(v_proc) into v_definition;

    -- 사전 단정: forward 가 적용된 상태여야 한다.
    if position('admin_has_permission' in v_definition) = 0 then
      raise exception 'alignment revert: % does not carry a permission key', v_identity;
    end if;

    -- forward 의 치환을 역방향으로 만든다(new → old).
    case v_target->>'shape'
      when 'inline' then
        v_pair := jsonb_build_array(jsonb_build_object(
          'label', 'guard',
          'old', v_role_inline || format(
            E'\n  if not public.admin_has_permission(caller_id, %L) then raise exception %L; end if;',
            v_key, 'forbidden: missing permission ' || v_key),
          'new', v_role_inline));
      when 'block' then
        v_pair := jsonb_build_array(jsonb_build_object(
          'label', 'guard',
          'old', v_role_block || format(
            E'\n  if not public.admin_has_permission(caller_id, %L) then\n    raise exception %L;\n  end if;',
            v_key, 'forbidden: missing permission ' || v_key),
          'new', v_role_block));
      when 'authuid' then
        v_pair := jsonb_build_array(jsonb_build_object(
          'label', 'guard',
          'old', v_role_authuid || format(
            E'\n  if not public.admin_has_permission(auth.uid(), %L) then\n    raise exception %L;\n  end if;',
            v_key, 'forbidden: missing permission ' || v_key),
          'new', v_role_authuid));
      when 'platform' then
        v_pair := jsonb_build_array(jsonb_build_object(
          'label', 'guard',
          'old', v_role_block || format(
            E'\n  if not public.admin_has_permission(caller_id, %L) then\n    raise exception %L;\n  end if;',
            v_key, 'forbidden: missing permission ' || v_key),
          'new', v_platform_block));
      when 'platform-users-list' then
        v_pair := jsonb_build_array(
          jsonb_build_object(
            'label', 'guard',
            'old', v_role_block
              || E'\n  if not (public.admin_has_permission(caller_id, \'users.read\')'
              || E'\n          or public.admin_has_permission(caller_id, \'users.export\')) then'
              || E'\n    raise exception \'forbidden: missing permission users.read\';'
              || E'\n  end if;',
            'new', v_platform_block),
          jsonb_build_object(
            'label', 'declare-pii',
            'old', v_declare_old
              || E'\n  v_pii boolean := private.is_platform_admin(caller_id)'
              || E'\n    or public.admin_has_permission(caller_id, \'users.export\');',
            'new', v_declare_old),
          jsonb_build_object(
            'label', 'email-projection',
            'old', 'case when v_pii then u.email::text else null::text end as email,',
            'new', 'u.email::text                           as email,'),
          jsonb_build_object(
            'label', 'email-search',
            'old', E'         or (v_pii and u.email ilike \'%\' || v_search || \'%\')',
            'new', E'         or u.email ilike \'%\' || v_search || \'%\'')
        );
      when 'platform-user-detail' then
        v_pair := jsonb_build_array(
          jsonb_build_object(
            'label', 'guard',
            'old', v_role_block
              || E'\n  if not public.admin_has_permission(caller_id, \'users.read\') then'
              || E'\n    raise exception \'forbidden: missing permission users.read\';'
              || E'\n  end if;',
            'new', v_platform_block),
          jsonb_build_object(
            'label', 'declare-pii',
            'old', v_declare_old
              || E'\n  v_pii boolean := private.is_platform_admin(caller_id)'
              || E'\n    or public.admin_has_permission(caller_id, \'users.export\');',
            'new', v_declare_old),
          jsonb_build_object(
            'label', 'email-projection',
            'old', 'case when v_pii then u.email::text else null::text end as email,',
            'new', 'u.email::text                           as email,'),
          jsonb_build_object(
            'label', 'phone-projection',
            'old', 'case when v_pii then private.admin_profile_phone(to_jsonb(p)) else null::text end as phone,',
            'new', 'private.admin_profile_phone(to_jsonb(p))                                 as phone,')
        );
      else
        raise exception 'alignment revert: unknown shape % for %', v_target->>'shape', v_identity;
    end case;

    for v_old, v_new, v_label in
      select value->>'old', value->>'new', value->>'label' from jsonb_array_elements(v_pair)
    loop
      if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 then
        raise exception 'alignment revert: anchor % must occur exactly once in %', v_label, v_identity;
      end if;
      v_definition := replace(v_definition, v_old, v_new);
    end loop;

    if position('admin_has_permission' in v_definition) > 0 then
      raise exception 'alignment revert: permission key survived in %', v_identity;
    end if;

    execute v_definition;
    v_count := v_count + 1;
  end loop;

  if v_count <> jsonb_array_length(v_targets) then
    raise exception 'alignment revert: expected % reverts, applied %',
      jsonb_array_length(v_targets), v_count;
  end if;

  -- 감사 로그 마스킹(별도 결정)이 이 원복에 휩쓸리지 않았는지.
  select pg_get_functiondef(to_regprocedure(
    'public.admin_list_audit_logs(text,text,text,timestamptz,timestamptz,integer,integer)'
  )) into v_definition;
  if position('v_is_platform := private.is_platform_admin(caller_id);' in v_definition) = 0 then
    raise exception 'alignment revert: audit masking contract lost';
  end if;
end
$revert_system_users$;

-- 정책 전환 원복
drop policy if exists system_logs_permission_select on public.system_logs;
create policy system_logs_admin_select on public.system_logs
  for select to authenticated using (private.is_admin((select auth.uid())));

drop policy if exists system_metadata_groups_permission_select on public.system_metadata_groups;
create policy system_metadata_groups_admin_select on public.system_metadata_groups
  for select to authenticated using (private.is_admin((select auth.uid())));

drop policy if exists system_metadata_group_items_permission_select on public.system_metadata_group_items;
create policy system_metadata_group_items_admin_select on public.system_metadata_group_items
  for select to authenticated using (private.is_admin((select auth.uid())));

-- 정책 삭제 원복(직접 조회를 다시 연다 — 완화)
create policy admin_accounts_admin_select on public.admin_accounts
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy admin_permission_grants_admin_select on public.admin_permission_grants
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy instructors_admin_select on public.instructors
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy instructor_admin_notes_admin_select on public.instructor_admin_notes
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy referrals_admin_select on public.referrals
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy referral_relations_admin_select on public.referral_relations
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy referral_reward_ledgers_admin_select on public.referral_reward_ledgers
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy user_access_logs_admin_select on public.user_access_logs
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy user_activity_events_admin_select on public.user_activity_events
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy user_payment_records_admin_select on public.user_payment_records
  for select to authenticated using (private.is_admin((select auth.uid())));
create policy user_admin_memos_admin_select on public.user_admin_memos
  for select to authenticated using (private.is_admin((select auth.uid())));

commit;
