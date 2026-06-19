-- =====================================================================
-- topik-ai admin - Operation policies - admin-0014
-- Operation > 정책 관리 mock -> Supabase 전환.
--
-- RLS 모델: 읽기 = admin(private.is_admin), 쓰기 = SECURITY DEFINER RPC 단일 경로.
-- enum: status만 ASCII(published/hidden) 저장, 나머지 정책 코드값은 policy-types.ts 한글 값을 유지.
-- 배열: jsonb array. 히스토리 snapshot: OperationPolicy camelCase 스냅샷.
-- down: supabase/migrations-admin/down/20260617170000_operation_policies.sql
-- =====================================================================

create table if not exists public.operation_policies (
  id                   text primary key,
  category             text not null,
  policy_type          text not null,
  title                text not null,
  version_label        text,
  effective_date       date,
  exposure_surfaces    jsonb not null default '[]'::jsonb,
  requires_consent     boolean not null default false,
  tracking_status      text,
  status               text not null default 'hidden',
  related_admin_pages  jsonb not null default '[]'::jsonb,
  related_user_pages   jsonb not null default '[]'::jsonb,
  source_documents     jsonb not null default '[]'::jsonb,
  legal_references     jsonb not null default '[]'::jsonb,
  summary              text,
  body_html            text not null default '',
  admin_memo           text,
  current_version_id   text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  updated_by           text
);

create table if not exists public.operation_policy_histories (
  id             text primary key,
  policy_id      text not null references public.operation_policies(id) on delete cascade,
  action         text not null,
  version_label  text,
  changed_at     timestamptz not null default now(),
  changed_by     text,
  snapshot       jsonb not null
);

alter table public.operation_policies drop constraint if exists operation_policies_category_check;
alter table public.operation_policies add constraint operation_policies_category_check
  check (category in ('법률/약관','커뮤니티/안전','결제/리워드','운영/콘텐츠','메시지/알림','관리자/보안'));

alter table public.operation_policies drop constraint if exists operation_policies_policy_type_check;
alter table public.operation_policies add constraint operation_policies_policy_type_check
  check (policy_type in ('이용약관','개인정보 처리방침','결제ㆍ환불 정책','청소년 보호정책','커뮤니티 게시글 제재 정책','추천인 보상 정책','포인트 운영정책','쿠폰 운영정책','이벤트 운영정책','FAQ 노출 정책','챗봇 상담 전환 정책','메일 발송 운영정책','푸시 발송 운영정책','발송 실패/재시도 정책','관리자 권한 변경 정책','마케팅 정보 수신 동의'));

alter table public.operation_policies drop constraint if exists operation_policies_tracking_status_check;
alter table public.operation_policies add constraint operation_policies_tracking_status_check
  check (tracking_status is null or tracking_status in ('코드 반영','문서 추적','정책 미확정'));

alter table public.operation_policies drop constraint if exists operation_policies_status_check;
alter table public.operation_policies add constraint operation_policies_status_check
  check (status in ('published','hidden'));

alter table public.operation_policies drop constraint if exists operation_policies_exposure_surfaces_array_check;
alter table public.operation_policies add constraint operation_policies_exposure_surfaces_array_check
  check (jsonb_typeof(exposure_surfaces) = 'array');
alter table public.operation_policies drop constraint if exists operation_policies_related_admin_pages_array_check;
alter table public.operation_policies add constraint operation_policies_related_admin_pages_array_check
  check (jsonb_typeof(related_admin_pages) = 'array');
alter table public.operation_policies drop constraint if exists operation_policies_related_user_pages_array_check;
alter table public.operation_policies add constraint operation_policies_related_user_pages_array_check
  check (jsonb_typeof(related_user_pages) = 'array');
alter table public.operation_policies drop constraint if exists operation_policies_source_documents_array_check;
alter table public.operation_policies add constraint operation_policies_source_documents_array_check
  check (jsonb_typeof(source_documents) = 'array');
alter table public.operation_policies drop constraint if exists operation_policies_legal_references_array_check;
alter table public.operation_policies add constraint operation_policies_legal_references_array_check
  check (jsonb_typeof(legal_references) = 'array');

alter table public.operation_policy_histories drop constraint if exists operation_policy_histories_action_check;
alter table public.operation_policy_histories add constraint operation_policy_histories_action_check
  check (action in ('created','updated','status_changed','version_published','deleted'));

create index if not exists operation_policies_created_desc
  on public.operation_policies (created_at desc);
create index if not exists operation_policies_published_created_desc
  on public.operation_policies (created_at desc)
  where status = 'published';
create index if not exists operation_policy_histories_policy_id
  on public.operation_policy_histories (policy_id);
create index if not exists operation_policy_histories_policy_changed_desc
  on public.operation_policy_histories (policy_id, changed_at desc);

alter table public.operation_policies enable row level security;
alter table public.operation_policies force row level security;
drop policy if exists operation_policies_admin_select on public.operation_policies;
create policy operation_policies_admin_select on public.operation_policies
  for select to authenticated using (private.is_admin((select auth.uid())));

alter table public.operation_policy_histories enable row level security;
alter table public.operation_policy_histories force row level security;
drop policy if exists operation_policy_histories_admin_select on public.operation_policy_histories;
create policy operation_policy_histories_admin_select on public.operation_policy_histories
  for select to authenticated using (private.is_admin((select auth.uid())));

