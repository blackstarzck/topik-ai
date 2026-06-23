import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TOPIK_AI_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_V13_ROOT = path.resolve(TOPIK_AI_ROOT, '..', 'topik-project', 'v13');

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

const V13_FORBIDDEN_ADMIN_WRITE_OBJECTS = [
  'subscription_plans',
  'subscriptions',
  'payment_history',
  'legal_documents',
  'user_consents'
];

const ALLOWED_PROFILE_WRITE_FILES = new Map([
  [
    'supabase/migrations-admin/20260617210000_admin_users_directory.sql',
    ['status']
  ],
  [
    'supabase/migrations-admin/20260618093000_admin_set_app_role.sql',
    ['app_role']
  ],
  [
    // Users > 기관 코드 회원 배정/해제 — admin_assign/clear_institution_code 가
    // profiles.affiliation_code 만 platform_admin + reason + self-verify 로 쓴다.
    'supabase/migrations-admin/20260623110000_institution_code_membership.sql',
    ['affiliation_code']
  ]
]);

function readProjectFile(rootDir, relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function hasFile(rootDir, relativePath) {
  try {
    return statSync(path.join(rootDir, relativePath)).isFile();
  } catch {
    return false;
  }
}

function listSqlFiles(rootDir, relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(absoluteDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      files.push(...listSqlFiles(rootDir, relativePath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.sql')) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

function concatFiles(rootDir, relativeFiles) {
  return relativeFiles.map((file) => readProjectFile(rootDir, file)).join('\n');
}

function contentHasTerm(content, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`).test(content);
}

function lineMatchesWriteToObject(line, objectName) {
  const escaped = objectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `\\b(create\\s+table|alter\\s+table|drop\\s+table|insert\\s+into|update|delete\\s+from)\\s+(if\\s+(not\\s+)?exists\\s+)?public\\.${escaped}\\b`,
    'i'
  ).test(line);
}

function getProfileUpdateColumns(lines, startIndex) {
  const columns = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*where\b/i.test(line) || /^\s*returning\b/i.test(line) || /;\s*$/.test(line)) {
      break;
    }
    const match = line.match(/^\s*(?:set\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=/i);
    if (match) {
      columns.push(match[1]);
    }
  }
  return columns;
}

function collectForbiddenV13AdminWrites(rootDir, files) {
  const findings = [];

  for (const file of files) {
    const lines = readProjectFile(rootDir, file).split(/\r?\n/);
    const allowedProfileColumns = ALLOWED_PROFILE_WRITE_FILES.get(file) ?? [];

    lines.forEach((line, index) => {
      for (const objectName of V13_FORBIDDEN_ADMIN_WRITE_OBJECTS) {
        if (lineMatchesWriteToObject(line, objectName)) {
          findings.push(`${file}:${index + 1} must not write or define v13-owned object ${objectName}.`);
        }
      }

      if (lineMatchesWriteToObject(line, 'profiles')) {
        if (!ALLOWED_PROFILE_WRITE_FILES.has(file)) {
          findings.push(`${file}:${index + 1} must not write v13-owned profiles outside approved admin RPC exceptions.`);
          return;
        }

        const columns = getProfileUpdateColumns(lines, index);
        for (const column of columns) {
          if (!allowedProfileColumns.includes(column)) {
            findings.push(`${file}:${index + 1} may update profiles.${allowedProfileColumns.join('|')} only, found profiles.${column}.`);
          }
        }
      }
    });
  }

  return findings;
}

export function evaluateMigrationOwnershipBoundary({
  topikAiRoot = TOPIK_AI_ROOT,
  v13Root = DEFAULT_V13_ROOT
} = {}) {
  const failures = [];
  const warnings = [];

  const v13RemovalMigration = 'supabase/migrations/20260609130000_remove_v13_admin_island.sql';
  if (!hasFile(v13Root, v13RemovalMigration)) {
    failures.push(`v13 ${v13RemovalMigration} is missing.`);
  } else {
    const removalSql = readProjectFile(v13Root, v13RemovalMigration);
    for (const term of REMOVED_V13_ADMIN_OBJECTS) {
      if (!contentHasTerm(removalSql, term)) {
        failures.push(`v13 removal migration must mention removed admin object ${term}.`);
      }
    }
  }

  const topikAiAdminFiles = listSqlFiles(topikAiRoot, 'supabase/migrations-admin').filter(
    (file) => !file.includes('/down/')
  );
  const topikAiAdminSql = concatFiles(topikAiRoot, topikAiAdminFiles);
  failures.push(...collectForbiddenV13AdminWrites(topikAiRoot, topikAiAdminFiles));

  for (const term of TOPIK_AI_ADMIN_OBJECTS) {
    if (!contentHasTerm(topikAiAdminSql, term)) {
      failures.push(`topik-ai migrations-admin must own or reference admin object ${term}.`);
    }
  }

  const topikAiWritingFiles = listSqlFiles(topikAiRoot, 'supabase/migrations').filter((file) => !file.includes('/down/'));
  const topikAiWritingSql = concatFiles(topikAiRoot, topikAiWritingFiles);
  if (!contentHasTerm(topikAiWritingSql, 'topik_writing_51_questions')) {
    failures.push('topik-ai topik writing migrations must contain topik_writing question tables.');
  }

  const v13MigrationFiles = listSqlFiles(v13Root, 'supabase/migrations').filter((file) => !file.includes('/down/'));
  const v13MigrationSql = concatFiles(v13Root, v13MigrationFiles);
  const v13HistoricalAdminSql = concatFiles(
    v13Root,
    v13MigrationFiles.filter((file) => file !== v13RemovalMigration)
  );
  for (const term of V13_USER_SHARED_OBJECTS) {
    if (!contentHasTerm(v13MigrationSql, term)) {
      failures.push(`v13 migrations must preserve user-facing/shared object ${term}.`);
    }
  }

  for (const term of TOPIK_AI_REFERENCE_ONLY_OBJECTS) {
    if (!contentHasTerm(topikAiAdminSql, term)) {
      failures.push(`topik-ai migrations-admin must document read/reference dependency on v13-owned object ${term}.`);
    }
  }

  for (const term of TOPIK_AI_ADMIN_OBJECTS) {
    if (contentHasTerm(v13HistoricalAdminSql, term) && term !== 'notification_delivery_attempts') {
      warnings.push(
        `v13 historical migrations mention ${term}; ensure current code/docs treat it as removed, topik-ai-owned, or historical.`
      );
    }
  }

  return { failures, warnings };
}

export function formatMigrationOwnershipBoundaryReport(result) {
  const lines = [];

  if (result.failures.length === 0) {
    lines.push('Migration ownership boundary check passed.');
  } else {
    lines.push('Migration ownership boundary check failed:');
    lines.push(...result.failures.map((failure) => `- ${failure}`));
  }

  if (result.warnings.length > 0) {
    lines.push('Migration ownership boundary warnings:');
    lines.push(...result.warnings.map((warning) => `- ${warning}`));
  }

  return lines.join('\n');
}

function main() {
  const v13RootArg = process.argv.find((arg) => arg.startsWith('--v13-root='));
  const v13Root = v13RootArg ? path.resolve(v13RootArg.slice('--v13-root='.length)) : DEFAULT_V13_ROOT;
  const result = evaluateMigrationOwnershipBoundary({ v13Root });
  const report = formatMigrationOwnershipBoundaryReport(result);

  if (result.failures.length > 0) {
    console.error(report);
    process.exit(1);
  }

  console.log(report);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
