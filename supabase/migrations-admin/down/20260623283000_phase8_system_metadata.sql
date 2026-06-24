-- down: restore system metadata RPCs without the admin_has_permission guard.

CREATE OR REPLACE FUNCTION public.admin_save_metadata_group(p_group_id text, p_group jsonb, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_id text;
  v_old public.system_metadata_groups%rowtype;
  v_saved public.system_metadata_groups%rowtype;
  v_is_create boolean := nullif(btrim(coalesce(p_group_id, '')), '') is null;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(btrim(coalesce(p_group->>'group_name', '')), '') is null then raise exception 'group_name required'; end if;

  if (p_group->>'manager_type') not in ('codeTable','selectOption','exposureRule','segmentField') then
    raise exception 'invalid manager_type: %', p_group->>'manager_type';
  end if;
  if (p_group->>'owner_module') not in ('Users','Message','Operation','Commerce','Content','System') then
    raise exception 'invalid owner_module: %', p_group->>'owner_module';
  end if;
  if (p_group->>'sync_status') not in ('live','review','draft') then
    raise exception 'invalid sync_status: %', p_group->>'sync_status';
  end if;
  if (p_group->>'exposure_status') not in ('confirmed','inferred','internalOnly','planned') then
    raise exception 'invalid exposure_status: %', p_group->>'exposure_status';
  end if;
  if jsonb_typeof(coalesce(p_group->'linked_admin_pages', '[]'::jsonb)) <> 'array' then raise exception 'linked_admin_pages must be array'; end if;
  if exists (
    select 1 from public.system_metadata_groups
    where lower(group_name) = lower(btrim(p_group->>'group_name'))
      and (v_is_create or group_id <> btrim(p_group_id))
  ) then
    raise exception 'duplicated group_name: %', p_group->>'group_name';
  end if;

  if v_is_create then
    perform pg_advisory_xact_lock(hashtext('system_metadata_group_id'));
    v_id := public.next_system_metadata_group_id();
  else
    v_id := btrim(p_group_id);
    select * into v_old from public.system_metadata_groups where group_id = v_id for update;
    if not found then raise exception 'unknown metadata group id: %', v_id; end if;
  end if;

  insert into public.system_metadata_groups (
    group_id, group_name, description, manager_type, owner_module, owner_role, status,
    sync_status, exposure_status, linked_admin_pages, linked_user_surfaces,
    schema_candidate_notes, item_code_prefix, created_at, updated_at, updated_by
  ) values (
    v_id,
    btrim(p_group->>'group_name'),
    btrim(coalesce(p_group->>'description', '')),
    p_group->>'manager_type',
    p_group->>'owner_module',
    btrim(coalesce(p_group->>'owner_role', '')),
    coalesce(v_old.status, 'active'),
    p_group->>'sync_status',
    p_group->>'exposure_status',
    coalesce(p_group->'linked_admin_pages', '[]'::jsonb),
    coalesce(p_group->'linked_user_surfaces', '[]'::jsonb),
    coalesce(p_group->'schema_candidate_notes', '[]'::jsonb),
    upper(btrim(coalesce(p_group->>'item_code_prefix', ''))),
    coalesce(v_old.created_at, now()),
    now(),
    coalesce(nullif(btrim(p_group->>'updated_by'), ''), caller_id::text)
  )
  on conflict (group_id) do update set
    group_name = excluded.group_name,
    description = excluded.description,
    manager_type = excluded.manager_type,
    owner_module = excluded.owner_module,
    owner_role = excluded.owner_role,
    sync_status = excluded.sync_status,
    exposure_status = excluded.exposure_status,
    linked_admin_pages = excluded.linked_admin_pages,
    linked_user_surfaces = excluded.linked_user_surfaces,
    schema_candidate_notes = excluded.schema_candidate_notes,
    item_code_prefix = excluded.item_code_prefix,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  returning * into v_saved;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'metadata_group_saved', 'SystemMetadataGroup', v_id,
    case when v_is_create then '{}'::jsonb else jsonb_build_object('group_name', jsonb_build_object('from', v_old.group_name, 'to', v_saved.group_name)) end,
    jsonb_build_object('reason', p_reason, 'group_name', v_saved.group_name)
  );
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_metadata_item(p_item_id text, p_item jsonb, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_id text;
  v_group_id text := btrim(coalesce(p_item->>'group_id', ''));
  v_old public.system_metadata_group_items%rowtype;
  v_saved public.system_metadata_group_items%rowtype;
  v_is_create boolean := nullif(btrim(coalesce(p_item_id, '')), '') is null;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(v_group_id, '') is null then raise exception 'group_id required'; end if;
  if not exists (select 1 from public.system_metadata_groups where group_id = v_group_id) then raise exception 'unknown metadata group id: %', v_group_id; end if;
  if (p_item->>'status') not in ('active','inactive') then raise exception 'invalid item status: %', p_item->>'status'; end if;
  if (p_item->>'exposure_status') not in ('confirmed','inferred','internalOnly','planned') then raise exception 'invalid exposure_status: %', p_item->>'exposure_status'; end if;
  if coalesce((p_item->>'sort_order')::integer, 0) < 1 then raise exception 'sort_order must be greater than 0'; end if;

  if exists (
    select 1 from public.system_metadata_group_items
    where group_id = v_group_id and upper(code) = upper(btrim(p_item->>'code'))
      and (v_is_create or item_id <> btrim(p_item_id))
  ) then raise exception 'duplicated item code: %', p_item->>'code'; end if;
  if exists (
    select 1 from public.system_metadata_group_items
    where group_id = v_group_id and lower(label) = lower(btrim(p_item->>'label'))
      and (v_is_create or item_id <> btrim(p_item_id))
  ) then raise exception 'duplicated item label: %', p_item->>'label'; end if;

  if v_is_create then
    perform pg_advisory_xact_lock(hashtext('system_metadata_item_id'));
    v_id := public.next_system_metadata_item_id();
  else
    v_id := btrim(p_item_id);
    select * into v_old from public.system_metadata_group_items where item_id = v_id for update;
    if not found then raise exception 'unknown metadata item id: %', v_id; end if;
    v_group_id := v_old.group_id;
  end if;

  if coalesce((p_item->>'is_default')::boolean, false) then
    update public.system_metadata_group_items
       set is_default = false, updated_at = now()
     where group_id = v_group_id and item_id <> v_id;
  end if;

  insert into public.system_metadata_group_items (
    item_id, group_id, code, label, description, sort_order, status, exposure_status,
    is_default, created_at, updated_at, updated_by
  ) values (
    v_id, v_group_id, upper(btrim(p_item->>'code')), btrim(p_item->>'label'),
    btrim(coalesce(p_item->>'description', '')), (p_item->>'sort_order')::smallint,
    p_item->>'status', p_item->>'exposure_status', coalesce((p_item->>'is_default')::boolean, false),
    coalesce(v_old.created_at, now()), now(), coalesce(nullif(btrim(p_item->>'updated_by'), ''), caller_id::text)
  )
  on conflict (item_id) do update set
    code = excluded.code,
    label = excluded.label,
    description = excluded.description,
    sort_order = excluded.sort_order,
    status = excluded.status,
    exposure_status = excluded.exposure_status,
    is_default = excluded.is_default,
    updated_at = excluded.updated_at,
    updated_by = excluded.updated_by
  returning * into v_saved;

  update public.system_metadata_groups
     set updated_at = now(), updated_by = v_saved.updated_by
   where group_id = v_group_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'metadata_item_saved', 'SystemMetadataGroup', v_group_id,
    case when v_is_create then '{}'::jsonb else jsonb_build_object('code', jsonb_build_object('from', v_old.code, 'to', v_saved.code)) end,
    jsonb_build_object('reason', p_reason, 'item_id', v_id, 'label', v_saved.label)
  );
  return v_group_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_metadata_group_status(p_group_id text, p_next_status text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old_status text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_next_status not in ('active','inactive') then raise exception 'invalid metadata group status: %', p_next_status; end if;
  select status into v_old_status from public.system_metadata_groups where group_id = p_group_id for update;
  if not found then raise exception 'unknown metadata group id: %', p_group_id; end if;
  update public.system_metadata_groups set status = p_next_status, updated_at = now(), updated_by = caller_id::text where group_id = p_group_id;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'metadata_group_status_changed', 'SystemMetadataGroup', p_group_id,
          jsonb_build_object('status', jsonb_build_object('from', v_old_status, 'to', p_next_status)),
          jsonb_build_object('reason', p_reason));
  return p_group_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_toggle_metadata_item_status(p_item_id text, p_next_status text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.system_metadata_group_items%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_next_status not in ('active','inactive') then raise exception 'invalid metadata item status: %', p_next_status; end if;
  select * into v_old from public.system_metadata_group_items where item_id = p_item_id for update;
  if not found then raise exception 'unknown metadata item id: %', p_item_id; end if;
  update public.system_metadata_group_items set status = p_next_status, updated_at = now(), updated_by = caller_id::text where item_id = p_item_id;
  update public.system_metadata_groups set updated_at = now(), updated_by = caller_id::text where group_id = v_old.group_id;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'metadata_item_status_changed', 'SystemMetadataGroup', v_old.group_id,
          jsonb_build_object('item_id', p_item_id, 'status', jsonb_build_object('from', v_old.status, 'to', p_next_status)),
          jsonb_build_object('reason', p_reason, 'label', v_old.label));
  return v_old.group_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reorder_metadata_items(p_group_id text, p_ordered_item_ids jsonb, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_existing_count integer;
  v_ordered_count integer;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if jsonb_typeof(p_ordered_item_ids) <> 'array' then raise exception 'ordered item ids must be array'; end if;
  if not exists (select 1 from public.system_metadata_groups where group_id = p_group_id) then raise exception 'unknown metadata group id: %', p_group_id; end if;

  select count(*) into v_existing_count from public.system_metadata_group_items where group_id = p_group_id;
  select count(distinct value) into v_ordered_count from jsonb_array_elements_text(p_ordered_item_ids);
  if v_existing_count <> v_ordered_count then raise exception 'ordered item ids do not match group item count'; end if;
  if exists (
    select 1
    from jsonb_array_elements_text(p_ordered_item_ids) ordered(item_id)
    left join public.system_metadata_group_items item
      on item.item_id = ordered.item_id and item.group_id = p_group_id
    where item.item_id is null
  ) then raise exception 'ordered item ids contain unknown item'; end if;

  update public.system_metadata_group_items item
     set sort_order = ordered.next_sort_order, updated_at = now(), updated_by = caller_id::text
    from (
      select value as item_id, ordinality::smallint as next_sort_order
      from jsonb_array_elements_text(p_ordered_item_ids) with ordinality
    ) ordered
   where item.item_id = ordered.item_id and item.group_id = p_group_id;

  update public.system_metadata_groups set updated_at = now(), updated_by = caller_id::text where group_id = p_group_id;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'metadata_items_reordered', 'SystemMetadataGroup', p_group_id,
          jsonb_build_object('ordered_item_ids', p_ordered_item_ids),
          jsonb_build_object('reason', p_reason));
  return p_group_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_metadata_item(p_item_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.system_metadata_group_items%rowtype;
  v_fallback_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  select * into v_old from public.system_metadata_group_items where item_id = p_item_id for update;
  if not found then raise exception 'unknown metadata item id: %', p_item_id; end if;
  delete from public.system_metadata_group_items where item_id = p_item_id;
  if v_old.is_default then
    select item_id into v_fallback_id
      from public.system_metadata_group_items
     where group_id = v_old.group_id
     order by sort_order asc, label asc
     limit 1;
    if v_fallback_id is not null then
      update public.system_metadata_group_items set is_default = (item_id = v_fallback_id) where group_id = v_old.group_id;
    end if;
  end if;
  update public.system_metadata_group_items ranked
     set sort_order = ordered.next_sort_order
    from (
      select item_id, row_number() over (order by sort_order asc, label asc)::smallint as next_sort_order
      from public.system_metadata_group_items
      where group_id = v_old.group_id
    ) ordered
   where ranked.item_id = ordered.item_id;
  update public.system_metadata_groups set updated_at = now(), updated_by = caller_id::text where group_id = v_old.group_id;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'metadata_item_deleted', 'SystemMetadataGroup', v_old.group_id, to_jsonb(v_old),
          jsonb_build_object('reason', p_reason, 'item_id', p_item_id, 'label', v_old.label));
  return v_old.group_id;
end;
$function$;
