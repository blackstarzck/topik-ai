-- down: link_url 컬럼 제거
alter table public.notification_templates drop column if exists link_url;
