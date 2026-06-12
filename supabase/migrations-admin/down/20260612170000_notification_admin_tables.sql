-- down: 알림 admin 4테이블 제거 (attempts → dispatches → groups → templates 순)
drop table if exists public.notification_delivery_attempts;
drop table if exists public.notification_dispatches;
drop table if exists public.notification_groups;
drop table if exists public.notification_templates;