create or replace function public.operation_policy_snapshot(p_policy public.operation_policies)
returns jsonb
language sql
stable
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', p_policy.id,
    'category', p_policy.category,
    'policyType', p_policy.policy_type,
    'title', p_policy.title,
    'versionLabel', coalesce(p_policy.version_label, ''),
    'effectiveDate', coalesce(p_policy.effective_date::text, ''),
    'exposureSurfaces', p_policy.exposure_surfaces,
    'requiresConsent', p_policy.requires_consent,
    'trackingStatus', coalesce(p_policy.tracking_status, '문서 추적'),
    'relatedAdminPages', p_policy.related_admin_pages,
    'relatedUserPages', p_policy.related_user_pages,
    'sourceDocuments', p_policy.source_documents,
    'summary', coalesce(p_policy.summary, ''),
    'legalReferences', p_policy.legal_references,
    'bodyHtml', p_policy.body_html,
    'adminMemo', coalesce(p_policy.admin_memo, ''),
    'status', case p_policy.status when 'published' then '게시' else '숨김' end,
    'createdAt', p_policy.created_at::date::text,
    'updatedAt', to_char(p_policy.updated_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'),
    'updatedBy', coalesce(p_policy.updated_by, 'system')
  );
$$;

create or replace function public.next_operation_policy_id()
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select 'POL-' || lpad((coalesce(max(substring(id from '^POL-([0-9]+)$')::integer), 0) + 1)::text, 3, '0')
  from public.operation_policies
  where id ~ '^POL-[0-9]+$';
$$;

create or replace function public.next_operation_policy_history_id()
returns text
language sql
stable
set search_path = pg_catalog, public
as $$
  select 'PH-' || lpad((coalesce(max(substring(id from '^PH-([0-9]+)$')::integer), 0) + 1)::text, 4, '0')
  from public.operation_policy_histories
  where id ~ '^PH-[0-9]+$';
$$;
revoke all on function public.operation_policy_snapshot(public.operation_policies) from public;
revoke all on function public.next_operation_policy_id() from public;
revoke all on function public.next_operation_policy_history_id() from public;

insert into public.operation_policies (
  id, category, policy_type, title, version_label, effective_date, exposure_surfaces,
  requires_consent, tracking_status, status, related_admin_pages, related_user_pages,
  source_documents, legal_references, summary, body_html, admin_memo,
  current_version_id, created_at, updated_at, updated_by
)
select
  id, category, policy_type, title, version_label, effective_date::date, exposure_surfaces,
  requires_consent, tracking_status, status, related_admin_pages, related_user_pages,
  source_documents, legal_references, summary, body_html, admin_memo,
  current_version_id, created_at::timestamptz, updated_at::timestamptz, updated_by
