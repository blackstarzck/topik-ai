-- =====================================================================
-- topik-ai admin · Users · 회원 상세 단건 read RPC (get_admin_user)
--
-- Problem:
--   회원 상세 페이지는 지금까지 별도 단건 조회가 없어, 프론트가
--   get_admin_users(page:1, page_size:100, 무필터)로 "상위 100명"을 다시 받아
--   클라이언트에서 id로 find 했다. 그 결과:
--     - 전체 회원 100명 초과 시, 창(window) 밖 회원은 상세가 열리지 않음
--       ("회원 정보를 찾을 수 없습니다"),
--     - last_sign_in_at NULL/동점 회원은 정렬이 불안정해 경계(≈100번째)에
--       걸린 회원이 산발적으로 누락,
--     - 목록에 "기관 소속" 필터가 걸리면 목록/상세 모집단이 달라져 누락.
--
-- Fix:
--   id 하나만 직접 조회하는 get_admin_user(target_user_id) 를 추가한다.
--   반환 컬럼/파생 규칙(registration_status·consent_status·social_providers·
--   affiliation 등)은 get_admin_users 와 1:1 동일 → 프론트의 AdminUserRow /
--   mapRowToUserSummary 를 그대로 재사용한다(목록/상세 표시 일관성 유지).
--   목록 RPC(get_admin_users)는 건드리지 않는다(회귀 0).
--
-- Ownership boundary:
--   v13 소유 auth.users / profiles / legal_documents / user_consents /
--   auth.identities / institution_codes / writing_submissions 를 "읽기"만 한다
--   (DDL 변경·write 없음). 유일 write 경로는 여전히 admin_set_user_status.
-- 권한 모델: platform_admin 전용(private.is_platform_admin).
-- down: supabase/migrations-admin/down/20260707120000_admin_user_detail_read.sql
-- =====================================================================

drop function if exists public.get_admin_user(uuid);

create function public.get_admin_user(
  target_user_id uuid
)
returns table (
  user_id                  uuid,
  email                    text,
  display_name             text,
  nickname                 text,
  app_role                 text,
  plan_label               text,
  status                   text,
  registration_status      text,
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
  consent_accepted_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  caller_id uuid := auth.uid();
  v_required_count integer;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if target_user_id is null then raise exception 'target_user_id required'; end if;

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
    where uc.user_id = target_user_id
    group by uc.user_id
  ),
  idents as (
    select i.user_id,
           array_agg(distinct i.provider order by i.provider) as social_providers
    from auth.identities i
    where i.provider <> 'email' and i.user_id = target_user_id
    group by i.user_id
  ),
  subs as (
    select ws.user_id,
           count(*)             as submission_count,
           max(ws.submitted_at) as last_activity
    from public.writing_submissions ws
    where ws.user_id = target_user_id
    group by ws.user_id
  )
  select
    p.id                                    as user_id,
    u.email::text                           as email,
    p.display_name                          as display_name,
    p.nickname::text                        as nickname,
    p.app_role                              as app_role,
    p.plan_label                            as plan_label,
    p.status                                as status,
    case
      when p.status = 'blocked' then 'blocked'
      when p.status = 'deleted' then 'deleted'
      when u.email_confirmed_at is null then 'pending_email_verification'
      when v_required_count > 0 and coalesce(c.matched, 0) < v_required_count
        then 'pending_required_consent'
      else 'active'
    end                                     as registration_status,
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
      when u.email_confirmed_at is null then 'none'
      when v_required_count = 0 then 'consented'
      when coalesce(c.matched, 0) = 0 then 'none'
      when c.matched >= v_required_count then 'consented'
      else 'partial'
    end                                     as consent_status,
    case
      when u.email_confirmed_at is null then null::timestamptz
      else c.consent_accepted_at
    end                                     as consent_accepted_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join subs s on s.user_id = p.id
  left join user_consent c on c.user_id = p.id
  left join idents idn on idn.user_id = p.id
  left join public.institution_codes ic on ic.code = p.affiliation_code
  where p.id = target_user_id;
end;
$$;

revoke all on function public.get_admin_user(uuid) from public;
grant execute on function public.get_admin_user(uuid) to authenticated;

comment on function public.get_admin_user(uuid) is
  'Users > 회원 상세 단건 read. platform_admin 전용. get_admin_users 와 동일한 컬럼/파생 규칙을 id 1건에 적용한다(상위 100명 창 제약 없이 전 회원 조회). profiles.status 는 읽기만 한다.';
