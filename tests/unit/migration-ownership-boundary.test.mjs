import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import {
  evaluateMigrationOwnershipBoundary,
  formatMigrationOwnershipBoundaryReport
} from '../../scripts/check-migration-ownership-boundary.mjs';

const REMOVED_V13_ADMIN_OBJECTS = [
  'admin_update_problem',
  'admin_delete_problem',
  'admin_add_problem_asset',
  'admin_remove_problem_asset',
  'admin_toggle_problem_publish',
  'admin_change_user_role',
  'admin_set_user_status',
  'get_admin_user_stats',
  'get_admin_audit_logs',
  'get_admin_org_dashboard',
  'organizations',
  'org_members',
  'assignments',
  'assignment_submissions',
  'is_org_member',
  'is_org_manager'
];

const TOPIK_AI_ADMIN_OBJECTS = [
  'get_admin_users',
  'admin_set_user_status',
  'admin_list_audit_logs',
  'admin_set_admin_app_role',
  'admin_list_admin_app_roles',
  'admin_audit_logs',
  'notification_templates',
  'notification_groups',
  'notification_dispatches',
  'notification_delivery_attempts',
  'notification_email_config',
  'render_notification_text',
  'dispatch_scheduled_notifications',
  'dispatch_admin_notifications',
  'dispatch_notification_event',
  'retry_failed_email_attempts',
  'notification_email_transport',
  'finalize_email_attempt',
  'dispatch_notifications',
  'operation_notices',
  'operation_faqs',
  'operation_faq_curations',
  'operation_faq_metrics',
  'operation_events',
  'operation_policies',
  'operation_policy_histories',
  'community_posts',
  'community_post_admin_notes',
  'community_reports',
  'commerce_point_policies',
  'commerce_point_ledgers',
  'commerce_point_expirations',
  'commerce_coupons',
  'commerce_coupon_subscription_templates',
  'commerce_refunds',
  'system_metadata_groups',
  'system_metadata_group_items',
  'system_logs'
];

const V13_USER_SHARED_OBJECTS = [
  'profiles',
  'nationality_country_code',
  'subscription_plans',
  'subscriptions',
  'payment_history',
  'legal_documents',
  'user_consents',
  'notification_settings',
  'user_notifications',
  'user_marketing_consent',
  'notification_delivery_attempts'
];

const TOPIK_AI_REFERENCE_ONLY_OBJECTS = [
  'profiles',
  'payment_history',
  'legal_documents',
  'user_consents'
];

let tempDirs = [];

function createTempRoot(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(root);
  return root;
}

function writeProjectFile(root, relativePath, content) {
  const absolutePath = join(root, relativePath);
  mkdirSync(join(absolutePath, '..'), { recursive: true });
  writeFileSync(absolutePath, content, 'utf8');
}

