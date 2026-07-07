-- down: drop the dashboard/analytics aggregate read RPCs. 두 화면은 다시
-- 목업(fallback) 값으로 동작한다(프론트가 RPC 미존재 시 mock 표시로 폴백).

drop function if exists public.get_admin_dashboard_stats();
drop function if exists public.get_admin_analytics_overview(integer);
