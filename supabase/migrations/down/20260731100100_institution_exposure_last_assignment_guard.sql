-- Rollback: 20260731100100_institution_exposure_last_assignment_guard.sql
--
-- 트리거 2개와 트리거 함수를 제거한다. 배정 데이터는 건드리지 않는다.

drop trigger if exists topik_writing_exposure_last_assignment_guard_delete
  on public.topik_writing_question_institution_exposure;
drop trigger if exists topik_writing_exposure_last_assignment_guard_update
  on public.topik_writing_question_institution_exposure;

drop function if exists private.guard_institution_exposure_last_assignment();