from jsonb_to_recordset($seed$
[
  {"id":"POL-001","category":"법률/약관","policy_type":"이용약관","title":"TOPIK AI 이용약관","version_label":"v2026.03","effective_date":"2026-03-20","exposure_surfaces":["회원가입","마이페이지","고객센터"],"requires_consent":true,"tracking_status":"코드 반영","status":"published","related_admin_pages":["Operation > 정책 관리","Users > 회원 목록","Users > 회원 상세"],"related_user_pages":["회원가입 > 약관 동의","마이페이지 > 정책 링크","고객센터 > 정책 문서"],"source_documents":["docs/specs/page-ia/operation-policies-page-ia.md","docs/specs/admin-data-usage-map.md"],"legal_references":["전자상거래 등에서의 소비자보호에 관한 법률","민법"],"summary":"서비스 이용 조건, 계정 운영 기준, 결제 및 콘텐츠 이용 제한 사항을 정리한 기본 약관입니다.","body_html":"<h2>TOPIK AI 이용약관</h2><p>회원은 계정 생성 시 본 약관에 동의하며, 학습 서비스와 커뮤니티 기능을 약관 범위 내에서 이용할 수 있습니다.</p>","admin_memo":"회원가입 고객센터, 마이페이지 약관 링크 기준 문서입니다.","current_version_id":"PH-0001","created_at":"2026-03-18 00:00:00+09","updated_at":"2026-03-20 09:10:00+09","updated_by":"admin_park"},
  {"id":"POL-002","category":"법률/약관","policy_type":"개인정보 처리방침","title":"TOPIK AI 개인정보 처리방침","version_label":"v2026.03","effective_date":"2026-03-20","exposure_surfaces":["회원가입","마이페이지","고객센터","앱 설정"],"requires_consent":true,"tracking_status":"코드 반영","status":"published","related_admin_pages":["Operation > 정책 관리","Users > 회원 상세","Message > 메일"],"related_user_pages":["회원가입 > 약관 동의","마이페이지 > 개인정보/수신 동의 설정","앱 설정 > 법적 고지"],"source_documents":["docs/specs/page-ia/operation-policies-page-ia.md","docs/specs/admin-data-usage-map.md"],"legal_references":["개인정보 보호법","정보통신망 이용촉진 및 정보보호 등에 관한 법률"],"summary":"수집 항목, 처리 목적, 보관 기간, 파기 절차를 공지합니다.","body_html":"<h2>개인정보 처리방침</h2><p>회사는 서비스 제공에 필요한 최소한의 개인정보를 수집합니다.</p>","admin_memo":"앱 설정 법적 고지와 회원가입 하단 노출 기준 문서입니다.","current_version_id":"PH-0002","created_at":"2026-03-18 00:00:00+09","updated_at":"2026-03-20 09:25:00+09","updated_by":"admin_park"},
  {"id":"POL-003","category":"결제/리워드","policy_type":"결제ㆍ환불 정책","title":"결제ㆍ환불 정책","version_label":"v2026.04","effective_date":"2026-04-01","exposure_surfaces":["결제","마이페이지","고객센터","관리자 콘솔"],"requires_consent":true,"tracking_status":"문서 추적","status":"published","related_admin_pages":["Commerce > 결제 내역","Commerce > 환불 관리","Commerce > 포인트 관리"],"related_user_pages":["결제 > 약관/환불 안내","마이페이지 > 정책 링크","고객센터 > 정책 문서"],"source_documents":["docs/specs/page-ia/commerce-refunds-page-ia.md","docs/specs/page-ia/commerce-payments-page-ia.md","docs/specs/admin-page-gap-register.md"],"legal_references":["전자상거래 등에서의 소비자보호에 관한 법률","전자상거래 등에서의 소비자보호 지침"],"summary":"결제 승인, 환불 가능 조건, 부분 환불 제한과 고객 안내 기준을 추적합니다.","body_html":"<h2>결제ㆍ환불 정책</h2><p>결제 후 7일 이내이며 학습 이력이 없는 경우 전액 환불을 원칙으로 검토합니다.</p>","admin_memo":"결제 내역/환불 관리 화면의 부분 환불, 고객 안내 규칙을 함께 추적합니다.","current_version_id":"PH-0003","created_at":"2026-03-21 00:00:00+09","updated_at":"2026-03-24 15:40:00+09","updated_by":"admin_kim"},
  {"id":"POL-004","category":"커뮤니티/안전","policy_type":"청소년 보호정책","title":"청소년 보호정책","version_label":"v2026.03","effective_date":"2026-03-22","exposure_surfaces":["고객센터","앱 설정","관리자 콘솔"],"requires_consent":false,"tracking_status":"코드 반영","status":"published","related_admin_pages":["Community > 게시글 관리","Community > 신고 관리","Operation > 정책 관리"],"related_user_pages":["커뮤니티 > 게시글 작성/이용 안내","고객센터 > 정책 문서","앱 설정 > 법적 고지"],"source_documents":["docs/specs/page-ia/community-posts-page-ia.md","docs/specs/admin-page-gap-register.md"],"legal_references":["청소년보호법","정보통신망 이용촉진 및 정보보호 등에 관한 법률"],"summary":"유해 정보 차단, 신고 접수, 청소년 보호 책임자 안내 기준을 제공합니다.","body_html":"<h2>청소년 보호정책</h2><p>청소년 유해 정보 노출 방지와 신고 처리 기준을 운영 정책으로 관리합니다.</p>","admin_memo":"커뮤니티 안전 정책과 법적 고지 영역을 연결하는 기준 문서입니다.","current_version_id":"PH-0004","created_at":"2026-03-19 00:00:00+09","updated_at":"2026-03-22 10:15:00+09","updated_by":"admin_han"},
  {"id":"POL-005","category":"커뮤니티/안전","policy_type":"커뮤니티 게시글 제재 정책","title":"커뮤니티 게시글 제재 정책","version_label":"v2026.03","effective_date":"2026-03-25","exposure_surfaces":["고객센터","앱 설정","관리자 콘솔"],"requires_consent":false,"tracking_status":"코드 반영","status":"published","related_admin_pages":["Community > 게시글 관리","Community > 신고 관리","System > 감사 로그"],"related_user_pages":["커뮤니티 > 게시글 작성/이용 안내","고객센터 > 정책 문서"],"source_documents":["docs/specs/page-ia/community-posts-page-ia.md","src/features/community/pages/community-posts-page.tsx"],"legal_references":["정보통신망 이용촉진 및 정보보호 등에 관한 법률","청소년보호법"],"summary":"게시글 숨김/삭제 시 적용하는 정책 코드, 자유 사유, 내부 메모 기록 규칙입니다.","body_html":"<h2>커뮤니티 게시글 제재 정책</h2><p>게시글 조치 시 정책 코드와 자유 사유를 함께 기록하고 감사 로그에 내부 메모를 남깁니다.</p>","admin_memo":"게시글 관리의 ConfirmAction 정책 코드 기준입니다.","current_version_id":"PH-0005","created_at":"2026-03-22 00:00:00+09","updated_at":"2026-03-25 11:05:00+09","updated_by":"admin_lee"},
  {"id":"POL-006","category":"결제/리워드","policy_type":"추천인 보상 정책","title":"추천인 보상 정책","version_label":"v2026.03-draft","effective_date":"2026-03-26","exposure_surfaces":["관리자 콘솔","마이페이지"],"requires_consent":false,"tracking_status":"문서 추적","status":"hidden","related_admin_pages":["Users > 추천인 관리","Commerce > 포인트 관리","System > 감사 로그"],"related_user_pages":["마이페이지 > 정책 링크","결제 > 쿠폰/포인트 적용","이벤트 > 상세"],"source_documents":["docs/specs/page-ia/users-referrals-page-ia.md","src/features/users/pages/users-referrals-page.tsx"],"legal_references":["서비스 운영 정책 초안","추천인 관리 상세 IA"],"summary":"추천 코드 확정 시점, 보상 수단, 회수 규칙을 추적하는 운영 정책 초안입니다.","body_html":"<h2>추천인 보상 정책</h2><p>추천 코드는 추천인 1명당 1개를 기준으로 관리하며 확정과 보상 지급을 정책 흐름으로 기록합니다.</p>","admin_memo":"추천인 페이지의 policySnapshot과 스냅 이슈를 정책 관리로 연결할 초안입니다.","current_version_id":"PH-0006","created_at":"2026-03-26 00:00:00+09","updated_at":"2026-03-26 09:40:00+09","updated_by":"admin_park"},
  {"id":"POL-007","category":"결제/리워드","policy_type":"포인트 운영정책","title":"포인트 운영정책","version_label":"v2026.03-draft","effective_date":"2026-03-26","exposure_surfaces":["관리자 콘솔","결제","마이페이지"],"requires_consent":false,"tracking_status":"문서 추적","status":"hidden","related_admin_pages":["Commerce > 포인트 관리","Users > 추천인 관리","Operation > 이벤트"],"related_user_pages":["결제 > 쿠폰/포인트 적용","마이페이지 > 정책 링크"],"source_documents":["docs/specs/page-ia/commerce-points-page-ia.md","docs/specs/admin-page-gap-register.md"],"legal_references":["포인트 관리 상세 IA","서비스 운영 정책 초안"],"summary":"적립 원천 분류, 차감 우선순위, 만료/보류/복구 기준을 추적합니다.","body_html":"<h2>포인트 운영정책</h2><p>포인트는 추천, 미션, 이벤트, 결제, 환불, 관리자 원천으로 발생할 수 있으며 원장 단위로 검증합니다.</p>","admin_memo":"포인트 관리 living IA의 정책 후보를 운영 정책으로 집약했습니다.","current_version_id":"PH-0007","created_at":"2026-03-26 00:00:00+09","updated_at":"2026-03-26 09:55:00+09","updated_by":"admin_park"},
  {"id":"POL-008","category":"결제/리워드","policy_type":"쿠폰 운영정책","title":"쿠폰 운영정책","version_label":"v2026.03","effective_date":"2026-03-24","exposure_surfaces":["관리자 콘솔","결제","마이페이지"],"requires_consent":false,"tracking_status":"코드 반영","status":"published","related_admin_pages":["Commerce > 쿠폰 관리","Operation > 이벤트","Message > 메일"],"related_user_pages":["결제 > 쿠폰/포인트 적용","이벤트 > 상세","마이페이지 > 정책 링크"],"source_documents":["docs/specs/page-ia/commerce-coupons-page-ia.md","docs/specs/page-ia/operation-events-page-ia.md"],"legal_references":["쿠폰 관리 상세 IA","이벤트 운영 정책 확인 메모"],"summary":"고객 다운로드, 자동 발행, 쿠폰 코드 생성, 지정 발행 기준을 모은 정책 문서입니다.","body_html":"<h2>쿠폰 운영정책</h2><p>쿠폰은 고객 다운로드, 자동 발행, 쿠폰 코드 생성, 지정 발행 4가지 유형으로 운영합니다.</p>","admin_memo":"쿠폰 관리 상세 IA와 이벤트 보상 연결 규칙을 함께 반영했습니다.","current_version_id":"PH-0008","created_at":"2026-03-24 00:00:00+09","updated_at":"2026-03-26 10:05:00+09","updated_by":"admin_lee"},
  {"id":"POL-009","category":"운영/콘텐츠","policy_type":"이벤트 운영정책","title":"이벤트 운영정책","version_label":"v2026.03-draft","effective_date":"2026-03-26","exposure_surfaces":["관리자 콘솔","고객센터"],"requires_consent":false,"tracking_status":"문서 추적","status":"hidden","related_admin_pages":["Operation > 이벤트","Commerce > 쿠폰 관리","Message > 대상 그룹"],"related_user_pages":["이벤트 > 상세","고객센터 > 정책 문서"],"source_documents":["docs/specs/page-ia/operation-events-page-ia.md","docs/specs/admin-page-gap-register.md"],"legal_references":["이벤트 상세 IA","서비스 운영 정책 초안"],"summary":"이벤트 노출, 참여 조건, 보상 연결, 메시지/쿠폰 연동, 종료 후 복구 여부를 추적합니다.","body_html":"<h2>이벤트 운영정책</h2><p>이벤트는 목록 검색지와 등록 상세 페이지를 분리해 운영하고 게시 예약과 종료 조치 감사 로그를 남깁니다.</p>","admin_memo":"이벤트 보상 수단과 종료 후 복구 가능 여부는 계속 확정 대상입니다.","current_version_id":"PH-0009","created_at":"2026-03-26 00:00:00+09","updated_at":"2026-03-26 10:12:00+09","updated_by":"admin_kim"},
  {"id":"POL-010","category":"운영/콘텐츠","policy_type":"FAQ 노출 정책","title":"FAQ 노출 정책","version_label":"v2026.03","effective_date":"2026-03-25","exposure_surfaces":["관리자 콘솔","고객센터"],"requires_consent":false,"tracking_status":"코드 반영","status":"published","related_admin_pages":["Operation > FAQ","Operation > 챗봇 설정","System > 감사 로그"],"related_user_pages":["FAQ > 고객센터 FAQ","챗봇 > 상담 전환 안내"],"source_documents":["docs/specs/page-ia/operation-faq-page-ia.md","docs/specs/admin-data-usage-map.md"],"legal_references":["FAQ 상세 IA"],"summary":"FAQ 질문 공개/비공개와 추천, 결제 화면 후보 FAQ 노출 릴레이션 규칙입니다.","body_html":"<h2>FAQ 노출 정책</h2><p>FAQ는 질문 관리와 노출 관리, 직접 보기 3개 축으로 운영합니다.</p>","admin_memo":"FAQ 노출 관리와 챗봇 지원 참조 기준을 동시에 추적합니다.","current_version_id":"PH-0010","created_at":"2026-03-25 00:00:00+09","updated_at":"2026-03-26 10:18:00+09","updated_by":"admin_han"},
  {"id":"POL-011","category":"운영/콘텐츠","policy_type":"챗봇 상담 전환 정책","title":"챗봇 상담 전환 정책","version_label":"v2026.03-candidate","effective_date":"2026-03-26","exposure_surfaces":["관리자 콘솔","고객센터"],"requires_consent":false,"tracking_status":"정책 미확정","status":"hidden","related_admin_pages":["Operation > 챗봇 설정","Operation > FAQ","Message > 메일"],"related_user_pages":["챗봇 > 상담 전환 안내","FAQ > 고객센터 FAQ"],"source_documents":["docs/specs/page-ia/operation-chatbot-page-ia.md","docs/specs/admin-page-gap-register.md"],"legal_references":["챗봇 설정 상세 IA"],"summary":"챗봇 fallback, 상담 연결, FAQ 지원 참조, 버전 비교 기준을 placeholder 단계에서 추적합니다.","body_html":"<h2>챗봇 상담 전환 정책</h2><p>챗봇 설정 화면은 아직 placeholder이며 상담 전환 기준을 먼저 확정해야 합니다.</p>","admin_memo":"현재는 문서 추적용 후보 정책입니다.","current_version_id":"PH-0011","created_at":"2026-03-26 00:00:00+09","updated_at":"2026-03-26 10:22:00+09","updated_by":"admin_park"},
  {"id":"POL-012","category":"메시지/알림","policy_type":"메일 발송 운영정책","title":"메일 발송 운영정책","version_label":"v2026.03","effective_date":"2026-03-25","exposure_surfaces":["관리자 콘솔","앱 설정"],"requires_consent":false,"tracking_status":"코드 반영","status":"published","related_admin_pages":["Message > 메일","Message > 대상 그룹","Message > 발송 이력"],"related_user_pages":["이메일 > 운영/정책 안내"],"source_documents":["docs/specs/page-ia/message-mail-page-ia.md","docs/specs/page-ia/message-history-page-ia.md"],"legal_references":["메일 상세 IA","정보통신망 이용촉진 및 정보보호 등에 관한 법률"],"summary":"메일 템플릿 메타 등록, TinyMCE 본문 작성, 즉시/예약 발송, 수신 그룹 연동 규칙입니다.","body_html":"<h2>메일 발송 운영정책</h2><p>메일 템플릿 목록에서 메타를 등록하고 등록 상세 페이지에서 TinyMCE 본문을 작성합니다.</p>","admin_memo":"메일 템플릿과 발송 이력 검증 정책을 함께 묶었습니다.","current_version_id":"PH-0012","created_at":"2026-03-25 00:00:00+09","updated_at":"2026-03-26 10:28:00+09","updated_by":"admin_lee"},
  {"id":"POL-013","category":"메시지/알림","policy_type":"푸시 발송 운영정책","title":"푸시 발송 운영정책","version_label":"v2026.03","effective_date":"2026-03-25","exposure_surfaces":["관리자 콘솔","앱 설정"],"requires_consent":false,"tracking_status":"코드 반영","status":"published","related_admin_pages":["Message > 푸시","Message > 대상 그룹","Message > 발송 이력"],"related_user_pages":["앱/웹 푸시 > 운영/정책 안내"],"source_documents":["docs/specs/page-ia/message-push-page-ia.md","docs/specs/page-ia/message-history-page-ia.md"],"legal_references":["푸시 상세 IA","정보통신망 이용촉진 및 정보보호 등에 관한 법률"],"summary":"푸시 템플릿 메타 등록, TinyMCE 본문 작성, 즉시/예약 발송과 상태 전환 기준입니다.","body_html":"<h2>푸시 발송 운영정책</h2><p>푸시 템플릿 메타 등록 후 본문 상세에서 HTML 기반 콘텐츠를 작성하고 대상 그룹과 예약 시각을 검증합니다.</p>","admin_memo":"푸시 템플릿 운영과 발송 이력 검증 규칙의 공통 기준입니다.","current_version_id":"PH-0013","created_at":"2026-03-25 00:00:00+09","updated_at":"2026-03-26 10:31:00+09","updated_by":"admin_lee"},
  {"id":"POL-014","category":"메시지/알림","policy_type":"발송 실패/재시도 정책","title":"발송 실패/재시도 정책","version_label":"v2026.03-candidate","effective_date":"2026-03-26","exposure_surfaces":["관리자 콘솔"],"requires_consent":false,"tracking_status":"정책 미확정","status":"hidden","related_admin_pages":["Message > 발송 이력","Message > 메일","Message > 푸시"],"related_user_pages":["이메일 > 운영/정책 안내","앱/웹 푸시 > 운영/정책 안내"],"source_documents":["docs/specs/page-ia/message-history-page-ia.md","docs/specs/admin-page-gap-register.md"],"legal_references":["발송 이력 상세 IA"],"summary":"발송 실패 건의 재시도 범위, 중복 발송 방지, CSV 내보내기 감사 여부를 추적합니다.","body_html":"<h2>발송 실패/재시도 정책</h2><p>발송 실패 이력은 재시도 범위와 중복 발송 방지 기준이 확정되어야 합니다.</p>","admin_memo":"발송 이력 페이지 스냅 이슈를 정책 관리에서 추적하도록 추가한 후보 문서입니다.","current_version_id":"PH-0014","created_at":"2026-03-26 00:00:00+09","updated_at":"2026-03-26 10:36:00+09","updated_by":"admin_kim"},
  {"id":"POL-015","category":"관리자/보안","policy_type":"관리자 권한 변경 정책","title":"관리자 권한 변경 정책","version_label":"v2026.03-draft","effective_date":"2026-03-26","exposure_surfaces":["관리자 콘솔"],"requires_consent":false,"tracking_status":"문서 추적","status":"hidden","related_admin_pages":["System > 권한 관리","System > 관리자 계정","System > 감사 로그"],"related_user_pages":[],"source_documents":["docs/specs/page-ia/system-permissions-page-ia.md","docs/specs/admin-page-gap-register.md","src/features/system/pages/system-permissions-page.tsx"],"legal_references":["권한 관리 상세 IA","내부 보안 운영 지침 초안"],"summary":"권한 부여/수정, 회수 사유 입력, 감사 추적, 승인 체계 미확정 항목을 관리합니다.","body_html":"<h2>관리자 권한 변경 정책</h2><p>권한 변경은 대상 관리자, 변경 권한, 사유, 수행자를 함께 기록하고 감사 로그에서 추적할 수 있어야 합니다.</p>","admin_memo":"actor 하드코딩과 승인 체계 미확정이 남아 있어 문서 추적 상태로 관리합니다.","current_version_id":"PH-0015","created_at":"2026-03-26 00:00:00+09","updated_at":"2026-03-26 10:42:00+09","updated_by":"admin_park"},
  {"id":"POL-016","category":"메시지/알림","policy_type":"마케팅 정보 수신 동의","title":"마케팅 정보 수신 동의","version_label":"v2026.03","effective_date":"2026-03-20","exposure_surfaces":["회원가입","마이페이지","앱 설정","관리자 콘솔"],"requires_consent":true,"tracking_status":"코드 반영","status":"published","related_admin_pages":["Message > 메일","Message > 푸시","Users > 회원 상세"],"related_user_pages":["회원가입 > 마케팅 수신 동의","마이페이지 > 개인정보/수신 동의 설정"],"source_documents":["docs/specs/page-ia/message-mail-page-ia.md","docs/specs/page-ia/message-push-page-ia.md","docs/specs/admin-data-usage-map.md"],"legal_references":["정보통신망 이용촉진 및 정보보호 등에 관한 법률"],"summary":"프로모션 메일/푸시 발송을 위한 수신 동의 항목과 철회 방법을 정리합니다.","body_html":"<h2>마케팅 정보 수신 동의</h2><p>회원은 메일, 앱 푸시, 문자 수신 동의를 선택적으로 설정할 수 있으며 언제든지 철회할 수 있습니다.</p>","admin_memo":"메일/푸시 템플릿 운영과 수신 거부 처리 기준의 동의 문서입니다.","current_version_id":"PH-0016","created_at":"2026-03-18 00:00:00+09","updated_at":"2026-03-20 09:30:00+09","updated_by":"admin_park"}
]
$seed$::jsonb) as seed(
  id text, category text, policy_type text, title text, version_label text, effective_date text,
  exposure_surfaces jsonb, requires_consent boolean, tracking_status text, status text,
  related_admin_pages jsonb, related_user_pages jsonb, source_documents jsonb, legal_references jsonb,
  summary text, body_html text, admin_memo text, current_version_id text,
  created_at text, updated_at text, updated_by text
)
on conflict (id) do nothing;

