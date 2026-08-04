-- Rollback: 20260804100100_topik_writing_auto_assign_new_questions.sql
--
-- 이 파일은 20260804100000 의 down 보다 **먼저** 실행해야 한다(그 파일 헤더 참조).
--
-- **이미 자동 배정된 행은 지우지 않는다.** 배정 행을 되돌리면 학습자가 보던 문항이
-- 사라지고, 어느 행이 자동 배정이었는지는 reason 문자열로만 구분되므로 그 사이 운영자가
-- 손으로 만든 배정과 뒤섞였을 수 있다. 노출을 줄이는 방향의 롤백은 하지 않는다 —
-- 이 저장소의 일관 규칙(폴백은 항상 현행 동작)과 같은 이유다. 특정 기관의 자동 배정을
-- 거두려면 기관 중심 배정 화면에서 명시적으로 해제하여라.

-- ---------------------------------------------------------------- 문항 4테이블 트리거 제거
drop trigger if exists topik_writing_51_auto_assign_on_available
  on public.topik_writing_51_questions;
drop trigger if exists topik_writing_52_auto_assign_on_available
  on public.topik_writing_52_questions;
drop trigger if exists topik_writing_53_auto_assign_on_available
  on public.topik_writing_53_questions;
drop trigger if exists topik_writing_54_auto_assign_on_available
  on public.topik_writing_54_questions;

-- ---------------------------------------------------------------- 트리거 함수·토글 RPC 제거
drop function if exists private.auto_assign_writing_question_to_institutions();
drop function if exists public.admin_set_institution_auto_assign(text, boolean, text);

-- ---------------------------------------------------------------- 옵션 컬럼 제거
alter table public.topik_writing_institution_exposure_mode
  drop column if exists auto_assign_new_questions;
