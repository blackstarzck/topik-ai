-- Rollback: restore admin_delete_institution_code to the 20260707140000 definition.
-- The institution exposure mode table remains intact; this rollback only removes the
-- code-deletion cleanup introduced by the matching forward migration.

create or replace function public.admin_set_institution_exposure_mode(
  p_code text,
  p_mode text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  caller_id uuid := auth.uid();
  v_code   text := btrim(coalesce(p_code, ''));
  v_mode   text := btrim(coalesce(p_mode, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_old    text;
  v_assigned bigint;
  v_population record;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not private.admin_has_permission(caller_id, 'users.institution-codes.manage') then
    raise exception 'forbidden: missing permission users.institution-codes.manage';
  end if;
  if v_code = '' then raise exception 'code required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if v_mode not in ('제한 없음', '배정분만') then
    raise exception 'invalid exposure mode: %', v_mode;
  end if;
  if not exists (select 1 from public.institution_codes c where c.code = v_code) then
    raise exception 'unknown code: %', v_code;
  end if;

  select m.exposure_mode
    into v_old
    from public.topik_writing_institution_exposure_mode m
   where m.institution_code = v_code
   for update;

  -- 행이 없으면 현재 유효값은 기본값이다.
  v_old := coalesce(v_old, '배정분만');
  if v_old = v_mode then
    return v_code;  -- 변경 없음 — 감사 행을 남기지 않는다(모달이 항상 호출해도 안전).
  end if;

  insert into public.topik_writing_institution_exposure_mode (
    institution_code, exposure_mode, reason, changed_by, updated_at
  ) values (
    v_code, v_mode, v_reason, caller_id, now()
  )
  on conflict (institution_code) do update set
    exposure_mode = excluded.exposure_mode,
    reason = excluded.reason,
    changed_by = excluded.changed_by,
    updated_at = now();

  select count(*)
    into v_assigned
    from public.topik_writing_question_institution_exposure e
   where e.institution_code = v_code;

  select *
    into v_population
    from private.institution_learner_population(v_code);

  insert into public.admin_audit_logs (
    admin_user_id, action, target_table, target_id, diff, payload
  ) values (
    caller_id,
    'institution_exposure_mode_changed',
    'InstitutionCode',
    v_code,
    jsonb_build_object('exposure_mode', jsonb_build_object('from', v_old, 'to', v_mode)),
    jsonb_build_object(
      'reason', v_reason,
      'code', v_code,
      'assignment_count', v_assigned,
      'member_count', v_population.member_count,
      'pending_invitation_count', v_population.pending_invitation_count
    )
  );

  return v_code;
end;
$$;

revoke all on function public.admin_set_institution_exposure_mode(text, text, text) from public;
revoke all on function public.admin_set_institution_exposure_mode(text, text, text) from anon;
grant execute on function public.admin_set_institution_exposure_mode(text, text, text) to authenticated;

comment on function public.admin_set_institution_exposure_mode(text, text, text) is
  '기관 코드의 쓰기 문항 노출 모드를 변경한다(사유 필수, platform 권한 users.institution-codes.manage). 값이 그대로면 감사 행 없이 조기 반환한다. 배정 0건 + 회원/대기초대 있는 상태로 `배정분만` 전환은 모드 테이블 트리거가 거부한다. 감사 action = institution_exposure_mode_changed, Target = InstitutionCode + code. 2026-08-01.';

create or replace function public.admin_delete_institution_code(
  p_code text,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  caller_id uuid := auth.uid();
  v_code text := btrim(coalesce(p_code, ''));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_old public.institution_codes%rowtype;
  v_member_count bigint := 0;
  v_deleted_exposure_count bigint := 0;
  v_canceled_invitation_count bigint := 0;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.institution-codes.manage') then
    raise exception 'forbidden: missing permission users.institution-codes.manage';
  end if;
  if v_code = '' then raise exception 'code required'; end if;
  if v_reason is null then raise exception 'reason required'; end if;

  select * into v_old
    from public.institution_codes
   where code = v_code
   for update;
  if not found then raise exception 'unknown code: %', v_code; end if;

  select count(*) into v_member_count
    from public.profiles p
   where p.affiliation_code = v_code;

  if v_member_count > 0 then
    raise exception 'cannot delete institution code with assigned members: %', v_member_count;
  end if;

  update public.institution_code_invitations
     set status = 'canceled', responded_at = now()
   where code = v_code and status = 'pending';
  get diagnostics v_canceled_invitation_count = row_count;

  if to_regclass('public.topik_writing_question_institution_exposure') is not null then
    execute 'delete from public.topik_writing_question_institution_exposure where institution_code = $1'
      using v_code;
    get diagnostics v_deleted_exposure_count = row_count;
  end if;

  delete from public.institution_codes
   where code = v_code;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'institution_code_deleted',
    'InstitutionCode',
    v_code,
    jsonb_build_object('deleted', jsonb_build_object('from', false, 'to', true)),
    jsonb_build_object(
      'reason', v_reason,
      'label', v_old.label,
      'kind', v_old.kind,
      'status', v_old.status,
      'note', v_old.note,
      'member_count', v_member_count,
      'deleted_exposure_count', v_deleted_exposure_count,
      'canceled_invitation_count', v_canceled_invitation_count
    )
  );

  return v_code;
end;
$function$;

revoke all on function public.admin_delete_institution_code(text, text) from public;
revoke all on function public.admin_delete_institution_code(text, text) from anon;
grant execute on function public.admin_delete_institution_code(text, text) to authenticated;

comment on function public.admin_delete_institution_code(text, text) is
  'Users > 기관 코드 삭제. 가입 회원이 있는 code는 차단, pending 초대는 일괄 canceled, 존재 시 topik_writing_question_institution_exposure 매핑 제거 후 InstitutionCode 감사 로그.';
