-- down: 20260625100000_topik_writing_question_institution_exposure.sql
-- 기관별 노출 매핑 테이블 제거(RLS 정책·인덱스는 테이블과 함께 소멸).
drop table if exists public.topik_writing_question_institution_exposure;
