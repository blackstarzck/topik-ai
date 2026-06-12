-- =====================================================================
-- topik-ai admin · 알림 기능 · admin-0004
-- notification_templates.link_url — 인앱 알림 클릭 시 이동 경로(v13 라우트).
-- 운영자가 템플릿 단위로 관리한다. 이벤트형 발송은 이벤트 payload의
-- link_url이 이 기본값을 덮어쓸 수 있다(파이프라인 계약).
-- down: supabase/migrations-admin/down/20260612170300_notification_template_link_url.sql
-- =====================================================================

alter table public.notification_templates
  add column if not exists link_url text not null default '';

comment on column public.notification_templates.link_url is
  '인앱 알림 클릭 이동 경로(v13 내부 라우트). 이벤트 payload link_url이 우선.';

update public.notification_templates set link_url = '/dashboard'
 where template_key in ('study_reminder','exam_schedule','notice','event','marketing') and link_url = '';
update public.notification_templates set link_url = '/growth'
 where template_key = 'weekly_summary' and link_url = '';
update public.notification_templates set link_url = '/library'
 where template_key = 'feedback_ready' and link_url = '';
