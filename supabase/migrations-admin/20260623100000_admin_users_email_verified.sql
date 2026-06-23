-- =====================================================================
-- topik-ai admin · Users directory · admin-0025
-- 회원 목록에 "이메일 인증"(email_confirmed) 노출 — get_admin_users 확장.
--   가입 미완료(이메일 미인증·중도이탈) 계정을 정상 회원과 구분하기 위함.
--
-- 신호: auth.users.email_confirmed_at IS NULL = 미인증.
--   - 소셜(google 등) 가입은 Supabase가 자동 인증 → 항상 인증 완료.
--   - 이메일+비밀번호 가입은 확인메일을 눌러야 인증됨. 누르지 않고 이탈한
--     계정은 profiles 행만 존재(확인메일 발송됨, last_sign_in_at NULL)하여
--     회원 목록에 빈 이름/닉네임으로 노출된다 → 본 플래그로 식별/필터.
--   (이름/닉네임이 비는 별개 원인 = v13 가입경로별 display_name/nickname 채움 차이.
--    본 마이그레이션은 "구분 표시"만 제공하며 v13 데이터 자체는 변경하지 않는다.)
--
-- 계약: RETURNS TABLE 에 email_confirmed boolean 추가 → drop 후 재생성.
--   인자명(search/sort/page/page_size) 유지(PostgREST 매칭).
-- 소유권: v13 소유 auth.users 는 읽기만(email_confirmed_at). write 없음.
-- down: supabase/migrations-admin/down/20260623100000_admin_users_email_verified.sql
-- =====================================================================

drop function if exists public.get_admin_users(text, text, integer, integer);

create function public.get_admin_users(
  search    text    default null,
  sort      text    default 'activity',
  page      integer default 1,
  page_size integer default 100
)
returns table (
  user_id                  uuid,
  email                    text,
  display_name             text,
  nickname                 text,
  app_role                 text,
  plan_label               text,
  status                   text,
  nationality_country_code text,
  social_providers         text[],
  affiliation_code         text,
  affiliation_label        text,
  submission_count         bigint,
  last_activity            timestamptz,
  last_sign_in_at          timestamptz,
  email_confirmed          boolean,
  created_at               timestamptz,
  consent_status           text,
  consent_accepted_at      timestamptz,
  total_count              bigint
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
  -- 소셜 로그인 provider 집계('email' 제외 = 소셜만). provider 알파벳 순으로 정렬.
  idents as (
    select i.user_id,
           array_agg(distinct i.provider order by i.provider) as social_providers
    from auth.identities i
    where i.provider <> 'email'
    group by i.user_id
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
      p.nationality_country_code              as nationality_country_code,
      coalesce(idn.social_providers, '{}'::text[]) as social_providers,
      p.affiliation_code                      as affiliation_code,
      ic.label                                as affiliation_label,
      coalesce(s.submission_count, 0)::bigint as submission_count,
      s.last_activity                         as last_activity,
      u.last_sign_in_at                       as last_sign_in_at,
      (u.email_confirmed_at is not null)      as email_confirmed,
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
    left join idents idn on idn.user_id = p.id
    left join public.institution_codes ic on ic.code = p.affiliation_code
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
    counted.nationality_country_code,
    counted.social_providers,
    counted.affiliation_code,
    counted.affiliation_label,
    counted.submission_count,
    counted.last_activity,
    counted.last_sign_in_at,
    counted.email_confirmed,
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
  'Users > 회원 목록 read. platform_admin 전용. profiles+auth.users+social_providers+약관동의+기관유입에 더해 이메일 인증 여부(auth.users.email_confirmed_at IS NOT NULL = email_confirmed)를 포함해 가입 미완료(미인증) 계정을 구분한다. 인자명 search/sort/page/page_size 고정(PostgREST 매칭).';
