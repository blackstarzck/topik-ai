-- down: 만료 기능 제거 — RPC 3종을 이전 버전으로 복원 후 컬럼/상태 원복.
-- RPC 복원은 선례대로 원본 파일 재실행으로 수행(순서 중요 — 컬럼 제거 전에 실행):
--   1) invite(3인자 원본):  node scripts/db/run-sql.mjs --file supabase/migrations-admin/20260707140000_institution_invitations.sql
--      (파일 전체 재실행 — 테이블/시드/타 RPC 는 idempotent)
--   2) respond/list(이메일 하드닝 버전): node scripts/db/run-sql.mjs --file supabase/migrations-admin/20260707150000_institution_invitation_email_hardening.sql
-- 4인자 invite 는 명시 drop(원본 재실행으로는 제거되지 않음):
drop function if exists public.admin_invite_institution_members(uuid[], text, text, integer);

-- expired 상태 행은 canceled 로 강등 후 CHECK 원복(위반 방지).
update public.institution_code_invitations set status = 'canceled' where status = 'expired';
alter table public.institution_code_invitations
  drop constraint if exists institution_code_invitations_status_check;
alter table public.institution_code_invitations
  add constraint institution_code_invitations_status_check
  check (status in ('pending', 'accepted', 'declined', 'canceled'));

drop index if exists institution_code_invitations_pending_expiry_idx;
alter table public.institution_code_invitations drop column if exists expires_at;

update public.notification_templates
   set body_html = '<p>{{display_name}}님, {{institution_label}} 기관 소속 초대가 도착했습니다. 수락하면 해당 기관 회원으로 등록됩니다.</p>',
       variables = '["display_name","institution_label"]'::jsonb
 where template_key = 'institution_invitation' and channel = 'in_app';
