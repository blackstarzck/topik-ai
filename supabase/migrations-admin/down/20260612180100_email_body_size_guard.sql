-- down: 이메일 본문 크기 가드 제거 (RPC는 admin-0006 정의로 복원 필요 —
-- 운영 절차상 supabase/migrations-admin/20260612170500_template_save_rpc_link_url.sql 재실행)
alter table public.notification_templates
  drop constraint if exists notification_templates_email_body_size;
-- RPC 복원: node scripts/db/run-sql.mjs --file supabase/migrations-admin/20260612170500_template_save_rpc_link_url.sql
select 1;
