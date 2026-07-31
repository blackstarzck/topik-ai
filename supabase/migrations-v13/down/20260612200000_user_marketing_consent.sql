-- =====================================================================
-- DOWN · 20260612200000_user_marketing_consent
-- 마케팅 동의 저장소(H-2)를 제거한다.
--   - trigger drop, table drop (정책은 테이블과 함께 사라짐).
-- 주: 이 down은 테이블만 되돌린다. dispatch 함수의 consent 분기(20260612200100)
--     는 별도 down에서 hard-coded opted_out으로 복원한다.
-- =====================================================================

drop trigger if exists trg_user_marketing_consent_touch_updated_at on public.user_marketing_consent;
drop table if exists public.user_marketing_consent;
