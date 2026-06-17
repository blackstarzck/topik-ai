-- =====================================================================
-- topik-ai admin · Users directory · admin-0021
-- 회원 목록·상세에 "약관 동의(인증약관) 상태" 노출 — get_admin_users 확장.
--   회원가입(일반·SNS) 시 필수 동의하는 약관/정책 동의 여부를 집계해 반환한다.
--
-- 데이터 원천(v13 소유, 읽기 전용):
--   public.legal_documents  — doc_type/version/status/requires_consent (필수 동의 문서 사전)
--   public.user_consents    — user_id/doc_type/version/accepted_at (사용자별 동의 기록)
--   현재 필수 동의 문서: terms(이용약관) + privacy(개인정보처리방침), 둘 다 requires_consent.
--
-- 계약: get_admin_users 의 RETURNS TABLE 에 consent_status / consent_accepted_at 추가.
--   RETURNS TABLE 변경은 create or replace 불가 → drop 후 재생성.
--   인자명(search/sort/page/page_size)은 PostgREST 이름매칭 위해 그대로 유지.
-- consent_status 코드: consented(전부 동의) / partial(일부) / none(없음).
--   매칭은 "현재 게시 중인 requires_consent 문서의 현재 버전" 기준 — 구버전만 동의한
--   사용자는 미동의로 간주(재동의 필요). 필수 문서가 0건이면 trivially consented.
-- down: supabase/migrations-admin/down/20260617220000_admin_users_consent.sql
-- =====================================================================

drop function if exists public.get_admin_users(text, text, integer, integer);

create function public.get_admin_users(
  search    text    default null,
  sort      text    default 'activity',
  page      integer default 1,
  page_size integer default 100
)
returns table (
  user_id            uuid,
  email              text,
  display_name       text,
  nickname           text,
  app_role           text,
  plan_label         text,
  status             text,
  submission_count   bigint,
  last_activity      timestamptz,
  last_sign_in_at    timestamptz,
  created_at         timestamptz,
  consent_status     text,
  consent_accepted_at timestamptz,
  total_count        bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  caller_id uuid := auth.uid();
  v_search  text := nullif(btrim(coalesce(search, '')), '');
  v_sort    text := lower(coalesce(nullif(btrim(sort), ''), 'activity'));
  v_page    integer := greatest(coalesce(page, 1), 1);
  v_size    integer := least(greatest(coalesce(page_size, 100), 1), 500);
  v_required_count integer;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;

  -- 현재 필수 동의 문서(doc_type별 최신 버전) 개수.
  select count(*) into v_required_count
  from (
    select distinct on (ld.doc_type) ld.doc_type
    from public.legal_documents ld
    where ld.requires_consent = true and ld.status = 'published'
    order by ld.doc_type, ld.effective_at desc nulls last, ld.version desc
  ) req;

  return query
  with required_docs as (
    select distinct on (ld.doc_type) ld.doc_type, ld.version
    from public.legal_documents ld
    where ld.requires_consent = true and ld.status = 'published'
    order by ld.doc_type, ld.effective_at desc nulls last, ld.version desc
  ),
  user_consent as (
    select uc.user_id,
           count(distinct rd.doc_type) as matched,
           max(uc.accepted_at)         as consent_accepted_at
    from public.user_consents uc
    join required_docs rd
      on rd.doc_type = uc.doc_type and rd.version = uc.version
    group by uc.user_id
  ),
  subs as (
    select ws.user_id,
           count(*)             as submission_count,
           max(ws.submitted_at) as last_activity
    from public.writing_submissions ws
    group by ws.user_id
  ),
  base as (
    select
      p.id                                    as user_id,
      u.email::text                           as email,
      p.display_name                          as display_name,
      p.nickname::text                        as nickname,
      p.app_role                              as app_role,
      p.plan_label                            as plan_label,
      p.status                                as status,
      coalesce(s.submission_count, 0)::bigint as submission_count,
      s.last_activity                         as last_activity,
      u.last_sign_in_at                       as last_sign_in_at,
      p.created_at                            as created_at,
      case
        when v_required_count = 0 then 'consented'
        when coalesce(c.matched, 0) = 0 then 'none'
        when c.matched >= v_required_count then 'consented'
        else 'partial'
      end                                     as consent_status,
      c.consent_accepted_at                   as consent_accepted_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    left join subs s on s.user_id = p.id
    left join user_consent c on c.user_id = p.id
    where v_search is null
       or p.display_name ilike '%' || v_search || '%'
       or p.nickname::text ilike '%' || v_search || '%'
       or u.email ilike '%' || v_search || '%'
  ),
  counted as (
    select base.*, count(*) over () as total_count
    from base
  )
  select
    counted.user_id,
    counted.email,
    counted.display_name,
    counted.nickname,
    counted.app_role,
    counted.plan_label,
    counted.status,
    counted.submission_count,
    counted.last_activity,
    counted.last_sign_in_at,
    counted.created_at,
    counted.consent_status,
    counted.consent_accepted_at,
    counted.total_count
  from counted
  order by
    case when v_sort = 'name' then lower(coalesce(counted.display_name, counted.email)) end asc nulls last,
    counted.last_sign_in_at desc nulls last,
    counted.created_at desc
  offset (v_page - 1) * v_size
  limit v_size;
end;
$$;

revoke all on function public.get_admin_users(text, text, integer, integer) from public;
grant execute on function public.get_admin_users(text, text, integer, integer) to authenticated;

comment on function public.get_admin_users(text, text, integer, integer) is
  'Users > 회원 목록 read. platform_admin 전용, profiles+auth.users 조인, writing_submissions 집계, legal_documents/user_consents 기반 약관 동의 상태(consent_status/consent_accepted_at) 포함. 인자명 search/sort/page/page_size 고정(PostgREST 매칭).';
