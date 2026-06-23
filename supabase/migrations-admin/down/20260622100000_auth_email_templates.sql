-- down: 20260622100000_auth_email_templates
-- 인증 메일 템플릿 테이블/RPC/메타데이터 시드 제거.

drop function if exists public.admin_mark_auth_email_synced(text, jsonb, text);
drop function if exists public.admin_save_auth_email_template(text, jsonb, text);

drop table if exists public.auth_email_templates cascade;

-- 메타데이터 시드 회수 ('인증·계정 메일' 그룹 + 6 항목)
delete from public.system_metadata_group_items where group_id = 'META-GRP-007';
delete from public.system_metadata_groups where group_id = 'META-GRP-007';
