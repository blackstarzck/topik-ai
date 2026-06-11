-- =====================================================================
-- topik-ai admin · 메타데이터·태그 스키마 전환 P5-3 · 0014
-- admin_update_tag_master_status: tag_master 활성/비활성 토글 RPC (실행계획안 §9)
--
-- 계약: SECURITY DEFINER + private.is_platform_admin 가드(문항 RPC의
--       content_admin보다 상위 — 마스터 사전 변경은 전 문항의 부여 옵션에
--       영향) + 사유 필수(p_note — RPC 단 강제) + admin_audit_logs(
--       action='tag_master_status_changed', target_table='AssessmentTagMaster',
--       target_id=tag_code, diff={is_active:{from,to}},
--       payload={note, active_assignment_count}).
-- 데이터 영향: 토글만 — 기존 부여 행(question_tags)은 이력 그대로 유지되며,
--       비활성화는 신규 부여 옵션 노출만 중단한다(활성 사전 로더의 is_active 필터).
-- down: supabase/migrations/down/20260611210100_topik_writing_tag_master_admin_rpc.sql
-- =====================================================================

create or replace function public.admin_update_tag_master_status(
  p_tag_code    text,
  p_next_active boolean,
  p_note        text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  caller_id uuid := auth.uid();
  v_row     public.topik_writing_tag_master%rowtype;
  v_active_assignments bigint;
begin
  if caller_id is null then raise exception 'unauthenticated'; end if;
  if not private.is_platform_admin(caller_id) then
    raise exception 'forbidden: platform_admin required';
  end if;
  if p_next_active is null then raise exception 'next_active required'; end if;
  if nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'note required (operational reason)';
  end if;

  select * into v_row from public.topik_writing_tag_master where tag_code = p_tag_code;
  if not found then raise exception 'unknown tag_code: %', p_tag_code; end if;
  if v_row.is_active = p_next_active then
    raise exception 'tag_master already %: %',
      case when p_next_active then 'active' else 'inactive' end, p_tag_code;
  end if;

  -- 참고 기록: 토글 시점의 활성 부여 수(부여 이력은 유지 — 옵션 노출만 변경).
  select count(*) into v_active_assignments
    from public.topik_writing_question_tags
   where tag_code = p_tag_code and is_active;

  update public.topik_writing_tag_master
     set is_active = p_next_active,
         updated_at = now()
   where tag_code = p_tag_code;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, diff, payload)
  values (
    caller_id, 'tag_master_status_changed', 'AssessmentTagMaster', p_tag_code,
    jsonb_build_object('is_active', jsonb_build_object('from', v_row.is_active, 'to', p_next_active)),
    jsonb_build_object('note', p_note, 'active_assignment_count', v_active_assignments)
  );
end;
$$;
revoke all on function public.admin_update_tag_master_status(text, boolean, text) from public;
grant execute on function public.admin_update_tag_master_status(text, boolean, text) to authenticated;
comment on function public.admin_update_tag_master_status(text, boolean, text) is
  'platform_admin 전용(P5-3). tag_master 활성/비활성 토글 + admin_audit_logs 기록(tag_master_status_changed, target=AssessmentTagMaster). 사유 p_note 필수.';
