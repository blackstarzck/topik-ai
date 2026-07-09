-- down: cta_label 컬럼 제거 + 저장 RPC를 20260612170500(link_url 반영 버전)으로 복원.
-- RPC 복원은 선례(20260612170500 down)와 같이 원본 파일 재실행으로 수행:
--   node scripts/db/run-sql.mjs --file supabase/migrations-admin/20260612170500_template_save_rpc_link_url.sql
-- (cta_label 을 참조하는 함수가 남은 채 컬럼만 지우면 저장이 깨지므로 RPC 복원을 먼저 실행할 것)
alter table public.notification_templates drop column if exists cta_label;
