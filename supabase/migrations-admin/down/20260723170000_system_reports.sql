-- down: v13 정본 사용자 리포트 접수(20260723170000_system_reports.sql) 되돌리기.
-- service_role 전용 접수 RPC 와 private 접수 테이블을 제거한다. 테이블과 함께
-- 접수 행도 사라지므로, 실제 접수가 쌓인 환경에서는 이 rollback 대신 forward
-- 수정 마이그레이션으로 대응한다. private 스키마의 다른 객체를 연쇄 삭제하지
-- 않도록 cascade 는 쓰지 않고 함수를 먼저 지운다.

drop function if exists public.submit_system_report(
  uuid, uuid, text, text, text, text, text, text, text, text,
  integer, integer, text, text
);

drop table if exists private.system_reports;
