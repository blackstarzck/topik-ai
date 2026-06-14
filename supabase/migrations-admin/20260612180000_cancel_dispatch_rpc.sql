-- =====================================================================
-- topik-ai admin · 알림 기능 WP2-3 · admin-0007
-- admin RPC: 예약 발송(dispatch) 취소 — QA N-ADM-11
--
-- 시나리오: "예약 발송 취소 → 취소 후 발송 0건."
--   파이프라인(private.dispatch_admin_notifications)은 status='scheduled' 이고
--   scheduled_at<=now() 인 행만 집행하므로, status='canceled'로 전이하면
--   해당 예약은 영구히 실행되지 않는다(전달 시도 0건).
--
-- 가드: scheduled 상태만 취소 가능(이미 실행/완료 건은 막는다).
-- 감사: notification_dispatch_canceled (actor=auth.uid(), 사유 필수).
--       target_table='Notification' + target_id=dispatch id.
-- down: supabase/migrations-admin/down/20260612180000_cancel_dispatch_rpc.sql
-- =====================================================================

create or replace function public.admin_cancel_notification_dispatch(
  p_dispatch_id uuid,
  p_reason      text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_status  text;
  v_key     text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'reason required (operational reason)';
  end if;

  select status, template_key into v_status, v_key
    from public.notification_dispatches
   where id = p_dispatch_id;
  if not found then raise exception 'unknown dispatch'; end if;
  if v_status <> 'scheduled' then
    raise exception 'only scheduled dispatches can be canceled (status=%)', v_status;
  end if;

  update public.notification_dispatches
     set status = 'canceled', completed_at = now()
   where id = p_dispatch_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, payload)
  values (caller_id, 'notification_dispatch_canceled', 'Notification', p_dispatch_id::text,
          jsonb_build_object('reason', p_reason, 'template_key', v_key));
end;
$$;
revoke all on function public.admin_cancel_notification_dispatch(uuid, text) from public;
grant execute on function public.admin_cancel_notification_dispatch(uuid, text) to authenticated;
comment on function public.admin_cancel_notification_dispatch(uuid, text) is
  'admin 전용. 예약(scheduled) 발송 실행을 취소(status=canceled, completed_at=now). 파이프라인은 canceled를 집행하지 않으므로 발송 0건. 감사: notification_dispatch_canceled. QA N-ADM-11.';
