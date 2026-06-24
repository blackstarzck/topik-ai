-- down: restore commerce (refunds/coupons/points) RPCs without the admin_has_permission guard.

CREATE OR REPLACE FUNCTION public.admin_approve_billing_refund(p_refund_id text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_refunds%rowtype;
  v_new public.commerce_refunds%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old
  from public.commerce_refunds
  where id = p_refund_id
  for update;
  if not found then raise exception 'unknown commerce refund id: %', p_refund_id; end if;
  if v_old.status <> 'pending' then raise exception 'commerce refund is not pending: %', p_refund_id; end if;

  update public.commerce_refunds
  set status = 'approved',
      processed_by = caller_id::text,
      processed_at = now(),
      review_reason = btrim(p_reason)
  where id = p_refund_id
  returning * into v_new;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'refund_approved',
    'CommerceRefund',
    p_refund_id,
    jsonb_build_object('before', to_jsonb(v_old), 'after', to_jsonb(v_new)),
    jsonb_build_object(
      'reason', btrim(p_reason),
      'payment_id', v_new.payment_id,
      'requested_amount', v_new.requested_amount,
      'intent_only_v13_payment_history_pending', true
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reject_billing_refund(p_refund_id text, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_refunds%rowtype;
  v_new public.commerce_refunds%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old
  from public.commerce_refunds
  where id = p_refund_id
  for update;
  if not found then raise exception 'unknown commerce refund id: %', p_refund_id; end if;
  if v_old.status <> 'pending' then raise exception 'commerce refund is not pending: %', p_refund_id; end if;

  update public.commerce_refunds
  set status = 'rejected',
      processed_by = caller_id::text,
      processed_at = now(),
      review_reason = btrim(p_reason)
  where id = p_refund_id
  returning * into v_new;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'refund_rejected',
    'CommerceRefund',
    p_refund_id,
    jsonb_build_object('before', to_jsonb(v_old), 'after', to_jsonb(v_new)),
    jsonb_build_object(
      'reason', btrim(p_reason),
      'payment_id', v_new.payment_id,
      'requested_amount', v_new.requested_amount
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_commerce_coupon(p_id text, p_coupon jsonb, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_id text;
  v_old public.commerce_coupons%rowtype;
  v_saved public.commerce_coupons%rowtype;
  v_is_create boolean := nullif(btrim(coalesce(p_id, '')), '') is null;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(btrim(coalesce(p_coupon->>'coupon_name', '')), '') is null then raise exception 'coupon_name required'; end if;

  if v_is_create then
    perform pg_advisory_xact_lock(hashtext('commerce_coupon_id'));
    v_id := public.next_commerce_coupon_id();
  else
    v_id := btrim(p_id);
    select * into v_old from public.commerce_coupons where id = v_id for update;
    if not found then raise exception 'unknown commerce coupon id: %', v_id; end if;
  end if;

  insert into public.commerce_coupons (
    id, coupon_name, coupon_kind, coupon_status, issue_state, issue_target_type,
    target_group_ids, target_user_ids, auto_issue_trigger_type,
    code_generation_mode, coupon_code, code_count, audience, benefit_type,
    benefit_value, min_order_amount, max_discount_amount, applicable_scope,
    is_stackable, is_secret_coupon, issue_limit_mode, issue_limit,
    download_limit_mode, download_limit, usage_limit_mode, usage_limit,
    validity_mode, valid_from, valid_until, expire_after_days,
    linked_message_template_id, linked_crm_campaign_id, linked_event_id,
    admin_memo, issue_alert, expire_alert, updated_by
  ) values (
    v_id,
    btrim(p_coupon->>'coupon_name'),
    p_coupon->>'coupon_kind',
    coalesce(p_coupon->>'coupon_status', 'waiting'),
    coalesce(p_coupon->>'issue_state', 'normal'),
    nullif(p_coupon->>'issue_target_type', ''),
    coalesce(p_coupon->'target_group_ids', '[]'::jsonb),
    coalesce(p_coupon->'target_user_ids', '[]'::jsonb),
    nullif(p_coupon->>'auto_issue_trigger_type', ''),
    nullif(p_coupon->>'code_generation_mode', ''),
    coalesce(p_coupon->>'coupon_code', ''),
    nullif(p_coupon->>'code_count', '')::integer,
    nullif(p_coupon->>'audience', ''),
    p_coupon->>'benefit_type',
    coalesce((p_coupon->>'benefit_value')::integer, 0),
    coalesce((p_coupon->>'min_order_amount')::integer, 0),
    nullif(p_coupon->>'max_discount_amount', '')::integer,
    coalesce(p_coupon->>'applicable_scope', 'allProducts'),
    coalesce((p_coupon->>'is_stackable')::boolean, false),
    coalesce((p_coupon->>'is_secret_coupon')::boolean, false),
    coalesce(p_coupon->>'issue_limit_mode', 'unlimited'),
    nullif(p_coupon->>'issue_limit', '')::integer,
    coalesce(p_coupon->>'download_limit_mode', 'unlimited'),
    nullif(p_coupon->>'download_limit', '')::integer,
    coalesce(p_coupon->>'usage_limit_mode', 'unlimited'),
    nullif(p_coupon->>'usage_limit', '')::integer,
    coalesce(p_coupon->>'validity_mode', 'fixedDate'),
    nullif(p_coupon->>'valid_from', '')::date,
    nullif(p_coupon->>'valid_until', '')::date,
    nullif(p_coupon->>'expire_after_days', '')::integer,
    coalesce(p_coupon->>'linked_message_template_id', ''),
    coalesce(p_coupon->>'linked_crm_campaign_id', ''),
    coalesce(p_coupon->>'linked_event_id', ''),
    coalesce(p_coupon->>'admin_memo', ''),
    coalesce(p_coupon->'issue_alert', '{}'::jsonb),
    coalesce(p_coupon->'expire_alert', '{}'::jsonb),
    caller_id::text
  )
  on conflict (id) do update set
    coupon_name = excluded.coupon_name,
    coupon_kind = excluded.coupon_kind,
    coupon_status = excluded.coupon_status,
    issue_state = excluded.issue_state,
    issue_target_type = excluded.issue_target_type,
    target_group_ids = excluded.target_group_ids,
    target_user_ids = excluded.target_user_ids,
    auto_issue_trigger_type = excluded.auto_issue_trigger_type,
    code_generation_mode = excluded.code_generation_mode,
    coupon_code = excluded.coupon_code,
    code_count = excluded.code_count,
    audience = excluded.audience,
    benefit_type = excluded.benefit_type,
    benefit_value = excluded.benefit_value,
    min_order_amount = excluded.min_order_amount,
    max_discount_amount = excluded.max_discount_amount,
    applicable_scope = excluded.applicable_scope,
    is_stackable = excluded.is_stackable,
    is_secret_coupon = excluded.is_secret_coupon,
    issue_limit_mode = excluded.issue_limit_mode,
    issue_limit = excluded.issue_limit,
    download_limit_mode = excluded.download_limit_mode,
    download_limit = excluded.download_limit,
    usage_limit_mode = excluded.usage_limit_mode,
    usage_limit = excluded.usage_limit,
    validity_mode = excluded.validity_mode,
    valid_from = excluded.valid_from,
    valid_until = excluded.valid_until,
    expire_after_days = excluded.expire_after_days,
    linked_message_template_id = excluded.linked_message_template_id,
    linked_crm_campaign_id = excluded.linked_crm_campaign_id,
    linked_event_id = excluded.linked_event_id,
    admin_memo = excluded.admin_memo,
    issue_alert = excluded.issue_alert,
    expire_alert = excluded.expire_alert,
    updated_at = now(),
    updated_by = excluded.updated_by
  returning * into v_saved;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'coupon_saved', 'CommerceCoupon', v_id,
    case when v_is_create then '{}'::jsonb else jsonb_build_object('coupon_status', jsonb_build_object('from', v_old.coupon_status, 'to', v_saved.coupon_status)) end,
    jsonb_build_object('reason', p_reason, 'coupon_name', v_saved.coupon_name, 'coupon_kind', v_saved.coupon_kind)
  );
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_commerce_coupon(p_coupon_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_coupons%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  select * into v_old from public.commerce_coupons where id = p_coupon_id for update;
  if not found then raise exception 'unknown commerce coupon id: %', p_coupon_id; end if;
  delete from public.commerce_coupons where id = p_coupon_id;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'coupon_deleted', 'CommerceCoupon', p_coupon_id, to_jsonb(v_old), jsonb_build_object('reason', p_reason, 'coupon_name', v_old.coupon_name));
  return p_coupon_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_duplicate_commerce_coupon(p_coupon_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_source public.commerce_coupons%rowtype;
  v_id text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  select * into v_source from public.commerce_coupons where id = p_coupon_id for update;
  if not found then raise exception 'unknown commerce coupon id: %', p_coupon_id; end if;

  perform pg_advisory_xact_lock(hashtext('commerce_coupon_id'));
  v_id := public.next_commerce_coupon_id();
  insert into public.commerce_coupons
  select v_id, coupon_name || ' 복사본', coupon_kind, 'waiting', 'normal',
         issue_target_type, target_group_ids, target_group_names, target_user_ids,
         auto_issue_trigger_type, code_generation_mode, coupon_code, code_count,
         audience, benefit_type, benefit_value, min_order_amount, max_discount_amount,
         applicable_scope, applicable_scope_reference_ids, excluded_product_ids,
         is_stackable, is_secret_coupon, issue_limit_mode, issue_limit,
         download_limit_mode, download_limit, usage_limit_mode, usage_limit,
         validity_mode, valid_from, valid_until, expire_after_days,
         linked_message_template_id, linked_message_template_name,
         linked_crm_campaign_id, linked_crm_campaign_name, linked_event_id,
         linked_event_name, download_url, 0, 0, 0, null, null, null,
         policy_notes, admin_memo, issue_alert, expire_alert, now(), now(), caller_id::text
    from public.commerce_coupons
   where id = p_coupon_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'coupon_duplicated', 'CommerceCoupon', v_id, '{}'::jsonb,
          jsonb_build_object('reason', p_reason, 'source_id', p_coupon_id, 'coupon_name', v_source.coupon_name));
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_commerce_coupon_issue_state(p_coupon_id text, p_state text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_coupons%rowtype;
  v_action text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_state not in ('normal','paused') then raise exception 'invalid coupon issue state: %', p_state; end if;
  select * into v_old from public.commerce_coupons where id = p_coupon_id for update;
  if not found then raise exception 'unknown commerce coupon id: %', p_coupon_id; end if;
  if v_old.coupon_kind <> 'autoIssue' then raise exception 'only autoIssue coupons can change issue state'; end if;

  update public.commerce_coupons
     set issue_state = p_state, updated_at = now(), updated_by = caller_id::text
   where id = p_coupon_id;

  v_action := case when p_state = 'paused' then 'coupon_paused' else 'coupon_resumed' end;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, v_action, 'CommerceCoupon', p_coupon_id,
          jsonb_build_object('issue_state', jsonb_build_object('from', v_old.issue_state, 'to', p_state)),
          jsonb_build_object('reason', p_reason, 'coupon_name', v_old.coupon_name));
  return p_coupon_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_commerce_coupon_template(p_id text, p_template jsonb, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_id text;
  v_old public.commerce_coupon_subscription_templates%rowtype;
  v_saved public.commerce_coupon_subscription_templates%rowtype;
  v_is_create boolean := nullif(btrim(coalesce(p_id, '')), '') is null;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(btrim(coalesce(p_template->>'template_name', '')), '') is null then raise exception 'template_name required'; end if;

  if v_is_create then
    perform pg_advisory_xact_lock(hashtext('commerce_coupon_template_id'));
    v_id := public.next_commerce_coupon_template_id();
  else
    v_id := btrim(p_id);
    select * into v_old from public.commerce_coupon_subscription_templates where id = v_id for update;
    if not found then raise exception 'unknown commerce coupon template id: %', v_id; end if;
  end if;

  insert into public.commerce_coupon_subscription_templates (
    id, template_name, target_grade_ids, benefit_type, benefit_value,
    min_order_amount, max_discount_amount, applicable_scope,
    applicable_scope_reference_ids, excluded_product_mode, excluded_product_ids,
    is_stackable, issue_schedule, usage_end_schedule, status,
    issue_alert_enabled, expire_alert_enabled, alert_channel, admin_memo,
    updated_by
  ) values (
    v_id,
    btrim(p_template->>'template_name'),
    coalesce(p_template->'target_grade_ids', '[]'::jsonb),
    p_template->>'benefit_type',
    coalesce((p_template->>'benefit_value')::integer, 0),
    coalesce((p_template->>'min_order_amount')::integer, 0),
    nullif(p_template->>'max_discount_amount', '')::integer,
    coalesce(p_template->>'applicable_scope', 'allProducts'),
    coalesce(p_template->'applicable_scope_reference_ids', '[]'::jsonb),
    coalesce(p_template->>'excluded_product_mode', 'none'),
    coalesce(p_template->'excluded_product_ids', '[]'::jsonb),
    coalesce((p_template->>'is_stackable')::boolean, false),
    coalesce(p_template->'issue_schedule', '{"dayOfMonth":1,"hour":7,"minute":0}'::jsonb),
    coalesce(p_template->'usage_end_schedule', '{"dayOfMonth":28,"hour":23,"minute":59}'::jsonb),
    coalesce(p_template->>'status', 'active'),
    coalesce((p_template->>'issue_alert_enabled')::boolean, false),
    coalesce((p_template->>'expire_alert_enabled')::boolean, false),
    coalesce(p_template->>'alert_channel', 'webAppPush'),
    coalesce(p_template->>'admin_memo', ''),
    caller_id::text
  )
  on conflict (id) do update set
    template_name = excluded.template_name,
    target_grade_ids = excluded.target_grade_ids,
    benefit_type = excluded.benefit_type,
    benefit_value = excluded.benefit_value,
    min_order_amount = excluded.min_order_amount,
    max_discount_amount = excluded.max_discount_amount,
    applicable_scope = excluded.applicable_scope,
    applicable_scope_reference_ids = excluded.applicable_scope_reference_ids,
    excluded_product_mode = excluded.excluded_product_mode,
    excluded_product_ids = excluded.excluded_product_ids,
    is_stackable = excluded.is_stackable,
    issue_schedule = excluded.issue_schedule,
    usage_end_schedule = excluded.usage_end_schedule,
    status = excluded.status,
    issue_alert_enabled = excluded.issue_alert_enabled,
    expire_alert_enabled = excluded.expire_alert_enabled,
    alert_channel = excluded.alert_channel,
    admin_memo = excluded.admin_memo,
    updated_at = now(),
    updated_by = excluded.updated_by
  returning * into v_saved;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'coupon_template_saved', 'CommerceCouponTemplate', v_id,
    case when v_is_create then '{}'::jsonb else jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', v_saved.status)) end,
    jsonb_build_object('reason', p_reason, 'template_name', v_saved.template_name)
  );
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_commerce_coupon_template(p_template_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_coupon_subscription_templates%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  select * into v_old from public.commerce_coupon_subscription_templates where id = p_template_id for update;
  if not found then raise exception 'unknown commerce coupon template id: %', p_template_id; end if;
  delete from public.commerce_coupon_subscription_templates where id = p_template_id;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, 'coupon_template_deleted', 'CommerceCouponTemplate', p_template_id, to_jsonb(v_old), jsonb_build_object('reason', p_reason, 'template_name', v_old.template_name));
  return p_template_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_commerce_coupon_template_status(p_template_id text, p_status text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_coupon_subscription_templates%rowtype;
  v_action text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_status not in ('active','paused') then raise exception 'invalid coupon template status: %', p_status; end if;
  select * into v_old from public.commerce_coupon_subscription_templates where id = p_template_id for update;
  if not found then raise exception 'unknown commerce coupon template id: %', p_template_id; end if;

  update public.commerce_coupon_subscription_templates
     set status = p_status, updated_at = now(), updated_by = caller_id::text
   where id = p_template_id;

  v_action := case when p_status = 'paused' then 'coupon_template_paused' else 'coupon_template_resumed' end;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (caller_id, v_action, 'CommerceCouponTemplate', p_template_id,
          jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', p_status)),
          jsonb_build_object('reason', p_reason, 'template_name', v_old.template_name));
  return p_template_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_create_manual_point_adjustment(p_user_id text, p_amount integer, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_latest public.commerce_point_ledgers%rowtype;
  v_ledger_id text;
  v_next_balance integer;
  v_entry_type text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(btrim(coalesce(p_user_id, '')), '') is null then raise exception 'user_id required'; end if;
  if coalesce(p_amount, 0) = 0 then raise exception 'amount must not be zero'; end if;

  perform pg_advisory_xact_lock(hashtext('commerce_point_ledger_user:' || p_user_id));
  perform pg_advisory_xact_lock(hashtext('commerce_point_ledger_id'));

  select * into v_latest
    from public.commerce_point_ledgers
   where user_id = p_user_id
   order by occurred_at desc, created_at desc, id desc
   limit 1
   for update;

  v_next_balance := coalesce(v_latest.available_balance_after, 0) + p_amount;
  -- Negative point balances are blocked until the commerce deficit policy is documented.
  if v_next_balance < 0 then
    raise exception 'point balance cannot be negative';
  end if;

  v_ledger_id := public.next_commerce_point_ledger_id();
  v_entry_type := case when p_amount < 0 then 'debit' else 'earn' end;

  insert into public.commerce_point_ledgers (
    id, user_id, user_name, entry_type, source_type, amount, balance_after,
    available_balance_after, status, expiration_at, source, source_id,
    source_label, policy_id, policy_name, reason, approval_memo, occurred_at,
    created_by
  ) values (
    v_ledger_id, p_user_id, p_user_id, v_entry_type, 'admin', p_amount,
    v_next_balance, v_next_balance, 'completed',
    case when p_amount > 0 then (current_date + interval '90 days')::date else null end,
    'manual_adjustment', v_ledger_id, '운영 수동 조정', 'POL-1002',
    '운영 수동 조정', btrim(p_reason), btrim(p_reason), now(), caller_id::text
  );

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'point_manual_adjusted', 'CommercePointLedger', v_ledger_id,
    jsonb_build_object('available_balance_after', jsonb_build_object('from', coalesce(v_latest.available_balance_after, 0), 'to', v_next_balance)),
    jsonb_build_object('reason', p_reason, 'user_id', p_user_id, 'amount', p_amount)
  );
  return v_ledger_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_save_commerce_point_policy(p_id text, p_policy jsonb, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_id text;
  v_old public.commerce_point_policies%rowtype;
  v_saved public.commerce_point_policies%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(btrim(coalesce(p_policy->>'name', '')), '') is null then raise exception 'name required'; end if;
  if (p_policy->>'policy_type') not in ('earn','debit','expire') then raise exception 'invalid point policy_type: %', p_policy->>'policy_type'; end if;

  if nullif(btrim(coalesce(p_id, '')), '') is null then
    perform pg_advisory_xact_lock(hashtext('commerce_point_policy_id'));
    v_id := public.next_commerce_point_policy_id();
    insert into public.commerce_point_policies (
      id, name, policy_type, category, status, description, condition_summary,
      earn_debit_rule, expiration_rule, target_condition, trigger_source,
      duplication_rule, manual_adjustment_rule, note, updated_by
    ) values (
      v_id,
      btrim(p_policy->>'name'),
      p_policy->>'policy_type',
      p_policy->>'policy_type',
      'draft',
      coalesce(p_policy->>'condition_summary', ''),
      coalesce(p_policy->>'condition_summary', ''),
      coalesce(p_policy->>'earn_debit_rule', ''),
      coalesce(p_policy->>'expiration_rule', ''),
      coalesce(p_policy->>'target_condition', ''),
      coalesce(p_policy->>'trigger_source', ''),
      coalesce(p_policy->>'duplication_rule', ''),
      coalesce(p_policy->>'manual_adjustment_rule', ''),
      coalesce(p_policy->>'note', ''),
      caller_id::text
    ) returning * into v_saved;
  else
    v_id := btrim(p_id);
    select * into v_old from public.commerce_point_policies where id = v_id for update;
    if not found then raise exception 'unknown commerce point policy id: %', v_id; end if;

    update public.commerce_point_policies
       set name = btrim(p_policy->>'name'),
           policy_type = p_policy->>'policy_type',
           category = p_policy->>'policy_type',
           description = coalesce(p_policy->>'condition_summary', ''),
           condition_summary = coalesce(p_policy->>'condition_summary', ''),
           earn_debit_rule = coalesce(p_policy->>'earn_debit_rule', ''),
           expiration_rule = coalesce(p_policy->>'expiration_rule', ''),
           target_condition = coalesce(p_policy->>'target_condition', ''),
           trigger_source = coalesce(p_policy->>'trigger_source', ''),
           duplication_rule = coalesce(p_policy->>'duplication_rule', ''),
           manual_adjustment_rule = coalesce(p_policy->>'manual_adjustment_rule', ''),
           note = coalesce(p_policy->>'note', ''),
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_id
     returning * into v_saved;
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'point_policy_saved', 'CommercePointPolicy', v_id, '{}'::jsonb,
    jsonb_build_object('reason', p_reason, 'name', v_saved.name, 'policy_type', v_saved.policy_type)
  );
  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_commerce_point_policy_status(p_policy_id text, p_next_status text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_point_policies%rowtype;
  v_saved public.commerce_point_policies%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_next_status not in ('active','inactive') then raise exception 'invalid point policy status: %', p_next_status; end if;

  select * into v_old from public.commerce_point_policies where id = p_policy_id for update;
  if not found then raise exception 'unknown commerce point policy id: %', p_policy_id; end if;

  update public.commerce_point_policies
     set status = p_next_status,
         note = concat_ws(E'\n', nullif(note, ''), '[' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' / ' || caller_id::text || '] status ' || p_next_status || ' - ' || p_reason),
         updated_by = caller_id::text,
         updated_at = now()
   where id = p_policy_id
   returning * into v_saved;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'point_policy_status_changed', 'CommercePointPolicy', p_policy_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', v_saved.status)),
    jsonb_build_object('reason', p_reason, 'name', v_saved.name)
  );
  return p_policy_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_hold_commerce_point_expiration(p_expiration_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_point_expirations%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.commerce_point_expirations where id = p_expiration_id for update;
  if not found then raise exception 'unknown commerce point expiration id: %', p_expiration_id; end if;

  update public.commerce_point_expirations
     set status = case when status = 'completed' then 'completed' else 'held' end,
         hold_reason = btrim(p_reason),
         held_by = caller_id::text,
         held_at = now(),
         calculation_memo = concat_ws(E'\n', nullif(calculation_memo, ''), '[' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' / ' || caller_id::text || '] hold - ' || p_reason)
   where id = p_expiration_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'point_expiration_held', 'CommercePointExpiration', p_expiration_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', case when v_old.status = 'completed' then 'completed' else 'held' end)),
    jsonb_build_object('reason', p_reason, 'user_id', v_old.user_id)
  );
  return p_expiration_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_release_commerce_point_expiration(p_expiration_id text, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  caller_id uuid := auth.uid();
  v_old public.commerce_point_expirations%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.commerce_point_expirations where id = p_expiration_id for update;
  if not found then raise exception 'unknown commerce point expiration id: %', p_expiration_id; end if;

  update public.commerce_point_expirations
     set status = 'scheduled',
         hold_reason = null,
         held_by = null,
         held_at = null,
         calculation_memo = concat_ws(E'\n', nullif(calculation_memo, ''), '[' || to_char(now(), 'YYYY-MM-DD HH24:MI') || ' / ' || caller_id::text || '] release - ' || p_reason)
   where id = p_expiration_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'point_expiration_released', 'CommercePointExpiration', p_expiration_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', 'scheduled')),
    jsonb_build_object('reason', p_reason, 'user_id', v_old.user_id)
  );
  return p_expiration_id;
end;
$function$;
