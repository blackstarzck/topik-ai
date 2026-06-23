-- =====================================================================
-- topik-ai admin - 회원 상세: 동의한 약관 버전 조회(read-only)
-- admin_get_user_legal_consents(p_user_id): 회원이 동의한 약관(이용약관/개인정보)
-- 의 최신 버전 + 동의 시각 + 현재 게시 버전과의 일치 여부(is_current)를 반환.
-- v13 소유 테이블(user_consents, legal_documents)을 READ-ONLY 로 참조(get_admin_users
-- 선례와 동일). 쓰기/감사 없음. is_admin 가드.
-- down: supabase/migrations-admin/down/20260622160000_user_legal_consents_read.sql
-- =====================================================================

create or replace function public.admin_get_user_legal_consents(p_user_id uuid)
returns table (
  doc_type    text,
  version     text,
  title       text,
  source      text,
  accepted_at text,
  is_current  boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;
  if not private.is_admin(auth.uid()) then
    raise exception 'forbidden: admin required';
  end if;

  return query
  with latest_consent as (
    -- 회원이 동의한 doc_type 별 가장 최근 동의 1건
    select distinct on (uc.doc_type)
      uc.doc_type, uc.version, uc.document_id, uc.source, uc.accepted_at
    from public.user_consents uc
    where uc.user_id = p_user_id
    order by uc.doc_type, uc.accepted_at desc
  ),
  current_version as (
    -- doc_type 별 현재 게시(published) 중인 최신 버전
    select distinct on (ld.doc_type)
      ld.doc_type, ld.version
    from public.legal_documents ld
    where ld.status = 'published'
    order by ld.doc_type, ld.effective_at desc nulls last, ld.created_at desc
  )
  select
    lc.doc_type,
    lc.version,
    coalesce(doc.title, lc.doc_type) as title,
    lc.source,
    to_char(lc.accepted_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as accepted_at,
    (cv.version is not null and cv.version = lc.version) as is_current
  from latest_consent lc
  left join public.legal_documents doc on doc.id = lc.document_id
  left join current_version cv on cv.doc_type = lc.doc_type
  order by lc.doc_type;
end;
$$;

revoke all on function public.admin_get_user_legal_consents(uuid) from public;
grant execute on function public.admin_get_user_legal_consents(uuid) to authenticated;
