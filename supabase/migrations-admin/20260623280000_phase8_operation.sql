-- Phase 8 enforcement (operation (notices/faq/events/policies)): admin_has_permission gates after is_admin.
-- Generated from live bodies by scripts/db/gen-phase8-enforcement.mjs.
-- down: supabase/migrations-admin/down/20260623280000_phase8_operation.sql

CREATE OR REPLACE FUNCTION public.admin_save_operation_notice(p_id text, p_notice jsonb, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id   uuid := auth.uid();
  v_id        text;
  v_title     text;
  v_body_html text;
  v_old       public.operation_notices%rowtype;
  v_diff      jsonb := '{}'::jsonb;
  v_action    text := 'notice_saved';
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.notices.manage') then raise exception 'forbidden: missing permission operation.notices.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  v_title := nullif(btrim(coalesce(p_notice->>'title', '')), '');
  v_body_html := coalesce(p_notice->>'body_html', '');

  if v_title is null then raise exception 'title required'; end if;
  if nullif(btrim(v_body_html), '') is null then raise exception 'body_html required'; end if;

  if nullif(btrim(coalesce(p_id, '')), '') is null then
    select 'NOTICE-' || lpad((coalesce(max(substring(id from '^NOTICE-([0-9]+)$')::integer), 0) + 1)::text, 3, '0')
      into v_id
      from public.operation_notices
     where id ~ '^NOTICE-[0-9]+$';

    insert into public.operation_notices (
      id, title, body_html, status, author, updated_by
    ) values (
      v_id, v_title, v_body_html, 'hidden', caller_id::text, caller_id::text
    );

    v_diff := jsonb_build_object(
      'title', jsonb_build_object('from', null, 'to', v_title),
      'body_html', jsonb_build_object('from', null, 'to', v_body_html),
      'status', jsonb_build_object('from', null, 'to', 'hidden')
    );
  else
    v_id := btrim(p_id);

    select * into v_old
      from public.operation_notices
     where id = v_id
     for update;
    if not found then raise exception 'unknown notice id: %', v_id; end if;

    if v_old.title is distinct from v_title then
      v_diff := v_diff || jsonb_build_object(
        'title', jsonb_build_object('from', v_old.title, 'to', v_title)
      );
    end if;
    if v_old.body_html is distinct from v_body_html then
      v_diff := v_diff || jsonb_build_object(
        'body_html', jsonb_build_object('from', v_old.body_html, 'to', v_body_html)
      );
    end if;

    update public.operation_notices
       set title = v_title,
           body_html = v_body_html,
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_id;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    v_action,
    'OperationNotice',
    v_id,
    v_diff,
    jsonb_build_object(
      'reason', p_reason,
      'mode', case when nullif(btrim(coalesce(p_id, '')), '') is null then 'create' else 'update' end,
      'title', v_title
    )
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_operation_notice_status(p_notice_id text, p_next_status text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old     public.operation_notices%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.notices.manage') then raise exception 'forbidden: missing permission operation.notices.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;
  if p_next_status not in ('published','hidden') then
    raise exception 'invalid status: %', p_next_status;
  end if;

  select * into v_old
    from public.operation_notices
   where id = p_notice_id
   for update;
  if not found then raise exception 'unknown notice id: %', p_notice_id; end if;
  if v_old.status = p_next_status then
    raise exception 'notice already %', p_next_status;
  end if;

  update public.operation_notices
     set status = p_next_status,
         updated_by = caller_id::text,
         updated_at = now()
   where id = p_notice_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'notice_status_changed',
    'OperationNotice',
    p_notice_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', p_next_status)),
    jsonb_build_object('reason', p_reason, 'title', v_old.title)
  );

  return p_notice_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_operation_notice(p_notice_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old     public.operation_notices%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.notices.manage') then raise exception 'forbidden: missing permission operation.notices.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  select * into v_old
    from public.operation_notices
   where id = p_notice_id
   for update;
  if not found then raise exception 'unknown notice id: %', p_notice_id; end if;

  delete from public.operation_notices where id = p_notice_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (
    caller_id,
    'notice_deleted',
    'OperationNotice',
    p_notice_id,
    jsonb_build_object(
      'reason', p_reason,
      'title', v_old.title,
      'status', v_old.status,
      'author', v_old.author,
      'created_at', v_old.created_at,
      'updated_at', v_old.updated_at
    )
  );

  return p_notice_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_operation_faq(p_id text, p_faq jsonb, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id  uuid := auth.uid();
  v_id       text;
  v_question text;
  v_answer   text;
  v_keywords jsonb;
  v_category text;
  v_status   text;
  v_old      public.operation_faqs%rowtype;
  v_diff     jsonb := '{}'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.faq.manage') then raise exception 'forbidden: missing permission operation.faq.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  v_question := nullif(btrim(coalesce(p_faq->>'question', '')), '');
  v_answer := nullif(btrim(coalesce(p_faq->>'answer', '')), '');
  v_keywords := coalesce(p_faq->'search_keywords', '[]'::jsonb);
  v_category := nullif(btrim(coalesce(p_faq->>'category', '')), '');
  v_status := coalesce(nullif(btrim(coalesce(p_faq->>'status', '')), ''), 'hidden');

  if v_question is null then raise exception 'question required'; end if;
  if v_answer is null then raise exception 'answer required'; end if;
  if jsonb_typeof(v_keywords) <> 'array' then raise exception 'search_keywords must be a JSON array'; end if;
  if v_category not in ('계정','결제','커뮤니티','메시지') then
    raise exception 'invalid category: %', v_category;
  end if;
  if v_status not in ('published','hidden') then
    raise exception 'invalid status: %', v_status;
  end if;

  if nullif(btrim(coalesce(p_id, '')), '') is null then
    select 'FAQ-' || lpad((coalesce(max(substring(id from '^FAQ-([0-9]+)$')::integer), 0) + 1)::text, 3, '0')
      into v_id
      from public.operation_faqs
     where id ~ '^FAQ-[0-9]+$';

    insert into public.operation_faqs (
      id, question, answer, search_keywords, category, status, updated_by
    ) values (
      v_id, v_question, v_answer, v_keywords, v_category, v_status, caller_id::text
    );

    v_diff := jsonb_build_object(
      'question', jsonb_build_object('from', null, 'to', v_question),
      'answer', jsonb_build_object('from', null, 'to', v_answer),
      'search_keywords', jsonb_build_object('from', null, 'to', v_keywords),
      'category', jsonb_build_object('from', null, 'to', v_category),
      'status', jsonb_build_object('from', null, 'to', v_status)
    );
  else
    v_id := btrim(p_id);

    select * into v_old
      from public.operation_faqs
     where id = v_id
     for update;
    if not found then raise exception 'unknown faq id: %', v_id; end if;

    if v_old.question is distinct from v_question then
      v_diff := v_diff || jsonb_build_object(
        'question', jsonb_build_object('from', v_old.question, 'to', v_question)
      );
    end if;
    if v_old.answer is distinct from v_answer then
      v_diff := v_diff || jsonb_build_object(
        'answer', jsonb_build_object('from', v_old.answer, 'to', v_answer)
      );
    end if;
    if v_old.search_keywords is distinct from v_keywords then
      v_diff := v_diff || jsonb_build_object(
        'search_keywords', jsonb_build_object('from', v_old.search_keywords, 'to', v_keywords)
      );
    end if;
    if v_old.category is distinct from v_category then
      v_diff := v_diff || jsonb_build_object(
        'category', jsonb_build_object('from', v_old.category, 'to', v_category)
      );
    end if;
    if v_old.status is distinct from v_status then
      v_diff := v_diff || jsonb_build_object(
        'status', jsonb_build_object('from', v_old.status, 'to', v_status)
      );
    end if;

    update public.operation_faqs
       set question = v_question,
           answer = v_answer,
           search_keywords = v_keywords,
           category = v_category,
           status = v_status,
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_id;

    if v_status = 'hidden' then
      update public.operation_faq_curations
         set exposure_status = 'paused',
             updated_by = caller_id::text,
             updated_at = now()
       where faq_id = v_id
         and exposure_status <> 'paused';
    end if;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'faq_saved',
    'OperationFaq',
    v_id,
    v_diff,
    jsonb_build_object(
      'reason', p_reason,
      'mode', case when nullif(btrim(coalesce(p_id, '')), '') is null then 'create' else 'update' end,
      'question', v_question,
      'category', v_category,
      'status', v_status
    )
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_operation_faq_status(p_faq_id text, p_next_status text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id              uuid := auth.uid();
  v_old                  public.operation_faqs%rowtype;
  v_paused_curation_ids  jsonb := '[]'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.faq.manage') then raise exception 'forbidden: missing permission operation.faq.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;
  if p_next_status not in ('published','hidden') then
    raise exception 'invalid status: %', p_next_status;
  end if;

  select * into v_old
    from public.operation_faqs
   where id = p_faq_id
   for update;
  if not found then raise exception 'unknown faq id: %', p_faq_id; end if;
  if v_old.status = p_next_status then
    raise exception 'faq already %', p_next_status;
  end if;

  update public.operation_faqs
     set status = p_next_status,
         updated_by = caller_id::text,
         updated_at = now()
   where id = p_faq_id;

  if p_next_status = 'hidden' then
    with paused as (
      update public.operation_faq_curations
         set exposure_status = 'paused',
             updated_by = caller_id::text,
             updated_at = now()
       where faq_id = p_faq_id
         and exposure_status <> 'paused'
       returning id
    )
    select coalesce(jsonb_agg(id), '[]'::jsonb)
      into v_paused_curation_ids
      from paused;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'faq_status_changed',
    'OperationFaq',
    p_faq_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', p_next_status)),
    jsonb_build_object(
      'reason', p_reason,
      'question', v_old.question,
      'paused_curation_ids', v_paused_curation_ids
    )
  );

  return p_faq_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_operation_faq(p_faq_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id        uuid := auth.uid();
  v_old            public.operation_faqs%rowtype;
  v_curation_count integer := 0;
  v_metric_count   integer := 0;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.faq.manage') then raise exception 'forbidden: missing permission operation.faq.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  select * into v_old
    from public.operation_faqs
   where id = p_faq_id
   for update;
  if not found then raise exception 'unknown faq id: %', p_faq_id; end if;

  select count(*) into v_curation_count
    from public.operation_faq_curations
   where faq_id = p_faq_id;
  select count(*) into v_metric_count
    from public.operation_faq_metrics
   where faq_id = p_faq_id;

  delete from public.operation_faqs where id = p_faq_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (
    caller_id,
    'faq_deleted',
    'OperationFaq',
    p_faq_id,
    jsonb_build_object(
      'reason', p_reason,
      'question', v_old.question,
      'category', v_old.category,
      'status', v_old.status,
      'curation_count', v_curation_count,
      'metric_count', v_metric_count,
      'created_at', v_old.created_at,
      'updated_at', v_old.updated_at
    )
  );

  return p_faq_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_operation_faq_curation(p_id text, p_curation jsonb, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id    uuid := auth.uid();
  v_id         text;
  v_faq_id     text;
  v_surface    text;
  v_mode       text;
  v_rank       smallint;
  v_exposure   text;
  v_start_at   date;
  v_end_at     date;
  v_faq        public.operation_faqs%rowtype;
  v_old        public.operation_faq_curations%rowtype;
  v_diff       jsonb := '{}'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.faq.manage') then raise exception 'forbidden: missing permission operation.faq.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  v_faq_id := nullif(btrim(coalesce(p_curation->>'faq_id', '')), '');
  v_surface := nullif(btrim(coalesce(p_curation->>'surface', '')), '');
  v_mode := nullif(btrim(coalesce(p_curation->>'curation_mode', '')), '');
  v_exposure := nullif(btrim(coalesce(p_curation->>'exposure_status', '')), '');
  v_start_at := nullif(btrim(coalesce(p_curation->>'pinned_start_at', '')), '')::date;
  v_end_at := nullif(btrim(coalesce(p_curation->>'pinned_end_at', '')), '')::date;

  begin
    v_rank := (p_curation->>'display_rank')::smallint;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'display_rank must be a smallint';
  end;

  if v_faq_id is null then raise exception 'faq_id required'; end if;
  if v_surface not in ('help_center','home_top','payment_help','onboarding') then
    raise exception 'invalid surface: %', v_surface;
  end if;
  if v_mode not in ('manual','auto') then
    raise exception 'invalid curation_mode: %', v_mode;
  end if;
  if v_exposure not in ('active','paused') then
    raise exception 'invalid exposure_status: %', v_exposure;
  end if;
  if v_rank <= 0 then raise exception 'display_rank must be positive'; end if;
  if v_start_at is not null and v_end_at is not null and v_start_at > v_end_at then
    raise exception 'pinned_start_at must be before or equal to pinned_end_at';
  end if;

  select * into v_faq
    from public.operation_faqs
   where id = v_faq_id;
  if not found then raise exception 'unknown faq id: %', v_faq_id; end if;

  if v_exposure = 'active' and v_faq.status = 'hidden' then
    raise exception 'hidden faq cannot have active curation';
  end if;

  if nullif(btrim(coalesce(p_id, '')), '') is null then
    select 'FAQCUR-' || lpad((coalesce(max(substring(id from '^FAQCUR-([0-9]+)$')::integer), 0) + 1)::text, 3, '0')
      into v_id
      from public.operation_faq_curations
     where id ~ '^FAQCUR-[0-9]+$';

    if exists (
      select 1
        from public.operation_faq_curations
       where surface = v_surface
         and display_rank = v_rank
    ) then
      raise exception 'duplicate faq curation surface/display_rank';
    end if;

    insert into public.operation_faq_curations (
      id, faq_id, surface, curation_mode, display_rank, exposure_status,
      pinned_start_at, pinned_end_at, updated_by
    ) values (
      v_id, v_faq_id, v_surface, v_mode, v_rank, v_exposure,
      v_start_at, v_end_at, caller_id::text
    );

    v_diff := jsonb_build_object(
      'faq_id', jsonb_build_object('from', null, 'to', v_faq_id),
      'surface', jsonb_build_object('from', null, 'to', v_surface),
      'curation_mode', jsonb_build_object('from', null, 'to', v_mode),
      'display_rank', jsonb_build_object('from', null, 'to', v_rank),
      'exposure_status', jsonb_build_object('from', null, 'to', v_exposure),
      'pinned_start_at', jsonb_build_object('from', null, 'to', v_start_at),
      'pinned_end_at', jsonb_build_object('from', null, 'to', v_end_at)
    );
  else
    v_id := btrim(p_id);

    select * into v_old
      from public.operation_faq_curations
     where id = v_id
     for update;
    if not found then raise exception 'unknown faq curation id: %', v_id; end if;

    if exists (
      select 1
        from public.operation_faq_curations
       where surface = v_surface
         and display_rank = v_rank
         and id <> v_id
    ) then
      raise exception 'duplicate faq curation surface/display_rank';
    end if;

    if v_old.faq_id is distinct from v_faq_id then
      v_diff := v_diff || jsonb_build_object(
        'faq_id', jsonb_build_object('from', v_old.faq_id, 'to', v_faq_id)
      );
    end if;
    if v_old.surface is distinct from v_surface then
      v_diff := v_diff || jsonb_build_object(
        'surface', jsonb_build_object('from', v_old.surface, 'to', v_surface)
      );
    end if;
    if v_old.curation_mode is distinct from v_mode then
      v_diff := v_diff || jsonb_build_object(
        'curation_mode', jsonb_build_object('from', v_old.curation_mode, 'to', v_mode)
      );
    end if;
    if v_old.display_rank is distinct from v_rank then
      v_diff := v_diff || jsonb_build_object(
        'display_rank', jsonb_build_object('from', v_old.display_rank, 'to', v_rank)
      );
    end if;
    if v_old.exposure_status is distinct from v_exposure then
      v_diff := v_diff || jsonb_build_object(
        'exposure_status', jsonb_build_object('from', v_old.exposure_status, 'to', v_exposure)
      );
    end if;
    if v_old.pinned_start_at is distinct from v_start_at then
      v_diff := v_diff || jsonb_build_object(
        'pinned_start_at', jsonb_build_object('from', v_old.pinned_start_at, 'to', v_start_at)
      );
    end if;
    if v_old.pinned_end_at is distinct from v_end_at then
      v_diff := v_diff || jsonb_build_object(
        'pinned_end_at', jsonb_build_object('from', v_old.pinned_end_at, 'to', v_end_at)
      );
    end if;

    update public.operation_faq_curations
       set faq_id = v_faq_id,
           surface = v_surface,
           curation_mode = v_mode,
           display_rank = v_rank,
           exposure_status = v_exposure,
           pinned_start_at = v_start_at,
           pinned_end_at = v_end_at,
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_id;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'faq_curation_saved',
    'OperationFaqCuration',
    v_id,
    v_diff,
    jsonb_build_object(
      'reason', p_reason,
      'mode', case when nullif(btrim(coalesce(p_id, '')), '') is null then 'create' else 'update' end,
      'faq_id', v_faq_id,
      'surface', v_surface,
      'display_rank', v_rank,
      'exposure_status', v_exposure
    )
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_operation_faq_curation(p_curation_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old     public.operation_faq_curations%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.faq.manage') then raise exception 'forbidden: missing permission operation.faq.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  select * into v_old
    from public.operation_faq_curations
   where id = p_curation_id
   for update;
  if not found then raise exception 'unknown faq curation id: %', p_curation_id; end if;

  delete from public.operation_faq_curations where id = p_curation_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (
    caller_id,
    'faq_curation_deleted',
    'OperationFaqCuration',
    p_curation_id,
    jsonb_build_object(
      'reason', p_reason,
      'faq_id', v_old.faq_id,
      'surface', v_old.surface,
      'display_rank', v_old.display_rank,
      'exposure_status', v_old.exposure_status
    )
  );

  return p_curation_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_operation_event(p_id text, p_event jsonb, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id  uuid := auth.uid();
  v_id       text;
  v_title    text;
  v_event_type text;
  v_visibility text;
  v_reward_type text;
  v_indexing text;
  v_banner_src text;
  v_old      public.operation_events%rowtype;
  v_diff     jsonb := '{}'::jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.events.manage') then raise exception 'forbidden: missing permission operation.events.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  v_title := nullif(btrim(coalesce(p_event->>'title', '')), '');
  if v_title is null then raise exception 'title required'; end if;

  v_event_type := coalesce(nullif(btrim(coalesce(p_event->>'event_type','')),''), '프로모션');
  if v_event_type not in ('프로모션','출석','챌린지','리워드') then
    raise exception 'invalid event_type: %', v_event_type;
  end if;

  v_visibility := coalesce(nullif(btrim(coalesce(p_event->>'visibility_status','')),''), 'hidden');
  if v_visibility not in ('exposed','hidden','scheduled') then
    raise exception 'invalid visibility_status: %', v_visibility;
  end if;

  v_reward_type := nullif(btrim(coalesce(p_event->>'reward_type','')),'');
  if v_reward_type is not null and v_reward_type not in ('없음','쿠폰','포인트','배지') then
    raise exception 'invalid reward_type: %', v_reward_type;
  end if;

  v_indexing := nullif(btrim(coalesce(p_event->>'indexing_policy','')),'');
  if v_indexing is not null and v_indexing not in ('index','noindex') then
    raise exception 'invalid indexing_policy: %', v_indexing;
  end if;

  v_banner_src := nullif(btrim(coalesce(p_event->>'banner_image_source_type','')),'');
  if v_banner_src is not null and v_banner_src not in ('file','url') then
    raise exception 'invalid banner_image_source_type: %', v_banner_src;
  end if;

  if nullif(btrim(coalesce(p_id, '')), '') is null then
    select 'EVT-' || lpad((coalesce(max(substring(id from '^EVT-([0-9]+)$')::integer), 0) + 1)::text, 3, '0')
      into v_id
      from public.operation_events
     where id ~ '^EVT-[0-9]+$';

    insert into public.operation_events (
      id, title, summary, body_html, slug, event_type, visibility_status, progress_status,
      start_at, end_at, exposure_channels, target_group_id, target_group_name,
      participant_count, participant_limit, reward_type, reward_policy_id, reward_policy_name,
      message_template_id, message_template_name, banner_image_url, banner_image_source_type,
      banner_image_file_name, banner_images, landing_url, meta_title, meta_description,
      og_image_url, canonical_url, indexing_policy, admin_memo, updated_by
    ) values (
      v_id, v_title,
      coalesce(p_event->>'summary',''), coalesce(p_event->>'body_html',''),
      nullif(btrim(coalesce(p_event->>'slug','')),''), v_event_type, v_visibility, 'upcoming',
      nullif(btrim(coalesce(p_event->>'start_at','')),'')::date,
      nullif(btrim(coalesce(p_event->>'end_at','')),'')::date,
      coalesce(p_event->'exposure_channels','[]'::jsonb),
      nullif(btrim(coalesce(p_event->>'target_group_id','')),''),
      nullif(btrim(coalesce(p_event->>'target_group_name','')),''),
      0,
      nullif(btrim(coalesce(p_event->>'participant_limit','')),'')::integer,
      v_reward_type,
      nullif(btrim(coalesce(p_event->>'reward_policy_id','')),''),
      nullif(btrim(coalesce(p_event->>'reward_policy_name','')),''),
      nullif(btrim(coalesce(p_event->>'message_template_id','')),''),
      nullif(btrim(coalesce(p_event->>'message_template_name','')),''),
      nullif(btrim(coalesce(p_event->>'banner_image_url','')),''),
      v_banner_src,
      nullif(btrim(coalesce(p_event->>'banner_image_file_name','')),''),
      coalesce(p_event->'banner_images','[]'::jsonb),
      nullif(btrim(coalesce(p_event->>'landing_url','')),''),
      nullif(btrim(coalesce(p_event->>'meta_title','')),''),
      nullif(btrim(coalesce(p_event->>'meta_description','')),''),
      nullif(btrim(coalesce(p_event->>'og_image_url','')),''),
      nullif(btrim(coalesce(p_event->>'canonical_url','')),''),
      v_indexing,
      nullif(btrim(coalesce(p_event->>'admin_memo','')),''),
      caller_id::text
    );

    v_diff := jsonb_build_object(
      'title', jsonb_build_object('from', null, 'to', v_title),
      'event_type', jsonb_build_object('from', null, 'to', v_event_type),
      'visibility_status', jsonb_build_object('from', null, 'to', v_visibility)
    );
  else
    v_id := btrim(p_id);
    select * into v_old from public.operation_events where id = v_id for update;
    if not found then raise exception 'unknown event id: %', v_id; end if;

    if v_old.title is distinct from v_title then
      v_diff := v_diff || jsonb_build_object('title', jsonb_build_object('from', v_old.title, 'to', v_title));
    end if;
    if v_old.event_type is distinct from v_event_type then
      v_diff := v_diff || jsonb_build_object('event_type', jsonb_build_object('from', v_old.event_type, 'to', v_event_type));
    end if;
    if v_old.visibility_status is distinct from v_visibility then
      v_diff := v_diff || jsonb_build_object('visibility_status', jsonb_build_object('from', v_old.visibility_status, 'to', v_visibility));
    end if;

    update public.operation_events
       set title = v_title,
           summary = coalesce(p_event->>'summary',''),
           body_html = coalesce(p_event->>'body_html',''),
           slug = nullif(btrim(coalesce(p_event->>'slug','')),''),
           event_type = v_event_type,
           visibility_status = v_visibility,
           start_at = nullif(btrim(coalesce(p_event->>'start_at','')),'')::date,
           end_at = nullif(btrim(coalesce(p_event->>'end_at','')),'')::date,
           exposure_channels = coalesce(p_event->'exposure_channels','[]'::jsonb),
           target_group_id = nullif(btrim(coalesce(p_event->>'target_group_id','')),''),
           target_group_name = nullif(btrim(coalesce(p_event->>'target_group_name','')),''),
           participant_limit = nullif(btrim(coalesce(p_event->>'participant_limit','')),'')::integer,
           reward_type = v_reward_type,
           reward_policy_id = nullif(btrim(coalesce(p_event->>'reward_policy_id','')),''),
           reward_policy_name = nullif(btrim(coalesce(p_event->>'reward_policy_name','')),''),
           message_template_id = nullif(btrim(coalesce(p_event->>'message_template_id','')),''),
           message_template_name = nullif(btrim(coalesce(p_event->>'message_template_name','')),''),
           banner_image_url = nullif(btrim(coalesce(p_event->>'banner_image_url','')),''),
           banner_image_source_type = v_banner_src,
           banner_image_file_name = nullif(btrim(coalesce(p_event->>'banner_image_file_name','')),''),
           banner_images = coalesce(p_event->'banner_images','[]'::jsonb),
           landing_url = nullif(btrim(coalesce(p_event->>'landing_url','')),''),
           meta_title = nullif(btrim(coalesce(p_event->>'meta_title','')),''),
           meta_description = nullif(btrim(coalesce(p_event->>'meta_description','')),''),
           og_image_url = nullif(btrim(coalesce(p_event->>'og_image_url','')),''),
           canonical_url = nullif(btrim(coalesce(p_event->>'canonical_url','')),''),
           indexing_policy = v_indexing,
           admin_memo = nullif(btrim(coalesce(p_event->>'admin_memo','')),''),
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_id;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'event_saved', 'OperationEvent', v_id, v_diff,
    jsonb_build_object(
      'reason', p_reason,
      'mode', case when nullif(btrim(coalesce(p_id, '')), '') is null then 'create' else 'update' end,
      'title', v_title
    )
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_schedule_operation_event(p_event_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old     public.operation_events%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.events.manage') then raise exception 'forbidden: missing permission operation.events.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.operation_events where id = p_event_id for update;
  if not found then raise exception 'unknown event id: %', p_event_id; end if;

  update public.operation_events
     set visibility_status = 'scheduled', updated_by = caller_id::text, updated_at = now()
   where id = p_event_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'event_scheduled', 'OperationEvent', p_event_id,
          jsonb_build_object('visibility_status', jsonb_build_object('from', v_old.visibility_status, 'to', 'scheduled')),
          jsonb_build_object('reason', p_reason, 'title', v_old.title));
  return p_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_publish_operation_event(p_event_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old     public.operation_events%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.events.manage') then raise exception 'forbidden: missing permission operation.events.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.operation_events where id = p_event_id for update;
  if not found then raise exception 'unknown event id: %', p_event_id; end if;

  update public.operation_events
     set visibility_status = 'exposed', updated_by = caller_id::text, updated_at = now()
   where id = p_event_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'event_published', 'OperationEvent', p_event_id,
          jsonb_build_object('visibility_status', jsonb_build_object('from', v_old.visibility_status, 'to', 'exposed')),
          jsonb_build_object('reason', p_reason, 'title', v_old.title));
  return p_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_end_operation_event(p_event_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old     public.operation_events%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.events.manage') then raise exception 'forbidden: missing permission operation.events.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.operation_events where id = p_event_id for update;
  if not found then raise exception 'unknown event id: %', p_event_id; end if;

  update public.operation_events
     set progress_status = 'ended', visibility_status = 'hidden',
         updated_by = caller_id::text, updated_at = now()
   where id = p_event_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'event_ended', 'OperationEvent', p_event_id,
          jsonb_build_object(
            'progress_status', jsonb_build_object('from', v_old.progress_status, 'to', 'ended'),
            'visibility_status', jsonb_build_object('from', v_old.visibility_status, 'to', 'hidden')),
          jsonb_build_object('reason', p_reason, 'title', v_old.title));
  return p_event_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_operation_policy(p_id text, p_policy jsonb, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_id text;
  v_old public.operation_policies%rowtype;
  v_saved public.operation_policies%rowtype;
  v_action text;
  v_history_action text;
  v_diff jsonb := '{}'::jsonb;
  v_status text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.policies.manage') then raise exception 'forbidden: missing permission operation.policies.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(btrim(coalesce(p_policy->>'title', '')), '') is null then raise exception 'title required'; end if;

  if (p_policy->>'category') not in ('법률/약관','커뮤니티/안전','결제/리워드','운영/콘텐츠','메시지/알림','관리자/보안') then
    raise exception 'invalid policy category: %', p_policy->>'category';
  end if;
  if (p_policy->>'policy_type') not in ('이용약관','개인정보 처리방침','결제ㆍ환불 정책','청소년 보호정책','커뮤니티 게시글 제재 정책','추천인 보상 정책','포인트 운영정책','쿠폰 운영정책','이벤트 운영정책','FAQ 노출 정책','챗봇 상담 전환 정책','메일 발송 운영정책','푸시 발송 운영정책','발송 실패/재시도 정책','관리자 권한 변경 정책','마케팅 정보 수신 동의') then
    raise exception 'invalid policy_type: %', p_policy->>'policy_type';
  end if;

  if nullif(btrim(coalesce(p_id, '')), '') is null then
    v_id := public.next_operation_policy_id();
    v_status := 'hidden';
    v_action := 'policy_saved';
    v_history_action := 'created';

    insert into public.operation_policies (
      id, category, policy_type, title, version_label, effective_date, exposure_surfaces,
      requires_consent, tracking_status, status, related_admin_pages, related_user_pages,
      source_documents, legal_references, summary, body_html, admin_memo, updated_by
    ) values (
      v_id,
      p_policy->>'category',
      p_policy->>'policy_type',
      btrim(p_policy->>'title'),
      nullif(btrim(coalesce(p_policy->>'version_label', '')), ''),
      nullif(btrim(coalesce(p_policy->>'effective_date', '')), '')::date,
      coalesce(p_policy->'exposure_surfaces', '[]'::jsonb),
      coalesce((p_policy->>'requires_consent')::boolean, false),
      nullif(btrim(coalesce(p_policy->>'tracking_status', '')), ''),
      v_status,
      coalesce(p_policy->'related_admin_pages', '[]'::jsonb),
      coalesce(p_policy->'related_user_pages', '[]'::jsonb),
      coalesce(p_policy->'source_documents', '[]'::jsonb),
      coalesce(p_policy->'legal_references', '[]'::jsonb),
      coalesce(p_policy->>'summary', ''),
      coalesce(p_policy->>'body_html', ''),
      nullif(btrim(coalesce(p_policy->>'admin_memo', '')), ''),
      caller_id::text
    )
    returning * into v_saved;
  else
    v_id := btrim(p_id);
    select * into v_old from public.operation_policies where id = v_id for update;
    if not found then raise exception 'unknown policy id: %', v_id; end if;

    v_action := 'policy_saved';
    v_history_action := case when coalesce(p_policy->>'mode', '') = 'version' then 'updated' else 'updated' end;
    v_status := case when coalesce(p_policy->>'mode', '') = 'version' then 'hidden' else v_old.status end;

    if v_old.title is distinct from btrim(p_policy->>'title') then
      v_diff := v_diff || jsonb_build_object('title', jsonb_build_object('from', v_old.title, 'to', btrim(p_policy->>'title')));
    end if;
    if v_old.version_label is distinct from nullif(btrim(coalesce(p_policy->>'version_label', '')), '') then
      v_diff := v_diff || jsonb_build_object('version_label', jsonb_build_object('from', v_old.version_label, 'to', nullif(btrim(coalesce(p_policy->>'version_label', '')), '')));
    end if;

    update public.operation_policies
       set category = p_policy->>'category',
           policy_type = p_policy->>'policy_type',
           title = btrim(p_policy->>'title'),
           version_label = nullif(btrim(coalesce(p_policy->>'version_label', '')), ''),
           effective_date = nullif(btrim(coalesce(p_policy->>'effective_date', '')), '')::date,
           exposure_surfaces = coalesce(p_policy->'exposure_surfaces', '[]'::jsonb),
           requires_consent = coalesce((p_policy->>'requires_consent')::boolean, false),
           tracking_status = nullif(btrim(coalesce(p_policy->>'tracking_status', '')), ''),
           status = v_status,
           related_admin_pages = coalesce(p_policy->'related_admin_pages', '[]'::jsonb),
           related_user_pages = coalesce(p_policy->'related_user_pages', '[]'::jsonb),
           source_documents = coalesce(p_policy->'source_documents', '[]'::jsonb),
           legal_references = coalesce(p_policy->'legal_references', '[]'::jsonb),
           summary = coalesce(p_policy->>'summary', ''),
           body_html = coalesce(p_policy->>'body_html', ''),
           admin_memo = nullif(btrim(coalesce(p_policy->>'admin_memo', '')), ''),
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_id
     returning * into v_saved;
  end if;

  insert into public.operation_policy_histories (
    id, policy_id, action, version_label, changed_at, changed_by, snapshot
  ) values (
    public.next_operation_policy_history_id(),
    v_id,
    v_history_action,
    v_saved.version_label,
    v_saved.updated_at,
    caller_id::text,
    public.operation_policy_snapshot(v_saved)
  );

  update public.operation_policies
     set current_version_id = (
       select id from public.operation_policy_histories
       where policy_id = v_id
       order by changed_at desc, id desc
       limit 1
     )
   where id = v_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, v_action, 'OperationPolicy', v_id, v_diff,
    jsonb_build_object(
      'reason', p_reason,
      'mode', coalesce(p_policy->>'mode', case when v_old.id is null then 'create' else 'edit' end),
      'title', v_saved.title,
      'version_label', v_saved.version_label
    )
  );

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_operation_policy_status(p_policy_id text, p_next_status text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.operation_policies%rowtype;
  v_saved public.operation_policies%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.policies.manage') then raise exception 'forbidden: missing permission operation.policies.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_next_status not in ('published','hidden') then raise exception 'invalid policy status: %', p_next_status; end if;

  select * into v_old from public.operation_policies where id = p_policy_id for update;
  if not found then raise exception 'unknown policy id: %', p_policy_id; end if;

  update public.operation_policies
     set status = p_next_status, updated_by = caller_id::text, updated_at = now()
   where id = p_policy_id
   returning * into v_saved;

  insert into public.operation_policy_histories (id, policy_id, action, version_label, changed_at, changed_by, snapshot)
  values (public.next_operation_policy_history_id(), p_policy_id, 'status_changed', v_saved.version_label, v_saved.updated_at, caller_id::text, public.operation_policy_snapshot(v_saved));

  update public.operation_policies
     set current_version_id = (select id from public.operation_policy_histories where policy_id = p_policy_id order by changed_at desc, id desc limit 1)
   where id = p_policy_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'policy_status_changed', 'OperationPolicy', p_policy_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', p_next_status)),
    jsonb_build_object('reason', p_reason, 'title', v_saved.title)
  );
  return p_policy_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_operation_policy(p_policy_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.operation_policies%rowtype;
  v_snapshot jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.policies.manage') then raise exception 'forbidden: missing permission operation.policies.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.operation_policies where id = p_policy_id for update;
  if not found then raise exception 'unknown policy id: %', p_policy_id; end if;
  v_snapshot := public.operation_policy_snapshot(v_old);

  insert into public.operation_policy_histories (id, policy_id, action, version_label, changed_at, changed_by, snapshot)
  values (public.next_operation_policy_history_id(), p_policy_id, 'deleted', v_old.version_label, now(), caller_id::text, v_snapshot);

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'policy_deleted', 'OperationPolicy', p_policy_id,
    jsonb_build_object('deleted', jsonb_build_object('from', false, 'to', true)),
    jsonb_build_object('reason', p_reason, 'title', v_old.title, 'snapshot', v_snapshot)
  );

  delete from public.operation_policies where id = p_policy_id;
  return p_policy_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_publish_operation_policy_version(p_policy_id text, p_history_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.operation_policies%rowtype;
  v_history public.operation_policy_histories%rowtype;
  v_snapshot jsonb;
  v_saved public.operation_policies%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if not public.admin_has_permission(caller_id, 'operation.policies.manage') then raise exception 'forbidden: missing permission operation.policies.manage'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.operation_policies where id = p_policy_id for update;
  if not found then raise exception 'unknown policy id: %', p_policy_id; end if;

  select * into v_history
    from public.operation_policy_histories
   where id = p_history_id and policy_id = p_policy_id;
  if not found then raise exception 'unknown policy history id: %', p_history_id; end if;
  v_snapshot := v_history.snapshot;

  update public.operation_policies
     set category = v_snapshot->>'category',
         policy_type = v_snapshot->>'policyType',
         title = v_snapshot->>'title',
         version_label = nullif(btrim(coalesce(v_snapshot->>'versionLabel', '')), ''),
         effective_date = nullif(btrim(coalesce(v_snapshot->>'effectiveDate', '')), '')::date,
         exposure_surfaces = coalesce(v_snapshot->'exposureSurfaces', '[]'::jsonb),
         requires_consent = coalesce((v_snapshot->>'requiresConsent')::boolean, false),
         tracking_status = nullif(btrim(coalesce(v_snapshot->>'trackingStatus', '')), ''),
         status = 'published',
         related_admin_pages = coalesce(v_snapshot->'relatedAdminPages', '[]'::jsonb),
         related_user_pages = coalesce(v_snapshot->'relatedUserPages', '[]'::jsonb),
         source_documents = coalesce(v_snapshot->'sourceDocuments', '[]'::jsonb),
         legal_references = coalesce(v_snapshot->'legalReferences', '[]'::jsonb),
         summary = coalesce(v_snapshot->>'summary', ''),
         body_html = coalesce(v_snapshot->>'bodyHtml', ''),
         admin_memo = nullif(btrim(coalesce(v_snapshot->>'adminMemo', '')), ''),
         current_version_id = p_history_id,
         updated_by = caller_id::text,
         updated_at = now()
   where id = p_policy_id
   returning * into v_saved;

  insert into public.operation_policy_histories (id, policy_id, action, version_label, changed_at, changed_by, snapshot)
  values (public.next_operation_policy_history_id(), p_policy_id, 'version_published', v_saved.version_label, v_saved.updated_at, caller_id::text, public.operation_policy_snapshot(v_saved));

  update public.operation_policies
     set current_version_id = (select id from public.operation_policy_histories where policy_id = p_policy_id order by changed_at desc, id desc limit 1)
   where id = p_policy_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'policy_version_published', 'OperationPolicy', p_policy_id,
    jsonb_build_object(
      'version_label', jsonb_build_object('from', v_old.version_label, 'to', v_saved.version_label),
      'status', jsonb_build_object('from', v_old.status, 'to', 'published')
    ),
    jsonb_build_object('reason', p_reason, 'from_history_id', p_history_id, 'from_version', v_old.version_label, 'to_version', v_saved.version_label)
  );
  return p_policy_id;
end;
$function$;
