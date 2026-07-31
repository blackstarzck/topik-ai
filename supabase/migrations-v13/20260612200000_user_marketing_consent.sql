-- =====================================================================
-- TALKPIK AI · Notification feature · 2026-06-12
-- Marketing consent + unsubscribe storage (H-2) — closes N-OPT-04 / N-EML-07
--
-- 계약/정책 (QA 시나리오 고정 — 임의 변경 금지):
--   - 마케팅 알림은 EXPLICIT opt-in 동의가 있어야 발송 자격이 있다.
--   - 동의 없는 사용자 → 발송 시도는 'opted_out'(절대 발송하지 않음, N-OPT-04).
--   - 마케팅 이메일은 동작하는 수신거부 링크를 포함해야 한다(법적 요건, N-EML-07).
--
-- 저장소 모델 (확정): 별도 가산형(additive) 테이블 public.user_marketing_consent.
--   profiles 테이블은 변경하지 않는다(plan O-7 "동의 이력 테이블" 옵션).
--
-- "유효 동의(effectively consented)" 규칙 (단일 정의 — 파이프라인이 의존):
--     consented_at is not null AND unsubscribed_at is null
--   (동의한 적이 있고, 이후 수신거부하지 않은 상태.)
--
-- 인증 모델:
--   - 소유자(user_id = auth.uid())는 자기 행을 select/insert/update (설정에서 opt-in/out).
--   - 파이프라인(service_role / SECURITY DEFINER)은 전 행을 읽는다.
--   - 토큰 기반 수신거부 플로우는 서버에서 service_role로 실행(토큰 자체가 인증)
--     하므로 anon 정책은 필요 없다.
-- =====================================================================

create table if not exists public.user_marketing_consent (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  consented_at      timestamptz,
  unsubscribed_at   timestamptz,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  source            text,
  updated_at        timestamptz not null default now()
);

comment on table public.user_marketing_consent is
  'H-2 마케팅 동의 이력. EXPLICIT opt-in 저장소. 유효 동의 = consented_at is not null AND unsubscribed_at is null. '
  'unsubscribe_token = 이메일 수신거부 링크 인증 토큰(서버 service_role 플로우). profiles 미변경(가산형). 소유자 RLS + service_role read.';
comment on column public.user_marketing_consent.consented_at is
  'EXPLICIT opt-in 시각. null = 동의한 적 없음 → 마케팅 발송 자격 없음(opted_out).';
comment on column public.user_marketing_consent.unsubscribed_at is
  '수신거부 시각. not null이면 동의가 있어도 발송 자격 없음(opted_out). 토큰 클릭 또는 설정에서 설정.';
comment on column public.user_marketing_consent.unsubscribe_token is
  '수신거부 링크 토큰(uuid). 이메일 본문 링크에 포함. 서버 service_role 플로우의 인증 수단(세션 불필요).';
comment on column public.user_marketing_consent.source is
  '동의 출처 (signup / settings / import). 감사용.';

-- updated_at autoupdate (public.touch_updated_at, 20260520120900).
drop trigger if exists trg_user_marketing_consent_touch_updated_at on public.user_marketing_consent;
create trigger trg_user_marketing_consent_touch_updated_at
  before update on public.user_marketing_consent
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- RLS : owner full (select/insert/update own row) + force.
--   service_role(SECURITY DEFINER 파이프라인)은 RLS를 우회하므로 별도 정책 불필요.
--   anon 정책 없음 — 토큰 수신거부는 서버 service_role로만 실행.
-- =====================================================================
alter table public.user_marketing_consent enable row level security;
alter table public.user_marketing_consent force  row level security;

drop policy if exists user_marketing_consent_owner_select on public.user_marketing_consent;
create policy user_marketing_consent_owner_select
  on public.user_marketing_consent
  for select to authenticated
  using ( user_id = (select auth.uid()) );

drop policy if exists user_marketing_consent_owner_insert on public.user_marketing_consent;
create policy user_marketing_consent_owner_insert
  on public.user_marketing_consent
  for insert to authenticated
  with check ( user_id = (select auth.uid()) );

drop policy if exists user_marketing_consent_owner_update on public.user_marketing_consent;
create policy user_marketing_consent_owner_update
  on public.user_marketing_consent
  for update to authenticated
  using ( user_id = (select auth.uid()) )
  with check ( user_id = (select auth.uid()) );
