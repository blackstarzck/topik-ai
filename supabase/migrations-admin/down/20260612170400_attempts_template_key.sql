-- down: template_key 비정규화 컬럼 제거
alter table public.notification_delivery_attempts drop column if exists template_key;
