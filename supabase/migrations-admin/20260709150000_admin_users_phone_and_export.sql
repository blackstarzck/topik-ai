-- =====================================================================
-- topik-ai admin · Users > 회원 전화번호/성별 노출 + 회원 정보 내보내기
--
-- 개인정보 정책(개인정보의 안전성 확보조치 기준·ISMS-P 2.6.3 정합):
--   * 목록 get_admin_users        → gender + phone_masked 반환(예: 010-****-5678).
--     대량 화면에는 원문을 상시 노출하지 않는다(출력 항목 최소화).
--   * 상세 get_admin_user         → 단건 업무 조회이므로 gender + 원문 phone + phone_masked 반환.
--     (기존 platform_admin 전용 게이트 유지 — 최소권한)
--   * 내보내기 admin_export_users → p_reason(사유) 필수. 전화번호는 기본 마스킹이며
--     p_include_full_phone=true 선택 시에만 원문 포함. 매 호출을 admin_audit_logs 에
--     기록(사유·행수·원문 포함 여부·필터) — "개인정보 다운로드 사유 확인" 의무 대응.
--
-- 소유 경계: profiles.phone / profiles.gender 컬럼 DDL 은 v13 소유
--   (v13 supabase/migrations/20260709140000_profiles_phone.sql). 이 파일은 profiles 를
--   read-only 로만 참조한다(profiles 쓰기 없음 — ALLOWED_PROFILE_WRITE_FILES 불필요).
--
-- 계약: get_admin_users / get_admin_user 는 RETURNS TABLE 확장이므로 drop 후 재생성
--   (20260623120000 선례). 인자 이름/순서 불변 → 프론트 rpc 호출 무변경.
--   get_admin_users order by 마지막에 user_id tiebreaker 를 추가해 페이지네이션을
--   안정화한다(내보내기 RPC 의 페이지 루프가 행 누락/중복 없이 전 회원을 순회).
--   4-인자 레거시 오버로드는 재생성하지 않는다(20260623120000 에서 이미 폐기; dev DB
--   드리프트 잔존분 정리).
-- down: supabase/migrations-admin/down/20260709150000_admin_users_phone_and_export.sql
-- =====================================================================

-- ── 마스킹 헬퍼 ────────────────────────────────────────────────────────────────
-- 숫자만 추출해 앞 3자리 + '-****-' + 뒤 4자리로 통일 표기(입력 포맷 무관).
-- 9자리 미만(비정상/짧은 값)은 부분 노출도 하지 않고 '***', 빈 값은 NULL.
create or replace function private.mask_phone(p_phone text)
returns text
language sql
immutable
as $$
  select case
    when nullif(btrim(coalesce(p_phone, '')), '') is null then null
    when length(regexp_replace(p_phone, '\D', '', 'g')) < 9 then '***'
    else substr(regexp_replace(p_phone, '\D', '', 'g'), 1, 3)
         || '-****-'
         || right(regexp_replace(p_phone, '\D', '', 'g'), 4)
  end;
$$;

revoke all on function private.mask_phone(text) from public;

comment on function private.mask_phone(text) is
  '전화번호 표시제한(마스킹) 통일 규칙: 숫자 9자리 이상 → 앞3-****-뒤4, 미만 → ***, 빈 값 → NULL. 목록/내보내기(기본)에서 사용. 2026-07-09.';

-- ── 목록: get_admin_users 재생성(+ phone_masked, + user_id tiebreaker) ─────────
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
  gender                   text,
  app_role                 text,
  plan_label               text,
  status                   text,
  registration_status      text,
  nationality_country_code text,
  social_providers         text[],
  affiliation_code         text,
  affiliation_label        text,
  phone_masked             text,
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
      nullif(btrim(to_jsonb(p)->>'gender'), '') as gender,
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
      private.mask_phone(p.phone)             as phone_masked,
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
    counted.gender,
    counted.app_role,
    counted.plan_label,
    counted.status,
    counted.registration_status,
    counted.nationality_country_code,
    counted.social_providers,
    counted.affiliation_code,
    counted.affiliation_label,
    counted.phone_masked,
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
    counted.created_at desc,
    counted.user_id asc
  offset (v_page - 1) * v_size
  limit v_size;
end;
$$;

