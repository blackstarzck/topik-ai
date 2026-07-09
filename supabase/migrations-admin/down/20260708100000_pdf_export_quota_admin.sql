-- down: Operation > PDF 내보내기 제한 관리 RPC 4종 제거.
-- v13 소유 pdf_export_quota_* 테이블과 데이터는 건드리지 않는다.

drop function if exists public.admin_create_pdf_quota_reset(text, uuid, text, uuid, text);
drop function if exists public.admin_save_pdf_quota_policy(uuid, integer, text, text, boolean, text);
drop function if exists public.get_admin_pdf_quota_resets(integer, integer, text);
drop function if exists public.get_admin_pdf_quota_policies();
