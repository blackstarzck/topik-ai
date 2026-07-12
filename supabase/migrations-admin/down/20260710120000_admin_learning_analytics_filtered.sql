-- Analytics > 학습 분석 조건 기반 RPC 제거.
-- 기존 get_admin_learning_analytics(integer)는 이 마이그레이션이 변경하지 않았으므로 유지한다.

drop function if exists public.get_admin_learning_analytics_filtered(
  date, date, smallint[], text, text, jsonb, boolean
);

drop function if exists public.get_admin_learning_analytics_filter_options();