revoke all     on function public.get_admin_users(text, text, integer, integer, text) from public;
grant  execute on function public.get_admin_users(text, text, integer, integer, text) to authenticated;

comment on function public.get_admin_users(text, text, integer, integer, text) is
  'Users > 회원 목록 read. platform_admin 전용. 성별(gender)과 전화번호 phone_masked(마스킹) 반환 — 전화번호 원문은 상세(get_admin_user)/내보내기(admin_export_users, 사유+감사)로 한정. order by 에 user_id tiebreaker 포함(안정 페이지네이션). 2026-07-09 gender/phone_masked 추가.';

-- ── 상세: get_admin_user 재생성(+ phone 원문, phone_masked) ────────────────────
drop function if exists public.get_admin_user(uuid);

create function public.get_admin_user(target_user_id uuid)
returns table (
  user_id                  uuid,
  email                    text,
  display_name             text,
  nickname                 text,
  gender                   text,
  app_role                 text,
  plan_label               text,
  status                   text,
  registration_status      text,
  nationality_country_code text,
  social_providers         text[],
  affiliation_code         text,
  affiliation_label        text,
  phone                    text,
  phone_masked             text,
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
    nullif(btrim(to_jsonb(p)->>'gender'), '') as gender,
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
    p.phone                                 as phone,
    private.mask_phone(p.phone)             as phone_masked,
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

revoke all     on function public.get_admin_user(uuid) from public;
grant  execute on function public.get_admin_user(uuid) to authenticated;

comment on function public.get_admin_user(uuid) is
  'Users > 회원 상세 단건 read. platform_admin 전용. 성별(gender)과 phone 원문 + phone_masked 를 함께 반환(목록은 마스킹만). 2026-07-09 gender/phone 추가.';

-- ── 내보내기: admin_export_users ───────────────────────────────────────────────
-- 회원 목록(엑셀) 반출용 read. get_admin_users 를 페이지 루프로 재사용해 목록과
-- 행 의미를 1:1 로 유지하며 전 회원을 반환한다(내부 500행 캡 우회).
-- 사유 필수, 원문 전화번호는 p_include_full_phone=true 일 때만. 매 호출을
-- admin_audit_logs(action=users_exported) 에 기록한다 — 파일생성(다운로드) 이력.
drop function if exists public.admin_export_users(text, boolean, text);
drop function if exists public.admin_export_users(
  text, boolean, text, text, uuid[], text, text, date, date,
  text[], text[], text[], text[], text[], text[], text[]
);

create function public.admin_export_users(
  p_reason                            text,
  p_include_full_phone                boolean default false,
  p_affiliation                       text    default null,
  p_scope                             text    default 'filters',
  p_selected_user_ids                 uuid[]  default null,
  p_search                            text    default null,
  p_search_field                      text    default 'all',
  p_start_date                        date    default null,
  p_end_date                          date    default null,
  p_gender_filters                    text[]  default null,
  p_tier_filters                      text[]  default null,
  p_subscription_status_filters       text[]  default null,
  p_membership_status_filters         text[]  default null,
  p_terms_consent_status_filters      text[]  default null,
  p_email_verification_status_filters text[]  default null,
  p_selected_column_keys              text[]  default null
)
returns table (
  user_id                  uuid,
  email                    text,
  display_name             text,
  nickname                 text,
  gender                   text,
  app_role                 text,
  plan_label               text,
  status                   text,
  registration_status      text,
  nationality_country_code text,
  social_providers         text[],
  affiliation_code         text,
  affiliation_label        text,
  phone_masked             text,
  phone                    text,
  submission_count         bigint,
  last_activity            timestamptz,
  last_sign_in_at          timestamptz,
  email_confirmed          boolean,
  created_at               timestamptz,
  consent_status           text,
  consent_accepted_at      timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
#variable_conflict use_column
declare
  caller_id   uuid := auth.uid();
  v_reason    text := nullif(btrim(coalesce(p_reason, '')), '');
  v_full      boolean := coalesce(p_include_full_phone, false);
  v_aff       text := nullif(btrim(coalesce(p_affiliation, '')), '');
  v_scope     text := lower(coalesce(nullif(btrim(p_scope), ''), 'filters'));
  v_ids       uuid[] := coalesce(p_selected_user_ids, '{}'::uuid[]);
  v_search    text := nullif(btrim(coalesce(p_search, '')), '');
  v_search_field text := lower(coalesce(nullif(btrim(p_search_field), ''), 'all'));
  v_gender_filters text[] := coalesce(p_gender_filters, '{}'::text[]);
  v_tier_filters text[] := coalesce(p_tier_filters, '{}'::text[]);
  v_subscription_status_filters text[] := coalesce(p_subscription_status_filters, '{}'::text[]);
  v_membership_status_filters text[] := coalesce(p_membership_status_filters, '{}'::text[]);
  v_terms_consent_status_filters text[] := coalesce(p_terms_consent_status_filters, '{}'::text[]);
  v_email_verification_status_filters text[] := coalesce(p_email_verification_status_filters, '{}'::text[]);
  v_selected_column_keys text[] := coalesce(p_selected_column_keys, '{}'::text[]);
  v_batch_id  uuid := gen_random_uuid();
  v_page      integer := 1;
  v_size      constant integer := 500;
  v_fetched   integer;
  v_returned  integer;
  v_total     bigint := 0;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if v_reason is null then raise exception 'reason required'; end if;
  if v_scope not in ('filters', 'selected') then
    raise exception 'invalid export scope: %', v_scope;
  end if;
  if v_search_field not in ('all', 'id', 'realname', 'email', 'nickname') then
    v_search_field := 'all';
  end if;

  loop
    select count(*) into v_fetched
    from public.get_admin_users(null, 'name', v_page, v_size, v_aff);

    return query
      with page_rows as (
        select g.*, pr.phone as raw_phone
        from public.get_admin_users(null, 'name', v_page, v_size, v_aff) g
        left join public.profiles pr on pr.id = g.user_id
      ),
      normalized as (
        select
          page_rows.*,
          case
            when nullif(btrim(coalesce(page_rows.gender, '')), '') is null then '미입력'
            when lower(btrim(page_rows.gender)) in ('male', 'm', '남', '남성') then '남성'
            when lower(btrim(page_rows.gender)) in ('female', 'f', '여', '여성') then '여성'
            else '기타'
          end as export_gender_label,
          case
            when nullif(btrim(coalesce(page_rows.plan_label, '')), '') is null then '일반'
            when lower(btrim(page_rows.plan_label)) in ('free', 'basic') then '일반'
            when btrim(page_rows.plan_label) = '일반' then '일반'
            else '프리미엄'
          end as export_tier_label,
          case
            when nullif(btrim(coalesce(page_rows.plan_label, '')), '') is null then '미구독'
            when lower(btrim(page_rows.plan_label)) in ('free', 'basic') then '미구독'
            when btrim(page_rows.plan_label) = '일반' then '미구독'
            else '구독'
          end as export_subscription_status,
          case page_rows.registration_status
            when 'pending_email_verification' then '인증 대기'
            when 'pending_required_consent' then '약관 대기'
            when 'blocked' then '정지'
            when 'deleted' then '탈퇴'
            else '정상'
          end as export_membership_status,
          case
            when page_rows.email_confirmed is false then '동의 불가'
            when page_rows.consent_status = 'consented' then '동의 완료'
            when page_rows.consent_status = 'partial' then '일부 동의'
            else '미동의'
          end as export_terms_consent_status,
          case when page_rows.email_confirmed is false then '미인증' else '인증 완료' end
            as export_email_verification_status
        from page_rows
      )
      select
        n.user_id,
        n.email,
        n.display_name,
        n.nickname,
        n.gender,
        n.app_role,
        n.plan_label,
        n.status,
        n.registration_status,
        n.nationality_country_code,
        n.social_providers,
        n.affiliation_code,
        n.affiliation_label,
        n.phone_masked,
        case when v_full then n.raw_phone else null::text end as phone,
        n.submission_count,
        n.last_activity,
        n.last_sign_in_at,
        n.email_confirmed,
        n.created_at,
        n.consent_status,
        n.consent_accepted_at
      from normalized n
      where (
        v_scope = 'selected'
        and cardinality(v_ids) > 0
        and n.user_id = any(v_ids)
      ) or (
        v_scope = 'filters'
        and (
          v_search is null
          or case v_search_field
            when 'id' then n.user_id::text ilike '%' || v_search || '%'
            when 'realname' then coalesce(n.display_name, '') ilike '%' || v_search || '%'
            when 'email' then coalesce(n.email, '') ilike '%' || v_search || '%'
            when 'nickname' then coalesce(n.nickname, '') ilike '%' || v_search || '%'
            else (
              n.user_id::text ilike '%' || v_search || '%'
              or coalesce(n.display_name, '') ilike '%' || v_search || '%'
              or coalesce(n.email, '') ilike '%' || v_search || '%'
              or coalesce(n.nickname, '') ilike '%' || v_search || '%'
            )
          end
        )
        and (p_start_date is null or (n.created_at at time zone 'Asia/Seoul')::date >= p_start_date)
        and (p_end_date is null or (n.created_at at time zone 'Asia/Seoul')::date <= p_end_date)
        and (cardinality(v_gender_filters) = 0 or n.export_gender_label = any(v_gender_filters))
        and (cardinality(v_tier_filters) = 0 or n.export_tier_label = any(v_tier_filters))
        and (
          cardinality(v_subscription_status_filters) = 0
          or n.export_subscription_status = any(v_subscription_status_filters)
        )
        and (
          cardinality(v_membership_status_filters) = 0
          or n.export_membership_status = any(v_membership_status_filters)
        )
        and (
          cardinality(v_terms_consent_status_filters) = 0
          or n.export_terms_consent_status = any(v_terms_consent_status_filters)
        )
        and (
          cardinality(v_email_verification_status_filters) = 0
          or n.export_email_verification_status = any(v_email_verification_status_filters)
        )
      );

    get diagnostics v_returned = row_count;
    v_total := v_total + v_returned;
    exit when v_fetched < v_size;

    v_page := v_page + 1;
    if v_page > 200 then
      -- 100k행 초과는 계약 밖(무한 루프 방지 안전핀).
      raise exception 'export overflow: more than % rows', 200 * v_size;
    end if;
  end loop;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id,
    'users_exported',
    'User',
    'batch:' || v_batch_id::text,
    null,
    jsonb_build_object(
      'reason', v_reason,
      'row_count', v_total,
      'scope', v_scope,
      'include_full_phone', v_full,
      'selected_column_keys', v_selected_column_keys,
      'selected_user_count', cardinality(v_ids),
      'filter_applied',
        v_search is not null
        or p_start_date is not null
        or p_end_date is not null
        or v_aff is not null
        or cardinality(v_gender_filters) > 0
        or cardinality(v_tier_filters) > 0
        or cardinality(v_subscription_status_filters) > 0
        or cardinality(v_membership_status_filters) > 0
        or cardinality(v_terms_consent_status_filters) > 0
        or cardinality(v_email_verification_status_filters) > 0,
      'filter_summary', jsonb_build_object(
        'search_applied', v_search is not null,
        'search_field', v_search_field,
        'date_start', p_start_date,
        'date_end', p_end_date,
        'affiliation', coalesce(v_aff, '@all'),
        'gender_filter_count', cardinality(v_gender_filters),
        'tier_filter_count', cardinality(v_tier_filters),
        'subscription_status_filter_count', cardinality(v_subscription_status_filters),
        'membership_status_filter_count', cardinality(v_membership_status_filters),
        'terms_consent_status_filter_count', cardinality(v_terms_consent_status_filters),
        'email_verification_status_filter_count', cardinality(v_email_verification_status_filters)
      ),
      'format', 'xlsx'
    )
  );
end;
$$;

revoke all     on function public.admin_export_users(
  text, boolean, text, text, uuid[], text, text, date, date,
  text[], text[], text[], text[], text[], text[], text[]
) from public;
grant  execute on function public.admin_export_users(
  text, boolean, text, text, uuid[], text, text, date, date,
  text[], text[], text[], text[], text[], text[], text[]
) to authenticated;

comment on function public.admin_export_users(
  text, boolean, text, text, uuid[], text, text, date, date,
  text[], text[], text[], text[], text[], text[], text[]
) is
  'Users > 회원 정보 내보내기(엑셀) read. platform_admin 전용, reason 필수. 현재 목록 조건/선택 행 scope, 검색·가입일·기관·성별·상태류 필터, 선택 컬럼 키를 받는다. 전화번호 기본 마스킹, p_include_full_phone=true 시 원문. 감사 로그에는 원문 검색어/전화번호/성별 값 없이 안전 요약만 기록. 2026-07-09.';
