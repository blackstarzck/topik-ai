-- Phase 8 enforcement (message (auth email templates)): admin_has_permission gates after is_admin.
-- Generated from live bodies by scripts/db/gen-phase8-enforcement.mjs.
-- down: supabase/migrations-admin/down/20260623284000_phase8_message_mail.sql

CREATE OR REPLACE FUNCTION public.admin_save_auth_email_template(p_auth_type text, p_template jsonb, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id     uuid := auth.uid();
  v_id          uuid;
  v_old         public.auth_email_templates%rowtype;
  v_subject     text := coalesce(p_template->>'subject', '');
  v_body_html   text := coalesce(p_template->>'body_html', '');
  v_status_in   text := nullif(btrim(coalesce(p_template->>'status', '')), '');
  v_status      text;
  v_local_hash  text;
  v_sync_status text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'message.mail.manage') then raise exception 'forbidden: missing permission message.mail.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;
  if p_auth_type not in ('confirmation','magic_link','recovery','email_change','invite','reauthentication') then
    raise exception 'invalid auth_type: %', p_auth_type;
  end if;
  if octet_length(v_body_html) > 102400 then
    raise exception 'body_html too large (>100KB): % bytes', octet_length(v_body_html);
  end if;
  if v_status_in is not null and v_status_in not in ('draft','ready','published','archived') then
    raise exception 'invalid status: %', v_status_in;
  end if;

  select * into v_old from public.auth_email_templates where auth_type = p_auth_type for update;

  v_status := coalesce(v_status_in, v_old.status, 'draft');
  v_local_hash := md5(v_subject || chr(10) || v_body_html);
  v_sync_status := case
    when v_old.last_synced_live_hash is not null and v_local_hash = v_old.last_synced_live_hash then 'synced'
    else 'draft'
  end;

  insert into public.auth_email_templates as t (
    auth_type, subject, body_html, body_json, status, sync_status, local_hash, updated_by, updated_at
  ) values (
    p_auth_type, v_subject, v_body_html, p_template->'body_json', v_status, v_sync_status, v_local_hash, caller_id, now()
  )
  on conflict (auth_type) do update set
    subject     = excluded.subject,
    body_html   = excluded.body_html,
    body_json   = excluded.body_json,
    status      = excluded.status,
    sync_status = excluded.sync_status,
    local_hash  = excluded.local_hash,
    updated_by  = excluded.updated_by,
    updated_at  = excluded.updated_at
  returning id into v_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'auth_email_template_saved', 'AuthEmailTemplate', p_auth_type,
    case when v_old.id is null then '{}'::jsonb
         else jsonb_build_object(
           'subject', jsonb_build_object('from', v_old.subject, 'to', v_subject),
           'body_changed', (v_old.local_hash is distinct from v_local_hash)
         ) end,
    jsonb_build_object('reason', p_reason, 'auth_type', p_auth_type, 'status', v_status)
  );
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_mark_auth_email_synced(p_auth_type text, p_result jsonb, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id     uuid := auth.uid();
  v_id          uuid;
  v_old         public.auth_email_templates%rowtype;
  v_ok          boolean := coalesce((p_result->>'ok')::boolean, false);
  v_live_hash   text := nullif(btrim(coalesce(p_result->>'live_hash', '')), '');
  v_error       text := nullif(btrim(coalesce(p_result->>'error', '')), '');
  v_sync_status text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'message.mail.manage') then raise exception 'forbidden: missing permission message.mail.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;
  if p_auth_type not in ('confirmation','magic_link','recovery','email_change','invite','reauthentication') then
    raise exception 'invalid auth_type: %', p_auth_type;
  end if;

  select * into v_old from public.auth_email_templates where auth_type = p_auth_type for update;
  if not found then raise exception 'unknown auth_type: %', p_auth_type; end if;

  if v_ok then
    v_sync_status := case
      when v_live_hash is null then 'synced'
      when v_live_hash = v_old.local_hash then 'synced'
      else 'drift'   -- live differs from editor copy right after a "successful" push → flag, don't lie
    end;
    update public.auth_email_templates set
      sync_status           = v_sync_status,
      synced_at             = now(),
      synced_by             = caller_id,
      last_synced_live_hash = coalesce(v_live_hash, local_hash),
      last_live_hash        = coalesce(v_live_hash, local_hash),
      last_live_snapshot    = coalesce(p_result->'snapshot', last_live_snapshot),
      last_live_checked_at  = now(),
      sync_error            = null,
      status                = case when status in ('draft','ready') then 'published' else status end,
      updated_by            = caller_id,
      updated_at            = now()
    where auth_type = p_auth_type
    returning id into v_id;
  else
    v_sync_status := 'error';
    update public.auth_email_templates set
      sync_status          = 'error',
      sync_error           = v_error,
      last_live_checked_at = now(),
      updated_by           = caller_id,
      updated_at           = now()
    where auth_type = p_auth_type
    returning id into v_id;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    case when v_ok then 'auth_email_synced' else 'auth_email_sync_failed' end,
    'AuthEmailTemplate', p_auth_type,
    jsonb_build_object('sync_status', jsonb_build_object('from', v_old.sync_status, 'to', v_sync_status)),
    jsonb_build_object('reason', p_reason, 'auth_type', p_auth_type, 'ok', v_ok, 'error', v_error)
  );
  return v_id;
end;
$function$;
