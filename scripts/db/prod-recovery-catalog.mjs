import { AUTH_USER_COPY_COLUMN_ALLOWLIST } from './prod-data-recovery-core.mjs';

// 복구 대상 카탈로그 — 분해로 recover-prod-from-dev.mjs 에서 이동(동작 동일).
// dev/운영 project ref, 스토리지 버킷, 복사 대상 테이블과 그 테이블별 특수 규칙
// (auth 특수 처리·충돌 시 보존 컬럼·제외 PK·placeholder 삭제), 백업 전용 테이블.

export const DEV_REF = 'fglggyfvzjdsbyckinqa';
export const PROD_REF = 'eymlabowhfgtxbiqwxqh';
export const STORAGE_BUCKETS = [
  'assets',
  'avatars',
  'generated-exports',
  'problem-assets',
];

export const TABLES = [
  {
    schema: 'auth',
    table: 'users',
    special: 'auth-users',
    allowedColumns: AUTH_USER_COPY_COLUMN_ALLOWLIST,
  },
  { schema: 'auth', table: 'identities', special: 'auth-identities' },
  {
    schema: 'public',
    table: 'profiles',
    updateOnConflict: true,
    preserveOnConflictColumns: ['app_role', 'plan_label', 'status', 'deleted_at'],
  },
  { schema: 'private', table: 'problem_identities', special: 'problem-identities' },
  { schema: 'public', table: 'topik_writing_51_questions' },
  { schema: 'public', table: 'topik_writing_52_questions' },
  { schema: 'public', table: 'topik_writing_53_questions' },
  { schema: 'public', table: 'topik_writing_54_questions' },
  { schema: 'public', table: 'topik_writing_question_import' },
  { schema: 'public', table: 'topik_writing_question_source_map' },
  { schema: 'public', table: 'topik_writing_problem_aliases' },
  { schema: 'public', table: 'topik_writing_question_institution_exposure' },
  { schema: 'public', table: 'problems' },
  { schema: 'public', table: 'problem_assets' },
  { schema: 'public', table: 'problem_attempts' },
  { schema: 'public', table: 'operation_policies', updateOnConflict: true },
  { schema: 'public', table: 'operation_policy_histories' },
  { schema: 'public', table: 'legal_documents', deletePlaceholders: true },
  {
    schema: 'public',
    table: 'institution_codes',
    excludePrimaryKeys: [
      { code: 'EXPO2026-BOOTH-A' },
      { code: 'EXPO2026-BOOTH-B' },
    ],
  },
  { schema: 'public', table: 'notification_groups' },
  { schema: 'public', table: 'learning_goals' },
  { schema: 'public', table: 'writing_drafts' },
  { schema: 'public', table: 'writing_submissions' },
  { schema: 'public', table: 'writing_feedback' },
  { schema: 'public', table: 'sentence_feedback' },
  { schema: 'public', table: 'feedback_dimension_scores' },
  { schema: 'public', table: 'writing_submission_metrics' },
  { schema: 'public', table: 'comparison_reports' },
  { schema: 'public', table: 'export_files' },
  { schema: 'public', table: 'library_items' },
  { schema: 'public', table: 'study_events' },
  { schema: 'public', table: 'user_consents' },
  { schema: 'public', table: 'user_marketing_consent' },
  { schema: 'public', table: 'notification_settings' },
  { schema: 'public', table: 'user_notifications' },
  { schema: 'public', table: 'notification_log' },
  { schema: 'public', table: 'recommendation_runs' },
  { schema: 'public', table: 'recommendation_items' },
  { schema: 'public', table: 'notification_dispatches' },
  { schema: 'public', table: 'notification_delivery_attempts' },
  { schema: 'public', table: 'pdf_export_quota_resets' },
  { schema: 'public', table: 'pdf_export_quota_reset_targets' },
  { schema: 'public', table: 'pdf_export_quota_usages' },
  { schema: 'public', table: 'institution_code_invitations' },
  { schema: 'public', table: 'user_admin_memos' },
  { schema: 'public', table: 'payment_history' },
  { schema: 'public', table: 'subscriptions' },
];

export const BACKUP_ONLY_TABLES = [
  ['public', 'admin_accounts'],
  ['public', 'admin_audit_logs'],
  ['public', 'auth_email_templates'],
  ['public', 'notification_templates'],
  ['public', 'pdf_export_quota_policies'],
];