insert into public.operation_policy_histories (
  id, policy_id, action, version_label, changed_at, changed_by, snapshot
)
select
  'PH-' || lpad(substring(policy.id from '^POL-([0-9]+)$'), 4, '0'),
  policy.id,
  'created',
  policy.version_label,
  policy.updated_at,
  policy.updated_by,
  public.operation_policy_snapshot(policy)
from public.operation_policies policy
where policy.id between 'POL-001' and 'POL-016'
on conflict (id) do nothing;

create or replace function public.admin_save_operation_policy(
  p_id     text,
  p_policy jsonb,
  p_reason text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_id text;
  v_old public.operation_policies%rowtype;
  v_saved public.operation_policies%rowtype;
  v_action text;
  v_history_action text;
  v_diff jsonb := '{}'::jsonb;
  v_status text;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if nullif(btrim(coalesce(p_policy->>'title', '')), '') is null then raise exception 'title required'; end if;

  if (p_policy->>'category') not in ('법률/약관','커뮤니티/안전','결제/리워드','운영/콘텐츠','메시지/알림','관리자/보안') then
    raise exception 'invalid policy category: %', p_policy->>'category';
  end if;
  if (p_policy->>'policy_type') not in ('이용약관','개인정보 처리방침','결제ㆍ환불 정책','청소년 보호정책','커뮤니티 게시글 제재 정책','추천인 보상 정책','포인트 운영정책','쿠폰 운영정책','이벤트 운영정책','FAQ 노출 정책','챗봇 상담 전환 정책','메일 발송 운영정책','푸시 발송 운영정책','발송 실패/재시도 정책','관리자 권한 변경 정책','마케팅 정보 수신 동의') then
    raise exception 'invalid policy_type: %', p_policy->>'policy_type';
  end if;

  if nullif(btrim(coalesce(p_id, '')), '') is null then
    v_id := public.next_operation_policy_id();
    v_status := 'hidden';
    v_action := 'policy_saved';
    v_history_action := 'created';

    insert into public.operation_policies (
      id, category, policy_type, title, version_label, effective_date, exposure_surfaces,
      requires_consent, tracking_status, status, related_admin_pages, related_user_pages,
      source_documents, legal_references, summary, body_html, admin_memo, updated_by
    ) values (
      v_id,
      p_policy->>'category',
      p_policy->>'policy_type',
      btrim(p_policy->>'title'),
      nullif(btrim(coalesce(p_policy->>'version_label', '')), ''),
      nullif(btrim(coalesce(p_policy->>'effective_date', '')), '')::date,
      coalesce(p_policy->'exposure_surfaces', '[]'::jsonb),
      coalesce((p_policy->>'requires_consent')::boolean, false),
      nullif(btrim(coalesce(p_policy->>'tracking_status', '')), ''),
      v_status,
      coalesce(p_policy->'related_admin_pages', '[]'::jsonb),
      coalesce(p_policy->'related_user_pages', '[]'::jsonb),
      coalesce(p_policy->'source_documents', '[]'::jsonb),
      coalesce(p_policy->'legal_references', '[]'::jsonb),
      coalesce(p_policy->>'summary', ''),
      coalesce(p_policy->>'body_html', ''),
      nullif(btrim(coalesce(p_policy->>'admin_memo', '')), ''),
      caller_id::text
    )
    returning * into v_saved;
  else
    v_id := btrim(p_id);
    select * into v_old from public.operation_policies where id = v_id for update;
    if not found then raise exception 'unknown policy id: %', v_id; end if;

    v_action := 'policy_saved';
    v_history_action := case when coalesce(p_policy->>'mode', '') = 'version' then 'updated' else 'updated' end;
    v_status := case when coalesce(p_policy->>'mode', '') = 'version' then 'hidden' else v_old.status end;

    if v_old.title is distinct from btrim(p_policy->>'title') then
      v_diff := v_diff || jsonb_build_object('title', jsonb_build_object('from', v_old.title, 'to', btrim(p_policy->>'title')));
    end if;
    if v_old.version_label is distinct from nullif(btrim(coalesce(p_policy->>'version_label', '')), '') then
      v_diff := v_diff || jsonb_build_object('version_label', jsonb_build_object('from', v_old.version_label, 'to', nullif(btrim(coalesce(p_policy->>'version_label', '')), '')));
    end if;

    update public.operation_policies
       set category = p_policy->>'category',
           policy_type = p_policy->>'policy_type',
           title = btrim(p_policy->>'title'),
           version_label = nullif(btrim(coalesce(p_policy->>'version_label', '')), ''),
           effective_date = nullif(btrim(coalesce(p_policy->>'effective_date', '')), '')::date,
           exposure_surfaces = coalesce(p_policy->'exposure_surfaces', '[]'::jsonb),
           requires_consent = coalesce((p_policy->>'requires_consent')::boolean, false),
           tracking_status = nullif(btrim(coalesce(p_policy->>'tracking_status', '')), ''),
           status = v_status,
           related_admin_pages = coalesce(p_policy->'related_admin_pages', '[]'::jsonb),
           related_user_pages = coalesce(p_policy->'related_user_pages', '[]'::jsonb),
           source_documents = coalesce(p_policy->'source_documents', '[]'::jsonb),
           legal_references = coalesce(p_policy->'legal_references', '[]'::jsonb),
           summary = coalesce(p_policy->>'summary', ''),
           body_html = coalesce(p_policy->>'body_html', ''),
           admin_memo = nullif(btrim(coalesce(p_policy->>'admin_memo', '')), ''),
           updated_by = caller_id::text,
           updated_at = now()
     where id = v_id
     returning * into v_saved;
  end if;

  insert into public.operation_policy_histories (
    id, policy_id, action, version_label, changed_at, changed_by, snapshot
  ) values (
    public.next_operation_policy_history_id(),
    v_id,
    v_history_action,
    v_saved.version_label,
    v_saved.updated_at,
    caller_id::text,
    public.operation_policy_snapshot(v_saved)
  );

  update public.operation_policies
     set current_version_id = (
       select id from public.operation_policy_histories
       where policy_id = v_id
       order by changed_at desc, id desc
       limit 1
     )
   where id = v_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, v_action, 'OperationPolicy', v_id, v_diff,
    jsonb_build_object(
      'reason', p_reason,
      'mode', coalesce(p_policy->>'mode', case when v_old.id is null then 'create' else 'edit' end),
      'title', v_saved.title,
      'version_label', v_saved.version_label
    )
  );

  return v_id;
