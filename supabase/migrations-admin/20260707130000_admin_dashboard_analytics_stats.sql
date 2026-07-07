-- =====================================================================
-- topik-ai admin · Dashboard/Analytics 실데이터 집계 read RPC 2종
--
-- Purpose:
--   /dashboard 와 /analytics/overview 는 지금까지 화면 안에 하드코딩된
--   목업 수치(신규회원 124, 신고 37, 활성률 74% 등)만 보여줬다.
--   두 화면이 쓰는 지표를 실제 테이블 집계로 반환하는 read 전용 RPC 를 만든다.
--     - get_admin_dashboard_stats()            : 대시보드 카드/큐/경고 지표
--     - get_admin_analytics_overview(period)   : 기간(7/30/90일) KPI + 직전
--                                                동일기간 비교값(추세 계산용)
--
-- Metric 정의(오너 합의):
--   - 활성 사용자 = 기간 내 1회 이상 로그인(auth.users.last_sign_in_at 기준).
--   - 도달률 = sent / (sent + failed). skipped/opted_out/deduped 는 의도된
--     비발송이므로 분모에서 제외. pending 은 진행 중이므로 제외.
--   - 신고 처리율 = 기간 내 생성된 신고 중 현재 resolved 인 비율.
--   - 매출 = payment_history status='paid' 의 amount_cents 합계 / 100 (KRW).
--   - "권한 변경 검토" 큐는 승인 대기 워크플로가 존재하지 않으므로(변경 즉시
--     반영) "최근 7일 권한 변경 이력" (admin_audit_logs action='admin_role_changed')
--     건수로 대체한다.
--
-- Ownership boundary:
--   v13 소유 profiles / auth.users / payment_history 는 집계 "읽기"만 한다
--   (개별 행/PII 미반환, write 없음). community_* / commerce_refunds /
--   notification_* / admin_audit_logs 는 topik-ai 소유.
-- 권한 모델: private.is_admin (집계 수치만 반환하므로 관리자 공통 표면.
--   회원 목록 등 PII row 반환 RPC 는 platform_admin 전용 — 그 경계와 구분).
-- down: supabase/migrations-admin/down/20260707130000_admin_dashboard_analytics_stats.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 대시보드 요약/큐/경고 지표 (단일 행)
-- ---------------------------------------------------------------------
drop function if exists public.get_admin_dashboard_stats();

