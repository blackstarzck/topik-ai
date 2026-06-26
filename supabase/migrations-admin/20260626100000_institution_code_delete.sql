-- Users > 기관 코드 삭제 RPC.
-- Deletes the admin-owned institution code catalog row after blocking codes that still
-- have assigned members. Question exposure mappings for the deleted code are removed
-- in the same transaction when the mapping table exists.
-- down: supabase/migrations-admin/down/20260626100000_institution_code_delete.sql

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
      'deleted_exposure_count', v_deleted_exposure_count
    )
  );

  return v_code;
end;
$function$;

revoke all on function public.admin_delete_institution_code(text, text) from public;
grant execute on function public.admin_delete_institution_code(text, text) to authenticated;

comment on function public.admin_delete_institution_code(text, text) is
  'Users > 기관 코드 삭제. 가입 회원이 있는 code는 차단하고, 존재 시 topik_writing_question_institution_exposure 매핑을 함께 제거한 뒤 InstitutionCode 감사 로그를 남긴다.';