end;
$$;
revoke all on function public.admin_save_operation_policy(text, jsonb, text) from public;
grant execute on function public.admin_save_operation_policy(text, jsonb, text) to authenticated;

create or replace function public.admin_toggle_operation_policy_status(
  p_policy_id   text,
  p_next_status text,
  p_reason      text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.operation_policies%rowtype;
  v_saved public.operation_policies%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;
  if p_next_status not in ('published','hidden') then raise exception 'invalid policy status: %', p_next_status; end if;

  select * into v_old from public.operation_policies where id = p_policy_id for update;
  if not found then raise exception 'unknown policy id: %', p_policy_id; end if;

  update public.operation_policies
     set status = p_next_status, updated_by = caller_id::text, updated_at = now()
   where id = p_policy_id
   returning * into v_saved;

  insert into public.operation_policy_histories (id, policy_id, action, version_label, changed_at, changed_by, snapshot)
  values (public.next_operation_policy_history_id(), p_policy_id, 'status_changed', v_saved.version_label, v_saved.updated_at, caller_id::text, public.operation_policy_snapshot(v_saved));

  update public.operation_policies
     set current_version_id = (select id from public.operation_policy_histories where policy_id = p_policy_id order by changed_at desc, id desc limit 1)
   where id = p_policy_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'policy_status_changed', 'OperationPolicy', p_policy_id,
    jsonb_build_object('status', jsonb_build_object('from', v_old.status, 'to', p_next_status)),
    jsonb_build_object('reason', p_reason, 'title', v_saved.title)
  );
  return p_policy_id;
