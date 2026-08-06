-- 2단계 서버 권한 정렬 — 2A: 시스템·회원 표면
--
-- 화면은 43개 권한 키로 게이팅하는데 서버는 역할만 검사한다. 이 파일은 시스템·회원
-- 도메인의 조회·조치 RPC 20종을 화면과 같은 키로 정렬하고, 관리자 앱이 직접 읽지
-- 않는 테이블의 우회 조회를 닫는다.
--
-- 강제 형태(오너 확정 2026-08-06): 역할 검사 + 권한 키 검사 **2겹**.
--   `private.is_admin(caller)` 로 콘솔 관리자임을 먼저 확인하고, 그 뒤 권한 키를 본다.
--   기관 관리자(org_admin)에게 실수로 키가 부여돼도 콘솔 표면에는 닿지 않는다.
--   2026-08 트랙(20260805130000·150000)이 만든 키 단독 형태는 이 표준의 예외로 남아
--   있고, 별도 정규화 대상이다(이 파일 범위 밖).
--
-- 방식: 파일 전문 재정의를 쓰지 않는다. 라이브 정의를 읽어 앵커만 치환하고, 각 앵커의
--   발생 횟수를 사전·사후로 단정한다. 전문 재정의는 이후 수술(감사 로그 마스킹 등)을
--   되덮는다 — 2026-08-05 감사 게이트 회귀가 그 실증이다.
--
-- 세 갈래로 나눈다:
--   ① is_admin 전용 14종 → 키 추가(순수 강화. 오늘 통과하던 호출자가 더 막힌다)
--   ② platform 전용 6종 → is_admin + 키(완화-by-design. 오너가 계획에서 확인)
--   ③ 회원 PII 화이트리스트 — ②의 완화에 딸린 필수 조치
--
-- ③ 의 근거: `users.read` 는 카탈로그에서 저위험 키다. 그 키만으로 회원 목록·상세를
--   열면 원문 이메일과 원문 전화번호까지 함께 나간다. 원문 PII 는 **platform_admin
--   또는 `users.export`(고위험 키) 보유자**에게만 반환하고, `users.read` 단독 보유자는
--   마스킹된 값만 본다. 반환값만 NULL 로 만들면 이메일 검색으로 존재 여부를 역추적할
--   수 있으므로 검색 분기도 같은 조건으로 닫는다. 정렬은 마스킹된 투영을 그대로
--   따라가므로 별도 조치가 필요하지 않다.
--   `users.export` 를 원문 열람 조건에 포함하는 이유는 `admin_export_users` 가 내부에서
--   `get_admin_users` 를 호출하기 때문이다 — 제외하면 내보내기 결과의 이메일이 전부
--   NULL 이 되어 키가 무의미해진다.
--
-- 같은 이유로 `get_admin_users` 의 키 검사는 `users.read` **또는** `users.export` 를
--   받는다. `users.export` 는 목록보다 많은 데이터를 반환하는 상위 권한이므로 목록
--   조회를 함의한다. 이 함의가 없으면 `users.export` 단독 보유자가 자기 표면 안에서
--   내부 호출에 막힌다.
--
-- 정책 표면: RPC 만 잠가도 PostgREST 직접 조회로 우회된다(2026-08-05 감사 로그 교훈).
--   관리자 앱이 직접 읽는 3테이블은 키 정책으로 교체하고, 직접 읽지 않는 11테이블은
--   정책을 삭제해 조회 경로를 definer RPC 로 단일화한다. 기존 역할 정책을 남긴 채
--   키 정책을 추가하면 RLS 는 permissive-OR 이므로 아무것도 좁혀지지 않는다.
--
-- down: supabase/migrations-admin/down/20260806120000_admin_permission_alignment_system_users.sql

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- ①②③ 함수 게이트 수술
-- ─────────────────────────────────────────────────────────────────────────────
do $align_system_users$
declare
  -- 라이브 본문과 바이트가 일치해야 하는 앵커 4형태.
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
  v_proc regprocedure;
  v_definition text;
  v_pair jsonb;
  v_old text;
  v_new text;
  v_label text;
  v_key text;
  v_contract text;
  v_count int := 0;
