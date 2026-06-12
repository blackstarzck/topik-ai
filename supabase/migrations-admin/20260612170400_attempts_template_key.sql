-- =====================================================================
-- topik-ai admin · 알림 기능 · admin-0005
-- notification_delivery_attempts.template_key 비정규화 컬럼.
-- 근거: v13 X-09 발송 이력 패널은 본인 attempts만 owner-select 가능하고
-- dispatches는 admin 전용이라 조인 경로가 없다(RLS). 표시 계약(채널/유형/
-- 상태/발송시각)을 attempts 단독으로 충족시킨다. 파이프라인이 기록한다.
-- down: supabase/migrations-admin/down/20260612170400_attempts_template_key.sql
-- =====================================================================

alter table public.notification_delivery_attempts
  add column if not exists template_key text not null default '';

-- 기존 행 백필 (dispatch 조인)
update public.notification_delivery_attempts a
   set template_key = d.template_key
  from public.notification_dispatches d
 where d.id = a.dispatch_id
   and a.template_key = '';

comment on column public.notification_delivery_attempts.template_key is
  '비정규화: dispatch.template_key 사본 — v13 X-09 이력 패널의 owner-select 단독 표시용.';
