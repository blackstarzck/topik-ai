-- down: 감사 로그 민감정보 보호를 원복한다.
--
-- 🚨 이 원복은 보안 완화다. 실행하면 ①조회 RPC 가 diff/payload 를 전체 관리자에게 반환하고
--   ②원본 테이블 직접 조회가 다시 열려 RPC 마스킹이 무의미해지며 ③관리자가 자기 이름으로
--   임의 감사 기록을 만들 수 있는 직접 INSERT 경로가 되살아난다. 오너 결정(2026-06-18)을
--   되돌리는 것이므로 운영 실행은 별도 승인 후에만.
-- 목적은 마이그레이션 왕복 검증과, 이 파일이 만든 변경만 정확히 되돌릴 수 있음을 증명하는 것이다.

begin;

do $revert_audit_gate$
declare
  v_identity constant text :=
    'public.admin_list_audit_logs(text,text,text,timestamptz,timestamptz,integer,integer)';
  v_declare_new constant text := $anchor$declare
  caller_id uuid := auth.uid();
  v_is_platform boolean;$anchor$;
  v_declare_old constant text := $anchor$declare
  caller_id uuid := auth.uid();$anchor$;
  v_guard_new constant text :=
    $anchor$  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  v_is_platform := private.is_platform_admin(caller_id);$anchor$;
  v_guard_old constant text :=
    $anchor$  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;$anchor$;
  v_keyword_new constant text := $anchor$        or (v_is_platform and l.payload::text ilike '%' || v_keyword || '%')$anchor$;
  v_keyword_old constant text := $anchor$        or l.payload::text ilike '%' || v_keyword || '%'$anchor$;
  v_select_new constant text := $anchor$    case when v_is_platform then counted.diff else null end,
    case when v_is_platform then counted.payload else null end,$anchor$;
  v_select_old constant text := $anchor$    counted.diff,
    counted.payload,$anchor$;
  v_proc regprocedure;
  v_definition text;
  v_pairs constant jsonb := jsonb_build_array(
    jsonb_build_object('old', v_declare_new, 'new', v_declare_old, 'label', 'declare'),
    jsonb_build_object('old', v_guard_new, 'new', v_guard_old, 'label', 'guard'),
    jsonb_build_object('old', v_keyword_new, 'new', v_keyword_old, 'label', 'keyword-search'),
    jsonb_build_object('old', v_select_new, 'new', v_select_old, 'label', 'select-list')
  );
  v_pair jsonb;
  v_old text;
  v_new text;
begin
  v_proc := to_regprocedure(v_identity);
  if v_proc is null then
    raise exception 'audit gate revert: % is missing', v_identity;
  end if;

  select pg_get_functiondef(v_proc) into v_definition;

  if position('v_is_platform' in v_definition) = 0 then
    raise exception 'audit gate revert: % does not carry the platform gate', v_identity;
  end if;

  for v_pair in select value from jsonb_array_elements(v_pairs)
  loop
    v_old := v_pair->>'old';
    v_new := v_pair->>'new';
    if (length(v_definition) - length(replace(v_definition, v_old, ''))) / length(v_old) <> 1 then
      raise exception 'audit gate revert: anchor % must occur exactly once in %',
        v_pair->>'label', v_identity;
    end if;
    v_definition := replace(v_definition, v_old, v_new);
  end loop;

  if position('v_is_platform' in v_definition) > 0 then
    raise exception 'audit gate revert: rewrite incomplete for %', v_identity;
  end if;
  if position('lower(counted.target_table) in (''user'', ''users'')' in v_definition) = 0
     or position('left join public.admin_accounts a on a.id = l.admin_user_id' in v_definition) = 0 then
    raise exception 'audit gate revert: projection/actor contract lost during rewrite of %', v_identity;
  end if;

  execute v_definition;
end
$revert_audit_gate$;

revoke all on function public.admin_list_audit_logs(
  text, text, text, timestamptz, timestamptz, integer, integer
) from public, anon;
grant execute on function public.admin_list_audit_logs(
  text, text, text, timestamptz, timestamptz, integer, integer
) to authenticated;

comment on function public.admin_list_audit_logs(
  text, text, text, timestamptz, timestamptz, integer, integer
) is
  'Lists admin audit logs. Persisted User targets accept User/Users filters and are projected as Users for the admin UI contract.';

-- 원본 테이블 정책 원복(20260520121100 형태).
drop policy if exists admin_audit_logs_platform_select on public.admin_audit_logs;
create policy admin_audit_logs_admin_select on public.admin_audit_logs
  for select to authenticated using (private.is_admin((select auth.uid())));

create policy admin_audit_logs_admin_insert on public.admin_audit_logs
  for insert to authenticated
  with check (
    private.is_admin((select auth.uid()))
    and admin_user_id = (select auth.uid())
  );

comment on table public.admin_audit_logs is null;

do $verify_audit_revert$
declare
  v_proc regprocedure := to_regprocedure(
    'public.admin_list_audit_logs(text,text,text,timestamptz,timestamptz,integer,integer)'
  );
  v_definition text;
begin
  if v_proc is null then
    raise exception 'audit revert verify: read RPC is missing';
  end if;

  select pg_get_functiondef(v_proc) into v_definition;
  if position('v_is_platform' in v_definition) > 0 then
    raise exception 'audit revert verify: platform gate survived in the read RPC';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_audit_logs'
      and policyname = 'admin_audit_logs_admin_select'
  ) then
    raise exception 'audit revert verify: original select policy was not restored';
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'admin_audit_logs'
      and policyname = 'admin_audit_logs_admin_insert'
  ) then
    raise exception 'audit revert verify: original insert policy was not restored';
  end if;
end
$verify_audit_revert$;

commit;