begin
  if to_regprocedure('public.admin_has_permission(uuid,text)') is null then
    raise exception 'permission alignment: public.admin_has_permission(uuid,text) is missing';
  end if;
  if to_regprocedure('private.is_admin(uuid)') is null then
    raise exception 'permission alignment: private.is_admin(uuid) is missing';
  end if;

  v_targets := jsonb_build_array(
    -- ① is_admin 전용 → 키 추가. 한 줄 형태 12종.
    jsonb_build_object('identity', 'public.admin_get_admin(uuid)',
      'key', 'system.admins.manage', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_list_admins(text)',
      'key', 'system.admins.manage', 'shape', 'inline'),
    jsonb_build_object('identity', 'public.admin_list_audit_logs(text,text,text,timestamptz,timestamptz,integer,integer)',
      'key', 'system.audit.read', 'shape', 'inline',
      -- 감사 로그는 platform 마스킹 계약을 반드시 보존한다(2026-08-05 복원분).
      'contract', jsonb_build_array('v_is_platform boolean;',
                                    'v_is_platform := private.is_platform_admin(caller_id);',
                                    'case when v_is_platform then counted.diff else null end')),
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
    -- ① 블록 형태 2종(공백이 다르다).
    jsonb_build_object('identity', 'public.admin_get_user_community_posts(text,integer)',
      'key', 'users.read', 'shape', 'block'),
    jsonb_build_object('identity', 'public.admin_get_user_legal_consents(uuid)',
      'key', 'users.read', 'shape', 'authuid'),
    -- ② platform 전용 → is_admin + 키.
    jsonb_build_object('identity', 'public.admin_delete_system_report(uuid,text)',
      'key', 'system.reports.delete', 'shape', 'platform'),
    jsonb_build_object('identity', 'public.admin_list_admin_app_roles(text)',
      'key', 'system.permissions.manage', 'shape', 'platform'),
    jsonb_build_object('identity', 'public.get_admin_user_learning_overview(uuid)',
      'key', 'users.read', 'shape', 'platform'),
    jsonb_build_object('identity', 'public.admin_export_users(text,boolean,text,text,uuid[],text,text,date,date,text[],text[],text[],text[],text[],text[],text[])',
      'key', 'users.export', 'shape', 'platform'),
    -- ②+③ 회원 목록: 키는 read 또는 export(내부 호출 체인 보존), PII 화이트리스트 동반.
    jsonb_build_object('identity', 'public.get_admin_users(text,text,integer,integer,text)',
      'key', 'users.read', 'shape', 'platform-users-list'),
    -- ②+③ 회원 상세: 원문 이메일·전화 화이트리스트.
    jsonb_build_object('identity', 'public.get_admin_user(uuid)',
      'key', 'users.read', 'shape', 'platform-user-detail')
  );

  for v_target in select value from jsonb_array_elements(v_targets)
  loop
    v_identity := v_target->>'identity';
    v_key := v_target->>'key';
    v_proc := to_regprocedure(v_identity);
    if v_proc is null then
      raise exception 'permission alignment: % is missing', v_identity;
    end if;
    select pg_get_functiondef(v_proc) into v_definition;

    -- 사전 단정: 아직 키 검사가 없어야 한다. 이미 있으면 재실행이 아니라 중단한다
    -- (드리프트 복구와 이 정렬이 겹쳐 이중 검사를 심는 것을 막는다).
    if position('admin_has_permission' in v_definition) > 0 then
      raise exception 'permission alignment: % already carries a permission key', v_identity;
    end if;

    -- 보존해야 할 계약 리터럴이 지금 살아 있는지 확인한다.
    if v_target ? 'contract' then
      for v_contract in select value::text from jsonb_array_elements_text(v_target->'contract')
      loop
        if position(v_contract in v_definition) = 0 then
          raise exception 'permission alignment: contract literal % is missing in %',
            v_contract, v_identity;
        end if;
      end loop;
    end if;

    -- 형태별 치환 쌍을 만든다.
    case v_target->>'shape'
      when 'inline' then
        v_pair := jsonb_build_array(jsonb_build_object(
          'label', 'guard',
          'old', v_role_inline,
          'new', v_role_inline || format(
            E'\n  if not public.admin_has_permission(caller_id, %L) then raise exception %L; end if;',
            v_key, 'forbidden: missing permission ' || v_key)));
      when 'block' then
        v_pair := jsonb_build_array(jsonb_build_object(
          'label', 'guard',
          'old', v_role_block,
          'new', v_role_block || format(
            E'\n  if not public.admin_has_permission(caller_id, %L) then\n    raise exception %L;\n  end if;',
            v_key, 'forbidden: missing permission ' || v_key)));
      when 'authuid' then
        v_pair := jsonb_build_array(jsonb_build_object(
          'label', 'guard',
          'old', v_role_authuid,
          'new', v_role_authuid || format(
            E'\n  if not public.admin_has_permission(auth.uid(), %L) then\n    raise exception %L;\n  end if;',
            v_key, 'forbidden: missing permission ' || v_key)));
      when 'platform' then
        v_pair := jsonb_build_array(jsonb_build_object(
          'label', 'guard',
          'old', v_platform_block,
          'new', v_role_block || format(
            E'\n  if not public.admin_has_permission(caller_id, %L) then\n    raise exception %L;\n  end if;',
            v_key, 'forbidden: missing permission ' || v_key)));
      when 'platform-users-list' then
        v_pair := jsonb_build_array(
          jsonb_build_object(
            'label', 'guard',
            'old', v_platform_block,
            -- users.export 는 목록보다 많은 데이터를 반환하는 상위 권한이므로 목록을 함의한다.
            'new', v_role_block
              || E'\n  if not (public.admin_has_permission(caller_id, \'users.read\')'
              || E'\n          or public.admin_has_permission(caller_id, \'users.export\')) then'
              || E'\n    raise exception \'forbidden: missing permission users.read\';'
              || E'\n  end if;'),
          jsonb_build_object(
            'label', 'declare-pii',
            'old', v_declare_old,
            'new', v_declare_old
              || E'\n  v_pii boolean := private.is_platform_admin(caller_id)'
              || E'\n    or public.admin_has_permission(caller_id, \'users.export\');'),
          jsonb_build_object(
            'label', 'email-projection',
            'old', 'u.email::text                           as email,',
            'new', 'case when v_pii then u.email::text else null::text end as email,'),
          jsonb_build_object(
            'label', 'email-search',
            'old', E'         or u.email ilike \'%\' || v_search || \'%\'',
            'new', E'         or (v_pii and u.email ilike \'%\' || v_search || \'%\')')
        );
      when 'platform-user-detail' then
        v_pair := jsonb_build_array(
          jsonb_build_object(
            'label', 'guard',
            'old', v_platform_block,
            'new', v_role_block
              || E'\n  if not public.admin_has_permission(caller_id, \'users.read\') then'
              || E'\n    raise exception \'forbidden: missing permission users.read\';'
              || E'\n  end if;'),
          jsonb_build_object(
            'label', 'declare-pii',
            'old', v_declare_old,
            'new', v_declare_old
              || E'\n  v_pii boolean := private.is_platform_admin(caller_id)'
              || E'\n    or public.admin_has_permission(caller_id, \'users.export\');'),
          jsonb_build_object(
            'label', 'email-projection',
            'old', 'u.email::text                           as email,',
            'new', 'case when v_pii then u.email::text else null::text end as email,'),
          jsonb_build_object(
            'label', 'phone-projection',
            'old', 'private.admin_profile_phone(to_jsonb(p))                                 as phone,',
            'new', 'case when v_pii then private.admin_profile_phone(to_jsonb(p)) else null::text end as phone,')
        );
      else
        raise exception 'permission alignment: unknown shape % for %', v_target->>'shape', v_identity;
    end case;

    -- 앵커는 각 1회여야 한다. 0회면 라이브가 예상과 다르고, 2회 이상이면 어느 쪽을
    -- 고치는지 정의되지 않는다 — 둘 다 조용히 지나가면 안 된다.
    for v_old, v_new, v_label in
      select value->>'old', value->>'new', value->>'label' from jsonb_array_elements(v_pair)
    loop
      if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 then
        raise exception 'permission alignment: anchor % must occur exactly once in %',
          v_label, v_identity;
      end if;
      v_definition := replace(v_definition, v_old, v_new);
    end loop;

    -- 사후 단정: 키 검사가 정확히 들어갔고 계약 리터럴이 살아 있다.
    if position(format('admin_has_permission(caller_id, %L)', v_key) in v_definition) = 0
       and position(format('admin_has_permission(auth.uid(), %L)', v_key) in v_definition) = 0 then
      raise exception 'permission alignment: key % was not installed in %', v_key, v_identity;
    end if;
    if v_target ? 'contract' then
      for v_contract in select value::text from jsonb_array_elements_text(v_target->'contract')
      loop
        if position(v_contract in v_definition) = 0 then
          raise exception 'permission alignment: contract literal % lost during rewrite of %',
            v_contract, v_identity;
        end if;
      end loop;
    end if;
    -- ② 는 platform 단독 게이트가 사라져야 한다(완화가 실제로 적용됐다는 증거).
    if v_target->>'shape' like 'platform%'
       and position(v_platform_block in v_definition) > 0 then
      raise exception 'permission alignment: platform-only guard survived in %', v_identity;
    end if;

    execute v_definition;
    v_count := v_count + 1;
  end loop;

  if v_count <> jsonb_array_length(v_targets) then
    raise exception 'permission alignment: expected % rewrites, applied %',
      jsonb_array_length(v_targets), v_count;
  end if;
