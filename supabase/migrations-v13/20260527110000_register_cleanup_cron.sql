-- =====================================================================
-- TALKPIK AI · Phase 8 follow-up · 2026-05-27
-- cleanup_unconfirmed_users() pg_cron 자동 스케줄 등록
--
-- v1 보고서가 "매일 04:00 UTC pg_cron 자동 실행" 주장 — 그러나 마이그레이션
-- 20260526180000_cleanup_unconfirmed_users.sql에 cron.schedule 등록이 없었음
-- (Codex GPT-5 자체 검수에서 적발, 2026-05-27).
--
-- 본 마이그레이션이 source-of-truth 통합:
--   - pg_cron extension 존재 시에만 등록 (local Docker에 미설치 가능)
--   - jobname `cleanup_unconfirmed_users` (원격에 이미 등록된 이름과 일치 — 2026-05-27
--     사용자 Dashboard 조회로 확인). idempotent unschedule-then-register로 처리.
--   - schedule: 0 4 * * * (매일 04:00 UTC)
--   - command: select private.cleanup_unconfirmed_users()  (기본 인자: retention_days=30, dry_run=false, max_batch=1000)
--
-- 권한: cron.schedule은 일반적으로 postgres role 전용. 마이그레이션 적용 user가
-- 등록한 job은 동일 role(postgres)로 실행되며, private.cleanup_unconfirmed_users는
-- SECURITY DEFINER로 owner 권한으로 동작하므로 auth.users / storage.objects 정리 가능.
--
-- pg_cron 미설치 환경 처리: 조용히 skip + raise notice. 마이그레이션 자체는 성공.
-- Supabase Cloud는 일반적으로 pg_cron 활성화. 누락 시 Dashboard → Database
-- → Extensions → pg_cron 토글 후 본 마이그레이션 재적용.
-- =====================================================================

do $$
declare
  v_jobid bigint;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron extension not installed — skipping cleanup_unconfirmed_users registration';
    return;
  end if;

  -- 동일 jobname 기존 job 제거 (idempotent)
  select jobid
  into v_jobid
  from cron.job
  where jobname = 'cleanup_unconfirmed_users'
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
    raise log 'cleanup_unconfirmed_users: existing job (jobid=%) unscheduled before reregister', v_jobid;
  end if;

  -- 매일 04:00 UTC에 cleanup 함수 호출
  perform cron.schedule(
    'cleanup_unconfirmed_users',
    '0 4 * * *',
    $sql$ select private.cleanup_unconfirmed_users() $sql$
  );

  raise log 'cleanup_unconfirmed_users cron job registered (0 4 * * * UTC)';
end $$;
