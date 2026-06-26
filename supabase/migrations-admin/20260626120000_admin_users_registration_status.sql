-- =====================================================================
-- topik-ai admin - Users registration lifecycle read contract.
--
-- Purpose:
--   Keep public.profiles.status as the v13-owned operational status
--   (active/blocked/deleted), but expose a separate registration_status from
--   the Admin-owned get_admin_users RPC.
--
-- Contract:
--   - email_confirmed = false -> registration_status='pending_email_verification'
--   - email_confirmed = false -> consent_status='none', consent_accepted_at=NULL
--   - email_confirmed = true and required consent missing -> 'pending_required_consent'
--   - active + email confirmed + required consent complete -> 'active'
--   - blocked/deleted keep operational precedence.
--
-- Ownership boundary:
--   Reads v13-owned auth.users, profiles, legal_documents, user_consents.
--   Does not alter v13 table DDL and does not delete immutable consent logs.
-- down: supabase/migrations-admin/down/20260626120000_admin_users_registration_status.sql
-- =====================================================================

drop function if exists public.get_admin_users(text, text, integer, integer);
drop function if exists public.get_admin_users(text, text, integer, integer, text);

create function public.get_admin_users(
  search      text    default null,
  sort        text    default 'activity',
  page        integer default 1,
  page_size   integer default 100,
  affiliation text    default null
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
  v_aff     text := nullif(btrim(coalesce(affiliation, '')), '');
  v_page    integer := greatest(coalesce(page, 1), 1);
  v_size    integer := least(greatest(coalesce(page_size, 100), 1), 500);
  v_required_count integer;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;

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
    where (
            v_search is null
         or p.display_name ilike '%' || v_search || '%'
         or p.nickname::text ilike '%' || v_search || '%'
         or u.email ilike '%' || v_search || '%'
          )
      and (
            v_aff is null
         or (v_aff = '@affiliated' and p.affiliation_code is not null and p.affiliation_code <> '')
         or (v_aff = '@general'    and (p.affiliation_code is null or p.affiliation_code = ''))
         or (v_aff not in ('@affiliated', '@general') and p.affiliation_code = v_aff)
          )
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
    counted.registration_status,
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

revoke all on function public.get_admin_users(text, text, integer, integer, text) from public;
grant execute on function public.get_admin_users(text, text, integer, integer, text) to authenticated;

comment on function public.get_admin_users(text, text, integer, integer, text) is
  'Users > 회원 목록 read. platform_admin 전용. profiles.status 원천 운영 상태와 별도로 registration_status를 반환한다. 이메일 미인증은 pending_email_verification이며 consent_status는 none/null로 정규화한다.';
