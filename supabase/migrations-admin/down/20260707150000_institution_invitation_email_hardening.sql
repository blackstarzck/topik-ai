-- down: restore respond_institution_invitation (20260707141000 원본 — 이메일 skip 없음)
--       and admin_list_institution_invitations (20260707140000 원본 — 이메일 상태 컬럼 없음).

create or replace function public.respond_institution_invitation(
  p_invitation_id uuid,
  p_accept        boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id      uuid := auth.uid();
  v_row          public.institution_code_invitations%rowtype;
  v_label        text;
  v_code_status  text;
  v_old          text;
  v_profile_stat text;
  v_persisted    text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if p_invitation_id is null then raise exception 'invitation id required'; end if;
  if p_accept is null then raise exception 'accept flag required'; end if;

  select * into v_row
    from public.institution_code_invitations
   where id = p_invitation_id
   for update;
  if not found then raise exception 'unknown invitation: %', p_invitation_id; end if;
  if v_row.user_id <> caller_id then
    raise exception 'forbidden: not invitation owner' using errcode = '42501';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'invitation already responded: %', v_row.status;
  end if;

  select label, status into v_label, v_code_status
    from public.institution_codes where code = v_row.code;

  if not p_accept then
    update public.institution_code_invitations
       set status = 'declined', responded_at = now()
     where id = v_row.id;

    insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
    values (
      caller_id,
      'institution_code_invitation_declined',
      'User',
      caller_id::text,
      jsonb_build_object('invitation_status', jsonb_build_object('from', 'pending', 'to', 'declined')),
      jsonb_build_object('code', v_row.code, 'code_label', v_label, 'invitation_id', v_row.id)
    );

    return jsonb_build_object('status', 'declined', 'code', v_row.code, 'code_label', v_label);
  end if;

  if v_code_status is null or v_code_status <> '활성' then
    update public.institution_code_invitations
       set status = 'canceled', responded_at = now()
     where id = v_row.id;
    return jsonb_build_object('status', 'canceled', 'error', 'code_inactive',
                              'code', v_row.code, 'code_label', v_label);
  end if;

  select p.affiliation_code, p.status into v_old, v_profile_stat
    from public.profiles p
   where p.id = caller_id
   for update of p;
  if not found then raise exception 'profile not found'; end if;
  if v_profile_stat = 'deleted' then
    raise exception 'forbidden: profile deleted' using errcode = '42501';
  end if;

  perform set_config('app.claim_affiliation_code', '1', true);

  update public.profiles
     set affiliation_code = v_row.code
   where id = caller_id
  returning affiliation_code into v_persisted;

  if v_persisted is distinct from v_row.code then
    raise exception
      'affiliation_code write suppressed (persisted=%, expected=%); protect_profile_columns may no longer honor app.claim_affiliation_code',
      v_persisted, v_row.code using errcode = '42501';
  end if;

  update public.institution_code_invitations
     set status = 'accepted', responded_at = now()
   where id = v_row.id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'institution_code_invitation_accepted',
    'User',
    caller_id::text,
    jsonb_build_object('affiliation_code', jsonb_build_object('from', v_old, 'to', v_row.code)),
    jsonb_build_object('code', v_row.code, 'code_label', v_label,
                       'invitation_id', v_row.id, 'prev_code', v_old)
  );

  return jsonb_build_object('status', 'accepted', 'code', v_row.code,
                            'code_label', v_label, 'prev_code', v_old);
end;
$$;

revoke all     on function public.respond_institution_invitation(uuid, boolean) from public;
grant  execute on function public.respond_institution_invitation(uuid, boolean) to authenticated;

drop function if exists public.admin_list_institution_invitations(text, uuid, text);

create function public.admin_list_institution_invitations(
  p_code    text default null,
  p_user_id uuid default null,
  p_status  text default null
)
returns table (
  invitation_id   uuid,
  code            text,
  code_label      text,
  user_id         uuid,
  email           text,
  display_name    text,
  nickname        text,
  status          text,
  reason          text,
  invited_by      uuid,
  invited_by_name text,
  created_at      timestamptz,
  responded_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_code    text := nullif(btrim(coalesce(p_code, '')), '');
  v_status  text := nullif(btrim(coalesce(p_status, '')), '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then raise exception 'forbidden: platform_admin required'; end if;

  return query
    select i.id,
           i.code,
           c.label,
           i.user_id,
           u.email::text,
           p.display_name,
           p.nickname::text,
           i.status,
           i.reason,
           i.invited_by,
           coalesce(nullif(aa.display_name, ''), aa.email, i.invited_by::text),
           i.created_at,
           i.responded_at
      from public.institution_code_invitations i
      left join public.institution_codes c on c.code = i.code
      left join public.profiles p on p.id = i.user_id
      left join auth.users u on u.id = i.user_id
      left join public.admin_accounts aa on aa.id = i.invited_by
     where (v_code is null or i.code = v_code)
       and (p_user_id is null or i.user_id = p_user_id)
       and (v_status is null or i.status = v_status)
     order by i.created_at desc
     limit 500;
end;
$$;

revoke all     on function public.admin_list_institution_invitations(text, uuid, text) from public;
grant  execute on function public.admin_list_institution_invitations(text, uuid, text) to authenticated;