end;
$$;
revoke all on function public.admin_toggle_operation_policy_status(text, text, text) from public;
grant execute on function public.admin_toggle_operation_policy_status(text, text, text) to authenticated;

create or replace function public.admin_delete_operation_policy(
  p_policy_id text,
  p_reason    text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.operation_policies%rowtype;
  v_snapshot jsonb;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.operation_policies where id = p_policy_id for update;
  if not found then raise exception 'unknown policy id: %', p_policy_id; end if;
  v_snapshot := public.operation_policy_snapshot(v_old);

  insert into public.operation_policy_histories (id, policy_id, action, version_label, changed_at, changed_by, snapshot)
  values (public.next_operation_policy_history_id(), p_policy_id, 'deleted', v_old.version_label, now(), caller_id::text, v_snapshot);

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'policy_deleted', 'OperationPolicy', p_policy_id,
    jsonb_build_object('deleted', jsonb_build_object('from', false, 'to', true)),
    jsonb_build_object('reason', p_reason, 'title', v_old.title, 'snapshot', v_snapshot)
  );

  delete from public.operation_policies where id = p_policy_id;
  return p_policy_id;
end;
$$;
revoke all on function public.admin_delete_operation_policy(text, text) from public;
grant execute on function public.admin_delete_operation_policy(text, text) to authenticated;