function writeValidFixtures(topikAiRoot, v13Root) {
  writeProjectFile(
    v13Root,
    'supabase/migrations/20260609130000_remove_v13_admin_island.sql',
    REMOVED_V13_ADMIN_OBJECTS.join('\n')
  );
  writeProjectFile(
    v13Root,
    'supabase/migrations/20260612160000_user_notifications.sql',
    V13_USER_SHARED_OBJECTS.join('\n')
  );
  writeProjectFile(
    v13Root,
    'supabase/migrations/20260612200000_user_marketing_consent.sql',
    'user_marketing_consent\n'
  );
  writeProjectFile(
    topikAiRoot,
    'supabase/migrations-admin/20260612170000_notification_admin_tables.sql',
    [...TOPIK_AI_ADMIN_OBJECTS, ...TOPIK_AI_REFERENCE_ONLY_OBJECTS].join('\n')
  );
  writeProjectFile(
    topikAiRoot,
    'supabase/migrations/20260610200300_topik_writing_51_questions.sql',
    'topik_writing_51_questions\n'
  );
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('check-migration-ownership-boundary', () => {
  it('passes when v13 removal and topik-ai admin migration homes are present', () => {
    const topikAiRoot = createTempRoot('topik-ai-migration-boundary-');
    const v13Root = createTempRoot('v13-migration-boundary-');
    writeValidFixtures(topikAiRoot, v13Root);

    const result = evaluateMigrationOwnershipBoundary({ topikAiRoot, v13Root });

    expect(result).toEqual({ failures: [], warnings: [] });
    expect(formatMigrationOwnershipBoundaryReport(result)).toBe('Migration ownership boundary check passed.');
  });

  it('fails when the v13 admin-island removal migration does not cover an object', () => {
    const topikAiRoot = createTempRoot('topik-ai-migration-boundary-');
    const v13Root = createTempRoot('v13-migration-boundary-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(
      v13Root,
      'supabase/migrations/20260609130000_remove_v13_admin_island.sql',
      REMOVED_V13_ADMIN_OBJECTS.filter((term) => term !== 'admin_update_problem').join('\n')
    );

    const result = evaluateMigrationOwnershipBoundary({ topikAiRoot, v13Root });

    expect(result.failures).toContain('v13 removal migration must mention removed admin object admin_update_problem.');
  });

  it('fails when the v13 admin-island removal migration omits the transferred user status RPC', () => {
    const topikAiRoot = createTempRoot('topik-ai-migration-boundary-');
    const v13Root = createTempRoot('v13-migration-boundary-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(
      v13Root,
      'supabase/migrations/20260609130000_remove_v13_admin_island.sql',
      REMOVED_V13_ADMIN_OBJECTS.filter((term) => term !== 'admin_set_user_status').join('\n')
    );

    const result = evaluateMigrationOwnershipBoundary({ topikAiRoot, v13Root });

    expect(result.failures).toContain('v13 removal migration must mention removed admin object admin_set_user_status.');
  });

  it('warns when v13 historical migrations still mention topik-ai admin objects', () => {
    const topikAiRoot = createTempRoot('topik-ai-migration-boundary-');
    const v13Root = createTempRoot('v13-migration-boundary-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(v13Root, 'supabase/migrations/20260602120400_admin_and_user_rpcs.sql', 'get_admin_users\n');

    const result = evaluateMigrationOwnershipBoundary({ topikAiRoot, v13Root });

    expect(result.failures).toEqual([]);
    expect(result.warnings).toContain(
      'v13 historical migrations mention get_admin_users; ensure current code/docs treat it as removed, topik-ai-owned, or historical.'
    );
  });

  it('fails when v13 replay migrations retain the transferred notification pipeline', () => {
    const topikAiRoot = createTempRoot('topik-ai-migration-boundary-');
    const v13Root = createTempRoot('v13-migration-boundary-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(
      v13Root,
      'supabase/migrations/20260612180000_notification_dispatcher.sql',
      'create or replace function private.dispatch_notifications() returns void language sql as $$ select 1 $$;\n'
    );

    const result = evaluateMigrationOwnershipBoundary({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'v13 replay migrations must not define or reference topik-ai-owned notification pipeline object dispatch_notifications.'
    );
  });

  it('fails when topik-ai admin migrations do not document v13-owned reference dependencies', () => {
    const topikAiRoot = createTempRoot('topik-ai-migration-boundary-');
    const v13Root = createTempRoot('v13-migration-boundary-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(
      topikAiRoot,
      'supabase/migrations-admin/20260612170000_notification_admin_tables.sql',
      TOPIK_AI_ADMIN_OBJECTS.join('\n')
    );

    const result = evaluateMigrationOwnershipBoundary({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'topik-ai migrations-admin must document read/reference dependency on v13-owned object payment_history.'
    );
  });

  it('fails when topik-ai admin migrations omit a documented admin-owned table', () => {
    const topikAiRoot = createTempRoot('topik-ai-migration-boundary-');
    const v13Root = createTempRoot('v13-migration-boundary-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(
      topikAiRoot,
      'supabase/migrations-admin/20260612170000_notification_admin_tables.sql',
      [...TOPIK_AI_ADMIN_OBJECTS.filter((term) => term !== 'operation_faqs'), ...TOPIK_AI_REFERENCE_ONLY_OBJECTS].join('\n')
    );

    const result = evaluateMigrationOwnershipBoundary({ topikAiRoot, v13Root });

    expect(result.failures).toContain('topik-ai migrations-admin must own or reference admin object operation_faqs.');
  });

  it('fails when topik-ai admin migrations write v13-owned billing or legal objects', () => {
    const topikAiRoot = createTempRoot('topik-ai-migration-boundary-');
    const v13Root = createTempRoot('v13-migration-boundary-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(
      topikAiRoot,
      'supabase/migrations-admin/20260618100000_bad_payment_history_write.sql',
      'insert into public.payment_history (id) values (gen_random_uuid());\n'
    );

    const result = evaluateMigrationOwnershipBoundary({ topikAiRoot, v13Root });

    expect(result.failures).toContain(
      'supabase/migrations-admin/20260618100000_bad_payment_history_write.sql:1 must not write or define v13-owned object payment_history.'
    );
  });

  it('fails when topik-ai admin migrations update non-approved profiles columns', () => {
    const topikAiRoot = createTempRoot('topik-ai-migration-boundary-');
    const v13Root = createTempRoot('v13-migration-boundary-');
    writeValidFixtures(topikAiRoot, v13Root);
    writeProjectFile(
      topikAiRoot,
      'supabase/migrations-admin/20260617210000_admin_users_directory.sql',
      [
        ...TOPIK_AI_ADMIN_OBJECTS,
        ...TOPIK_AI_REFERENCE_ONLY_OBJECTS,
        'update public.profiles',
        "   set display_name = 'bad'",
        ' where id = gen_random_uuid();'
      ].join('\n')
    );

    const result = evaluateMigrationOwnershipBoundary({ topikAiRoot, v13Root });

    expect(result.failures.some((failure) =>
      failure.includes('supabase/migrations-admin/20260617210000_admin_users_directory.sql:') &&
      failure.includes('may update profiles.status only, found profiles.display_name')
    )).toBe(true);
  });
});
