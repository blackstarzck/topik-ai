-- Phase 8 enforcement (users (instructors/referrals/institution-codes)): admin_has_permission gates after is_admin.
-- Generated from live bodies by scripts/db/gen-phase8-enforcement.mjs.
-- down: supabase/migrations-admin/down/20260623282000_phase8_users.sql

CREATE OR REPLACE FUNCTION public.admin_add_instructor_note(p_instructor_id text, p_content text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_admin_name text;
  v_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.groups.manage') then raise exception 'forbidden: missing permission users.groups.manage'; end if;
  if nullif(btrim(coalesce(p_content, '')), '') is null then raise exception 'content required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;
  if not exists (select 1 from public.instructors where id = p_instructor_id) then
    raise exception 'unknown instructor id: %', p_instructor_id;
  end if;

  select coalesce(nullif(p.display_name, ''), nullif(p.nickname::text, ''), caller_id::text)
    into v_admin_name from public.profiles p where p.id = caller_id;

  insert into public.instructor_admin_notes (instructor_id, admin_user_id, admin_name, content)
       values (p_instructor_id, caller_id, v_admin_name, btrim(p_content))
    returning id into v_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'instructor_note_added', 'Instructor', p_instructor_id,
          jsonb_build_object('note_id', v_id),
          jsonb_build_object('reason', btrim(p_reason), 'note_id', v_id));
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_instructor_note(p_note_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_instructor_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.groups.manage') then raise exception 'forbidden: missing permission users.groups.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  delete from public.instructor_admin_notes where id = p_note_id returning instructor_id into v_instructor_id;
  if v_instructor_id is null then raise exception 'unknown note id: %', p_note_id; end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'instructor_note_deleted', 'Instructor', v_instructor_id,
          jsonb_build_object('note_id', p_note_id),
          jsonb_build_object('reason', btrim(p_reason), 'note_id', p_note_id));
  return p_note_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_instructor_status(p_instructor_id text, p_status text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.groups.manage') then raise exception 'forbidden: missing permission users.groups.manage'; end if;
  if p_status not in ('정상', '정지', '탈퇴') then raise exception 'invalid status: %', p_status; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  select status into v_old from public.instructors where id = p_instructor_id for update;
  if not found then raise exception 'unknown instructor id: %', p_instructor_id; end if;
  if v_old = p_status then raise exception 'instructor already %', p_status; end if;

  update public.instructors set status = p_status, updated_at = now() where id = p_instructor_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'instructor_status_changed', 'Instructor', p_instructor_id,
          jsonb_build_object('status', jsonb_build_object('from', v_old, 'to', p_status)),
          jsonb_build_object('reason', btrim(p_reason)));
  return p_instructor_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_adjust_referral_reward(p_referral_id text, p_amount integer, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_entry_type text;
  v_id text;
  v_now text := to_char(now(), 'YYYY-MM-DD HH24:MI');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.referrals.manage') then raise exception 'forbidden: missing permission users.referrals.manage'; end if;
  if p_amount is null then raise exception 'amount required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;
  if not exists (select 1 from public.referrals where id = p_referral_id) then
    raise exception 'unknown referral id: %', p_referral_id;
  end if;

  v_entry_type := case when p_amount >= 0 then '수동 보정' else '회수' end;
  v_id := 'ADJ-' || replace(gen_random_uuid()::text, '-', '');

  insert into public.referral_reward_ledgers
    (id, referral_id, relation_id, entry_type, reward_method_label, amount, status, acted_at, reason)
  values
    (v_id, p_referral_id, '', v_entry_type, '정책 미확정', p_amount, '완료', v_now, btrim(p_reason));

  update public.referrals set last_action_at = v_now, updated_at = now() where id = p_referral_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'referral_reward_adjusted', 'Referral', p_referral_id,
          jsonb_build_object('ledger_id', v_id, 'amount', p_amount, 'entry_type', v_entry_type),
          jsonb_build_object('reason', btrim(p_reason), 'ledger_id', v_id));
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_review_referral_anomaly(p_referral_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old text;
  v_memo text;
  v_now text := to_char(now(), 'YYYY-MM-DD HH24:MI');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.referrals.manage') then raise exception 'forbidden: missing permission users.referrals.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  select anomaly_status, admin_memo into v_old, v_memo
    from public.referrals where id = p_referral_id for update;
  if not found then raise exception 'unknown referral id: %', p_referral_id; end if;

  update public.referrals
     set anomaly_status = '검토 완료',
         admin_memo = v_memo || E'\n- ' || v_now || ' 이상치 검토 완료: ' || btrim(p_reason),
         last_action_at = v_now,
         updated_at = now()
   where id = p_referral_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'referral_anomaly_reviewed', 'Referral', p_referral_id,
          jsonb_build_object('anomaly_status', jsonb_build_object('from', v_old, 'to', '검토 완료')),
          jsonb_build_object('reason', btrim(p_reason)));
  return p_referral_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_referral_status(p_referral_id text, p_status text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old text;
  v_now text := to_char(now(), 'YYYY-MM-DD HH24:MI');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.referrals.manage') then raise exception 'forbidden: missing permission users.referrals.manage'; end if;
  if p_status not in ('활성', '비활성') then raise exception 'invalid status: %', p_status; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;

  select status into v_old from public.referrals where id = p_referral_id for update;
  if not found then raise exception 'unknown referral id: %', p_referral_id; end if;
  if v_old = p_status then raise exception 'referral already %', p_status; end if;

  update public.referrals
     set status = p_status, last_action_at = v_now, updated_at = now()
   where id = p_referral_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'referral_status_changed', 'Referral', p_referral_id,
          jsonb_build_object('status', jsonb_build_object('from', v_old, 'to', p_status)),
          jsonb_build_object('reason', btrim(p_reason)));
  return p_referral_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_institution_code(p_code text, p_label text, p_kind text DEFAULT '박람회'::text, p_note text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid  := auth.uid();
  v_code    text  := btrim(coalesce(p_code, ''));
  v_label   text  := btrim(coalesce(p_label, ''));
  v_kind    text  := coalesce(nullif(btrim(coalesce(p_kind, '')), ''), '박람회');
  v_note    text  := nullif(btrim(coalesce(p_note, '')), '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.institution-codes.manage') then raise exception 'forbidden: missing permission users.institution-codes.manage'; end if;
  if v_code !~ '^[A-Za-z0-9_-]{2,64}$' then
    raise exception 'invalid code (letters/digits/-/_ , 2-64 chars): %', p_code;
  end if;
  if v_label = '' then raise exception 'label required'; end if;
  if v_kind not in ('박람회', '기관', '캠페인', '기타') then raise exception 'invalid kind: %', v_kind; end if;
  if exists (select 1 from public.institution_codes where code = v_code) then
    raise exception 'code already exists: %', v_code;
  end if;

  insert into public.institution_codes (code, label, kind, note, created_by)
       values (v_code, v_label, v_kind, v_note, caller_id);

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'institution_code_created', 'InstitutionCode', v_code,
          jsonb_build_object('label', v_label, 'kind', v_kind),
          jsonb_build_object('note', v_note));
  return v_code;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_institution_code(p_code text, p_label text, p_kind text, p_status text, p_note text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old     public.institution_codes%rowtype;
  v_label   text := btrim(coalesce(p_label, ''));
  v_kind    text := coalesce(nullif(btrim(coalesce(p_kind, '')), ''), '박람회');
  v_status  text := coalesce(nullif(btrim(coalesce(p_status, '')), ''), '활성');
  v_note    text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'users.institution-codes.manage') then raise exception 'forbidden: missing permission users.institution-codes.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required'; end if;
  if v_label = '' then raise exception 'label required'; end if;
  if v_kind not in ('박람회', '기관', '캠페인', '기타') then raise exception 'invalid kind: %', v_kind; end if;
  if v_status not in ('활성', '종료') then raise exception 'invalid status: %', v_status; end if;

  select * into v_old from public.institution_codes where code = p_code for update;
  if not found then raise exception 'unknown code: %', p_code; end if;

  update public.institution_codes
     set label = v_label, kind = v_kind, status = v_status, note = v_note, updated_at = now()
   where code = p_code;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'institution_code_updated', 'InstitutionCode', p_code,
          jsonb_build_object(
            'label',  jsonb_build_object('from', v_old.label,  'to', v_label),
            'kind',   jsonb_build_object('from', v_old.kind,   'to', v_kind),
            'status', jsonb_build_object('from', v_old.status, 'to', v_status)),
          jsonb_build_object('reason', btrim(p_reason)));
  return p_code;
end;
$function$;
