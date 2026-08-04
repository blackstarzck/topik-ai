-- Rollback: 20260804100200_institution_code_settings.sql
--
-- 이 파일은 20260804100300·20260804100400 의 down 을 먼저 실행한 뒤에 돌려라.
-- 그 두 파일이 institution_code_settings 와 private.institution_seat_usage 를 참조한다.
--
-- **설정 테이블은 남긴다.** 운영자가 입력한 정원·담당자 정보이고, 읽는 RPC 가 사라지면
-- 동작에 영향이 없으며 down→up 재적용 시 그대로 살아난다. 계약 원장을 남긴
-- 20260804100000 의 down 과 같은 판단이다. 지우려면 이 파일 실행 후 수동으로:
--   drop table public.institution_code_settings;

drop function if exists public.admin_update_institution_settings(
  text, integer, integer, boolean, text, text, text
);
drop function if exists public.admin_list_institution_settings(text[]);
drop function if exists private.institution_seat_usage(text);