create or replace function public.admin_publish_operation_policy_version(
  p_policy_id  text,
  p_history_id text,
  p_reason     text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_old public.operation_policies%rowtype;
  v_history public.operation_policy_histories%rowtype;
  v_snapshot jsonb;
  v_saved public.operation_policies%rowtype;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason required (operational reason)'; end if;

  select * into v_old from public.operation_policies where id = p_policy_id for update;
  if not found then raise exception 'unknown policy id: %', p_policy_id; end if;

  select * into v_history
    from public.operation_policy_histories
   where id = p_history_id and policy_id = p_policy_id;
  if not found then raise exception 'unknown policy history id: %', p_history_id; end if;
  v_snapshot := v_history.snapshot;

  update public.operation_policies
     set category = v_snapshot->>'category',
         policy_type = v_snapshot->>'policyType',
         title = v_snapshot->>'title',
         version_label = nullif(btrim(coalesce(v_snapshot->>'versionLabel', '')), ''),
         effective_date = nullif(btrim(coalesce(v_snapshot->>'effectiveDate', '')), '')::date,
         exposure_surfaces = coalesce(v_snapshot->'exposureSurfaces', '[]'::jsonb),
         requires_consent = coalesce((v_snapshot->>'requiresConsent')::boolean, false),
         tracking_status = nullif(btrim(coalesce(v_snapshot->>'trackingStatus', '')), ''),
         status = 'published',
         related_admin_pages = coalesce(v_snapshot->'relatedAdminPages', '[]'::jsonb),
         related_user_pages = coalesce(v_snapshot->'relatedUserPages', '[]'::jsonb),
         source_documents = coalesce(v_snapshot->'sourceDocuments', '[]'::jsonb),
         legal_references = coalesce(v_snapshot->'legalReferences', '[]'::jsonb),
         summary = coalesce(v_snapshot->>'summary', ''),
         body_html = coalesce(v_snapshot->>'bodyHtml', ''),
         admin_memo = nullif(btrim(coalesce(v_snapshot->>'adminMemo', '')), ''),
         current_version_id = p_history_id,
         updated_by = caller_id::text,
         updated_at = now()
   where id = p_policy_id
   returning * into v_saved;

  insert into public.operation_policy_histories (id, policy_id, action, version_label, changed_at, changed_by, snapshot)
  values (public.next_operation_policy_history_id(), p_policy_id, 'version_published', v_saved.version_label, v_saved.updated_at, caller_id::text, public.operation_policy_snapshot(v_saved));

  update public.operation_policies
     set current_version_id = (select id from public.operation_policy_histories where policy_id = p_policy_id order by changed_at desc, id desc limit 1)
   where id = p_policy_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'policy_version_published', 'OperationPolicy', p_policy_id,
    jsonb_build_object(
      'version_label', jsonb_build_object('from', v_old.version_label, 'to', v_saved.version_label),
      'status', jsonb_build_object('from', v_old.status, 'to', 'published')
    ),
    jsonb_build_object('reason', p_reason, 'from_history_id', p_history_id, 'from_version', v_old.version_label, 'to_version', v_saved.version_label)
  );
  return p_policy_id;
end;
$$;
revoke all on function public.admin_publish_operation_policy_version(text, text, text) from public;
grant execute on function public.admin_publish_operation_policy_version(text, text, text) to authenticated;
