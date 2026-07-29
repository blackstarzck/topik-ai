-- down: System > 사용자 리포트 조회·삭제 RPC 제거.
-- v13 정본 테이블 private.system_reports 와 접수 RPC 는 건드리지 않는다.

drop function if exists public.admin_delete_system_report(uuid, text);
drop function if exists public.admin_list_system_reports(
  text, timestamptz, timestamptz, text, integer, integer
);