end
$align_system_users$;

-- ─────────────────────────────────────────────────────────────────────────────
-- ④ 정책 전환 — 관리자 앱이 PostgREST 로 직접 읽는 3테이블
--    기존 역할 정책을 남기면 RLS permissive-OR 로 아무것도 좁혀지지 않으므로 교체한다.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists system_logs_admin_select on public.system_logs;
create policy system_logs_permission_select on public.system_logs
  for select to authenticated
  using (
    private.is_admin((select auth.uid()))
    and public.admin_has_permission((select auth.uid()), 'system.logs.read')
  );

drop policy if exists system_metadata_groups_admin_select on public.system_metadata_groups;
create policy system_metadata_groups_permission_select on public.system_metadata_groups
  for select to authenticated
  using (
    private.is_admin((select auth.uid()))
    and public.admin_has_permission((select auth.uid()), 'system.metadata.manage')
  );

drop policy if exists system_metadata_group_items_admin_select on public.system_metadata_group_items;
create policy system_metadata_group_items_permission_select on public.system_metadata_group_items
  for select to authenticated
  using (
    private.is_admin((select auth.uid()))
    and public.admin_has_permission((select auth.uid()), 'system.metadata.manage')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- ⑤ 정책 삭제 — 관리자 앱이 직접 읽지 않는 11테이블(조회는 definer RPC 단일 경로)
--    `.from('<table>')` 전수 조사에서 브라우저 코드의 직접 접근이 없음을 확인했다.
--    admin_accounts 는 서버 API 4곳이 읽지만 전부 service_role 클라이언트라 RLS 를
--    우회하고, 세션 부트스트랩 admin_get_self 는 definer 다 — 로그인 경로 무영향.
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists admin_accounts_admin_select on public.admin_accounts;
drop policy if exists admin_permission_grants_admin_select on public.admin_permission_grants;
drop policy if exists instructors_admin_select on public.instructors;
drop policy if exists instructor_admin_notes_admin_select on public.instructor_admin_notes;
drop policy if exists referrals_admin_select on public.referrals;
drop policy if exists referral_relations_admin_select on public.referral_relations;
drop policy if exists referral_reward_ledgers_admin_select on public.referral_reward_ledgers;
drop policy if exists user_access_logs_admin_select on public.user_access_logs;
drop policy if exists user_activity_events_admin_select on public.user_activity_events;
drop policy if exists user_payment_records_admin_select on public.user_payment_records;
drop policy if exists user_admin_memos_admin_select on public.user_admin_memos;

comment on table public.admin_accounts is
  '관리자 계정 원장(topik-ai admin 운영 도메인 소유). 직접 SELECT 정책을 두지 않는다 — 조회는 admin_get_self·admin_list_admins·admin_get_admin definer RPC 단일 경로이고, 서버 API 는 service_role 로 접근한다(2026-08-06).';

comment on table public.admin_permission_grants is
  '관리자 권한 부여 원장. 직접 SELECT 정책을 두지 않는다 — 유효 권한은 admin_get_self 가, 관리자별 목록은 admin_get_admin 이 반환한다. 쓰기는 platform_admin 전용 definer RPC 단일 경로다(2026-08-06).';

-- 정렬된 함수의 계약을 주석에 각인한다(다음 수술이 무엇을 보존해야 하는지 남긴다).
comment on function public.get_admin_users(text, text, integer, integer, text) is
  'Users > 회원 목록 조회. users.read 또는 users.export 권한 전용(is_admin + admin_has_permission 2겹). '
  '원문 이메일은 platform_admin 또는 users.export 보유자에게만 반환하고 이메일 검색 분기도 같은 조건이다 — '
  '반환값만 가리면 검색으로 존재 여부를 역추적할 수 있다. 전화번호는 항상 마스킹된 phone_masked 만 반환한다. '
  'users.export 를 함의 조건에 넣은 이유는 admin_export_users 가 이 함수를 내부 호출하기 때문이다.';

comment on function public.get_admin_user(uuid) is
  'Users > 회원 상세 조회. users.read 권한 전용(is_admin + admin_has_permission 2겹). '
  '원문 이메일과 원문 전화(phone)는 platform_admin 또는 users.export 보유자에게만 반환하며, '
  '그 외 관리자는 phone_masked 만 본다.';

comment on function public.admin_export_users(
  text, boolean, text, text, uuid[], text, text, date, date, text[], text[], text[], text[], text[], text[], text[]
) is
  'Users > 회원 정보 내보내기. users.export 권한 전용(is_admin + admin_has_permission 2겹, 고위험 키). '
  '내부에서 get_admin_users 를 호출하므로 그 함수의 키 검사가 users.export 를 함의해야 이 경로가 성립한다.';

comment on function public.admin_list_audit_logs(
  text, text, text, timestamptz, timestamptz, integer, integer
) is
  'System > 감사 로그 조회. system.audit.read 권한 전용(is_admin + admin_has_permission 2겹). '
  'diff/payload 와 payload 키워드 검색은 그 위에서 다시 platform_admin 에게만 허용한다(오너 결정 2026-06-18, 2026-08-05 복원). '
  '원본 테이블 직접 조회는 platform_admin 전용 정책으로 막혀 있으므로 일반 관리자의 유일한 조회 경로는 이 RPC 다.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ⑥ 사후 검증 — 라이브 상태를 다시 읽어 두 표면이 모두 정렬됐는지 확인한다.
-- ─────────────────────────────────────────────────────────────────────────────
do $verify_alignment$
declare
  v_expected constant jsonb := jsonb_build_object(
    'public.admin_get_admin(uuid)', 'system.admins.manage',
    'public.admin_list_admins(text)', 'system.admins.manage',
    'public.admin_list_audit_logs(text,text,text,timestamptz,timestamptz,integer,integer)', 'system.audit.read',
    'public.admin_get_instructor(text)', 'users.groups.manage',
    'public.admin_list_instructors(text,text,text,text,text)', 'users.groups.manage',
    'public.admin_list_referrals(text,text,text)', 'users.referrals.manage',
    'public.admin_list_user_memos(text)', 'users.read',
    'public.admin_get_user_access_logs(uuid,integer)', 'users.read',
    'public.admin_get_user_activity(uuid,integer)', 'users.read',
    'public.admin_get_user_payment_history(uuid,integer)', 'users.read',
    'public.admin_get_user_payments(uuid,integer)', 'users.read',
    'public.admin_get_user_study_events(uuid,integer)', 'users.read',
    'public.admin_get_user_community_posts(text,integer)', 'users.read',
    'public.admin_get_user_legal_consents(uuid)', 'users.read',
    'public.admin_delete_system_report(uuid,text)', 'system.reports.delete',
    'public.admin_list_admin_app_roles(text)', 'system.permissions.manage',
    'public.get_admin_user_learning_overview(uuid)', 'users.read',
    'public.get_admin_users(text,text,integer,integer,text)', 'users.read',
    'public.get_admin_user(uuid)', 'users.read'
  );
  v_identity text;
  v_key text;
  v_definition text;
  v_proc regprocedure;
  v_policies int;
begin
  for v_identity, v_key in select key, value from jsonb_each_text(v_expected)
  loop
    v_proc := to_regprocedure(v_identity);
    if v_proc is null then
      raise exception 'alignment verify: % is missing', v_identity;
    end if;
    select pg_get_functiondef(v_proc) into v_definition;
    if position(format('admin_has_permission(caller_id, %L)', v_key) in v_definition) = 0
       and position(format('admin_has_permission(auth.uid(), %L)', v_key) in v_definition) = 0 then
      raise exception 'alignment verify: % does not check %', v_identity, v_key;
    end if;
    -- 2겹 형태: 역할 검사가 함께 살아 있어야 한다(오너 확정 강제 형태).
    if position('private.is_admin(' in v_definition) = 0 then
      raise exception 'alignment verify: % lost its role check', v_identity;
    end if;
    -- anon 실행 권한이 붙어 있으면 게이트가 무의미하다.
    if has_function_privilege('anon', v_proc, 'execute') then
      raise exception 'alignment verify: anon can execute %', v_identity;
    end if;
  end loop;

  -- 감사 로그 마스킹 계약(2026-08-05 복원분)이 이 정렬에 되덮이지 않았는지.
  select pg_get_functiondef(to_regprocedure(
    'public.admin_list_audit_logs(text,text,text,timestamptz,timestamptz,integer,integer)'
  )) into v_definition;
  if position('v_is_platform := private.is_platform_admin(caller_id);' in v_definition) = 0
     or (length(v_definition) - length(replace(v_definition, 'case when v_is_platform then counted.', '')))
        / length('case when v_is_platform then counted.') <> 2 then
    raise exception 'alignment verify: audit masking contract lost';
  end if;

  -- 회원 PII 화이트리스트가 두 함수에 모두 들어갔는지.
  foreach v_identity in array array[
    'public.get_admin_users(text,text,integer,integer,text)',
    'public.get_admin_user(uuid)'
  ]
  loop
    select pg_get_functiondef(to_regprocedure(v_identity)) into v_definition;
    if position('v_pii boolean := private.is_platform_admin(caller_id)' in v_definition) = 0
       or position('case when v_pii then u.email::text else null::text end' in v_definition) = 0 then
      raise exception 'alignment verify: PII whitelist missing in %', v_identity;
    end if;
  end loop;

  select pg_get_functiondef(to_regprocedure('public.get_admin_users(text,text,integer,integer,text)'))
    into v_definition;
  if position('(v_pii and u.email ilike' in v_definition) = 0 then
    raise exception 'alignment verify: email search gate missing in get_admin_users';
  end if;

  select pg_get_functiondef(to_regprocedure('public.get_admin_user(uuid)')) into v_definition;
  if position('case when v_pii then private.admin_profile_phone(to_jsonb(p)) else null::text end'
              in v_definition) = 0 then
    raise exception 'alignment verify: raw phone gate missing in get_admin_user';
  end if;

  -- 정책 표면: 전환 3테이블은 키 정책 1개씩, 삭제 11테이블은 정책 0개.
  foreach v_identity in array array['system_logs', 'system_metadata_groups', 'system_metadata_group_items']
  loop
    select count(*) into v_policies
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = v_identity and pol.polcmd = 'r'
      and pg_get_expr(pol.polqual, pol.polrelid) like '%admin_has_permission%';
    if v_policies <> 1 then
      raise exception 'alignment verify: % must have exactly one key-based select policy, found %',
        v_identity, v_policies;
    end if;
  end loop;

  foreach v_identity in array array[
    'admin_accounts', 'admin_permission_grants', 'instructors', 'instructor_admin_notes',
    'referrals', 'referral_relations', 'referral_reward_ledgers', 'user_access_logs',
    'user_activity_events', 'user_payment_records', 'user_admin_memos'
  ]
  loop
    select count(*) into v_policies
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = v_identity;
    if v_policies <> 0 then
      raise exception 'alignment verify: % still exposes % policy(ies) — direct read must be closed',
        v_identity, v_policies;
    end if;
  end loop;
end
$verify_alignment$;

commit;
