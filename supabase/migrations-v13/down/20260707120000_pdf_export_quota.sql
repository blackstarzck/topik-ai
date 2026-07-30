-- down: revert PDF export quota ledger.
-- claim/commit/release RPC 제거 + 쿼터 4개 테이블 제거.
-- usages/resets 데이터는 함께 삭제되므로 운영 환경에서는 실행 전 백업 필요.

drop function if exists public.claim_pdf_export_quota(uuid, uuid[]);
drop function if exists public.commit_pdf_export_quota(uuid, uuid[], uuid);
drop function if exists public.release_pdf_export_quota(uuid, uuid[], text);

drop table if exists public.pdf_export_quota_reset_targets;
drop table if exists public.pdf_export_quota_resets;
drop table if exists public.pdf_export_quota_usages;
drop table if exists public.pdf_export_quota_policies;