create function public.get_admin_dashboard_stats()
returns table (
  new_users_today          bigint,
  pending_reports          bigint,
  pending_refunds          bigint,
  pending_refunds_over_24h bigint,
  scheduled_dispatches     bigint,
  failed_deliveries_7d     bigint,
  role_changes_7d          bigint,
  reports_new_7d           bigint,
  reports_new_prev_7d      bigint,
  push_sent_7d             bigint,
  push_failed_7d           bigint,
  push_sent_prev_7d        bigint,
  push_failed_prev_7d      bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  caller_id     uuid := auth.uid();
  -- "오늘"은 KST 자정 기준(관리 화면 표기 규칙과 동일).
  v_today_start timestamptz := (date_trunc('day', now() at time zone 'Asia/Seoul')) at time zone 'Asia/Seoul';
  v_7d          timestamptz := now() - interval '7 days';
  v_14d         timestamptz := now() - interval '14 days';
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;

  return query
  select
    (select count(*) from public.profiles p
      where p.created_at >= v_today_start),
    (select count(*) from public.community_reports r
      where r.process_status = 'pending'),
    (select count(*) from public.commerce_refunds f
      where f.status = 'pending'),
    (select count(*) from public.commerce_refunds f
      where f.status = 'pending' and f.requested_at < now() - interval '24 hours'),
    (select count(*) from public.notification_dispatches d
      where d.status = 'scheduled'),
    (select count(*) from public.notification_delivery_attempts a
      where a.status = 'failed' and a.created_at >= v_7d),
    (select count(*) from public.admin_audit_logs l
      where l.action = 'admin_role_changed' and l.created_at >= v_7d),
    (select count(*) from public.community_reports r
      where r.created_at >= v_7d),
    (select count(*) from public.community_reports r
      where r.created_at >= v_14d and r.created_at < v_7d),
    (select count(*) from public.notification_delivery_attempts a
      where a.channel = 'push' and a.status = 'sent' and a.created_at >= v_7d),
    (select count(*) from public.notification_delivery_attempts a
      where a.channel = 'push' and a.status = 'failed' and a.created_at >= v_7d),
    (select count(*) from public.notification_delivery_attempts a
      where a.channel = 'push' and a.status = 'sent'
        and a.created_at >= v_14d and a.created_at < v_7d),
    (select count(*) from public.notification_delivery_attempts a
      where a.channel = 'push' and a.status = 'failed'
        and a.created_at >= v_14d and a.created_at < v_7d);
end;
$$;

revoke all on function public.get_admin_dashboard_stats() from public;
grant execute on function public.get_admin_dashboard_stats() to authenticated;

comment on function public.get_admin_dashboard_stats() is
  '대시보드 요약/큐/경고 실데이터 집계. is_admin 전용, 집계 수치만 반환(PII 없음). 오늘=KST 자정, 실패/추세 창=최근 7일 vs 직전 7일.';

-- ---------------------------------------------------------------------
-- 분석 개요: 기간(일수) KPI + 직전 동일기간 비교값 (단일 행)
--   추세(%)는 클라이언트가 current vs prev 로 계산한다.
-- ---------------------------------------------------------------------
drop function if exists public.get_admin_analytics_overview(integer);

create function public.get_admin_analytics_overview(
  period_days integer default 7
)
returns table (
  total_users            bigint,
  new_users              bigint,
  new_users_prev         bigint,
  active_users           bigint,
  active_users_prev      bigint,
  reports_total          bigint,
  reports_resolved       bigint,
  reports_total_prev     bigint,
  reports_resolved_prev  bigint,
  posts_created          bigint,
  posts_created_prev     bigint,
  deliveries_sent        bigint,
  deliveries_failed      bigint,
  deliveries_sent_prev   bigint,
  deliveries_failed_prev bigint,
  revenue_krw            bigint,
  revenue_krw_prev       bigint,
  refunds_total          bigint,
  refunds_handled        bigint,
  refunds_total_prev     bigint,
  refunds_handled_prev   bigint,
  refunds_pending_now    bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  caller_id    uuid := auth.uid();
  v_days       integer := least(greatest(coalesce(period_days, 7), 1), 365);
  v_start      timestamptz;
  v_prev_start timestamptz;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then
    raise exception 'forbidden: admin required';
  end if;

  v_start := now() - make_interval(days => v_days);
  v_prev_start := now() - make_interval(days => v_days * 2);

  return query
  select
    (select count(*) from public.profiles),
    (select count(*) from public.profiles p
      where p.created_at >= v_start),
    (select count(*) from public.profiles p
      where p.created_at >= v_prev_start and p.created_at < v_start),
    (select count(*) from auth.users u
      where u.last_sign_in_at >= v_start),
    (select count(*) from auth.users u
      where u.last_sign_in_at >= v_prev_start and u.last_sign_in_at < v_start),
    (select count(*) from public.community_reports r
      where r.created_at >= v_start),
    (select count(*) from public.community_reports r
      where r.created_at >= v_start and r.process_status = 'resolved'),
    (select count(*) from public.community_reports r
      where r.created_at >= v_prev_start and r.created_at < v_start),
    (select count(*) from public.community_reports r
      where r.created_at >= v_prev_start and r.created_at < v_start
        and r.process_status = 'resolved'),
    (select count(*) from public.community_posts cp
      where cp.created_at >= v_start),
    (select count(*) from public.community_posts cp
      where cp.created_at >= v_prev_start and cp.created_at < v_start),
    (select count(*) from public.notification_delivery_attempts a
      where a.status = 'sent' and a.created_at >= v_start),
    (select count(*) from public.notification_delivery_attempts a
      where a.status = 'failed' and a.created_at >= v_start),
    (select count(*) from public.notification_delivery_attempts a
      where a.status = 'sent'
        and a.created_at >= v_prev_start and a.created_at < v_start),
    (select count(*) from public.notification_delivery_attempts a
      where a.status = 'failed'
        and a.created_at >= v_prev_start and a.created_at < v_start),
    (select (coalesce(sum(ph.amount_cents), 0) / 100)::bigint from public.payment_history ph
      where ph.status = 'paid' and coalesce(ph.paid_at, ph.created_at) >= v_start),
    (select (coalesce(sum(ph.amount_cents), 0) / 100)::bigint from public.payment_history ph
      where ph.status = 'paid'
        and coalesce(ph.paid_at, ph.created_at) >= v_prev_start
        and coalesce(ph.paid_at, ph.created_at) < v_start),
    (select count(*) from public.commerce_refunds f
      where f.requested_at >= v_start),
    (select count(*) from public.commerce_refunds f
      where f.requested_at >= v_start and f.status <> 'pending'),
    (select count(*) from public.commerce_refunds f
      where f.requested_at >= v_prev_start and f.requested_at < v_start),
    (select count(*) from public.commerce_refunds f
      where f.requested_at >= v_prev_start and f.requested_at < v_start
        and f.status <> 'pending'),
    (select count(*) from public.commerce_refunds f
      where f.status = 'pending');
end;
$$;

revoke all on function public.get_admin_analytics_overview(integer) from public;
grant execute on function public.get_admin_analytics_overview(integer) to authenticated;

comment on function public.get_admin_analytics_overview(integer) is
  '분석 개요 기간 KPI 집계(현재 기간 + 직전 동일기간). is_admin 전용, 집계 수치만 반환(PII 없음). 활성=기간 내 로그인, 도달률 분모=sent+failed, 매출=payment_history paid 합계(KRW).';
