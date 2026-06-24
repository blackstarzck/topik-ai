#!/usr/bin/env node
// Phase 8 enforcement migration generator.
//
// For each admin write RPC, fetches the LIVE body (pg_get_functiondef), inserts a
// public.admin_has_permission(caller_id, '<key>') guard immediately after the existing
// `private.is_admin(caller_id)` check, and writes an up migration (guarded bodies) plus
// a down migration (original bodies verbatim). Read-only against the DB; it only emits
// files. Apply with run-sql.mjs.
//
// Usage:
//   node scripts/db/gen-phase8-enforcement.mjs <domainKey> <timestamp>
//   e.g. node scripts/db/gen-phase8-enforcement.mjs operation 20260623280000

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

if (!process.env.SUPABASE_ACCESS_TOKEN && existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = /^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+?)\s*$/.exec(line);
    if (m) { process.env.SUPABASE_ACCESS_TOKEN = m[1].replace(/^["']|["']$/g, ''); break; }
  }
}
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF ?? 'fglggyfvzjdsbyckinqa';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN not set'); process.exit(1); }

async function runSql(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  return JSON.parse(text);
}

// domainKey -> { title, rpcs: [ [proname, permissionKey], ... ] }
const DOMAINS = {
  operation: {
    title: 'operation (notices/faq/events/policies)',
    rpcs: [
      ['admin_save_operation_notice', 'operation.notices.manage'],
      ['admin_toggle_operation_notice_status', 'operation.notices.manage'],
      ['admin_delete_operation_notice', 'operation.notices.manage'],
      ['admin_save_operation_faq', 'operation.faq.manage'],
      ['admin_toggle_operation_faq_status', 'operation.faq.manage'],
      ['admin_delete_operation_faq', 'operation.faq.manage'],
      ['admin_save_operation_faq_curation', 'operation.faq.manage'],
      ['admin_delete_operation_faq_curation', 'operation.faq.manage'],
      ['admin_save_operation_event', 'operation.events.manage'],
      ['admin_schedule_operation_event', 'operation.events.manage'],
      ['admin_publish_operation_event', 'operation.events.manage'],
      ['admin_end_operation_event', 'operation.events.manage'],
      ['admin_save_operation_policy', 'operation.policies.manage'],
      ['admin_toggle_operation_policy_status', 'operation.policies.manage'],
      ['admin_delete_operation_policy', 'operation.policies.manage'],
      ['admin_publish_operation_policy_version', 'operation.policies.manage']
    ]
  },
  commerce: {
    title: 'commerce (refunds/coupons/points)',
    rpcs: [
      ['admin_approve_billing_refund', 'commerce.refunds.approve'],
      ['admin_reject_billing_refund', 'commerce.refunds.approve'],
      ['admin_save_commerce_coupon', 'commerce.coupons.manage'],
      ['admin_delete_commerce_coupon', 'commerce.coupons.manage'],
      ['admin_duplicate_commerce_coupon', 'commerce.coupons.manage'],
      ['admin_set_commerce_coupon_issue_state', 'commerce.coupons.manage'],
      ['admin_save_commerce_coupon_template', 'commerce.coupons.manage'],
      ['admin_delete_commerce_coupon_template', 'commerce.coupons.manage'],
      ['admin_set_commerce_coupon_template_status', 'commerce.coupons.manage'],
      ['admin_create_manual_point_adjustment', 'commerce.points.manage'],
      ['admin_save_commerce_point_policy', 'commerce.points.manage'],
      ['admin_update_commerce_point_policy_status', 'commerce.points.manage'],
      ['admin_hold_commerce_point_expiration', 'commerce.points.manage'],
      ['admin_release_commerce_point_expiration', 'commerce.points.manage']
    ]
  },
  users: {
    title: 'users (instructors/referrals/institution-codes)',
    rpcs: [
      ['admin_add_instructor_note', 'users.groups.manage'],
      ['admin_delete_instructor_note', 'users.groups.manage'],
      ['admin_set_instructor_status', 'users.groups.manage'],
      ['admin_adjust_referral_reward', 'users.referrals.manage'],
      ['admin_review_referral_anomaly', 'users.referrals.manage'],
      ['admin_set_referral_status', 'users.referrals.manage'],
      ['admin_create_institution_code', 'users.institution-codes.manage'],
      ['admin_update_institution_code', 'users.institution-codes.manage']
    ]
  },
  system_metadata: {
    title: 'system metadata',
    rpcs: [
      ['admin_save_metadata_group', 'system.metadata.manage'],
      ['admin_save_metadata_item', 'system.metadata.manage'],
      ['admin_toggle_metadata_group_status', 'system.metadata.manage'],
      ['admin_toggle_metadata_item_status', 'system.metadata.manage'],
      ['admin_reorder_metadata_items', 'system.metadata.manage'],
      ['admin_delete_metadata_item', 'system.metadata.manage']
    ]
  },
  message_mail: {
    title: 'message (auth email templates)',
    rpcs: [
      ['admin_save_auth_email_template', 'message.mail.manage'],
      ['admin_mark_auth_email_synced', 'message.mail.manage']
    ]
  },
  notifications: {
    title: 'message (notification templates/dispatch/groups)',
    rpcs: [
      ['admin_save_notification_group', 'message.groups.manage'],
      ['admin_delete_notification_group', 'message.groups.manage'],
      // template/dispatch span mail/push/inapp at runtime → caller needs ANY channel-manage.
      ['admin_save_notification_template', ['message.mail.manage', 'message.push.manage', 'message.inapp.manage']],
      ['admin_set_notification_template_status', ['message.mail.manage', 'message.push.manage', 'message.inapp.manage']],
      ['admin_delete_notification_template', ['message.mail.manage', 'message.push.manage', 'message.inapp.manage']],
      ['admin_send_notification', ['message.mail.manage', 'message.push.manage', 'message.inapp.manage']],
      ['admin_cancel_notification_dispatch', ['message.mail.manage', 'message.push.manage', 'message.inapp.manage']],
      // terms-change notice is part of the policy workflow.
      ['admin_send_terms_change_notification', 'operation.policies.manage']
    ]
  },
  user_memos: {
    title: 'user admin memos',
    rpcs: [
      // member memo is written from the member detail page (users.read gates that access);
      // content_admin lacks users.read so it is correctly blocked.
      ['admin_add_user_memo', 'users.read'],
      ['admin_delete_user_memo', 'users.read']
    ]
  }
};

const IS_ADMIN_LINE = "if not private.is_admin(caller_id) then raise exception 'forbidden: admin required'; end if;";

// key may be a string (single permission) or an array (caller needs ANY one of them, OR).
function guardFor(key) {
  if (Array.isArray(key)) {
    const checks = key.map((k) => `public.admin_has_permission(caller_id, '${k}')`).join(' or ');
    return `\n  if not (${checks}) then raise exception 'forbidden: missing permission (${key.join('/')})'; end if;`;
  }
  return `\n  if not public.admin_has_permission(caller_id, '${key}') then raise exception 'forbidden: missing permission ${key}'; end if;`;
}

async function fetchDef(proname) {
  const rows = await runSql(
    `select pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='${proname}'`
  );
  if (!rows.length) throw new Error(`function not found: ${proname}`);
  if (rows.length > 1) throw new Error(`overloaded (handle manually): ${proname}`);
  return rows[0].def.replace(/\s+$/, ''); // trim trailing whitespace/newline
}

const domainKey = process.argv[2];
const timestamp = process.argv[3];
if (!domainKey || !timestamp || !DOMAINS[domainKey]) {
  console.error(`usage: node scripts/db/gen-phase8-enforcement.mjs <${Object.keys(DOMAINS).join('|')}> <timestamp>`);
  process.exit(1);
}
const domain = DOMAINS[domainKey];

const upParts = [];
const downParts = [];
for (const [proname, key] of domain.rpcs) {
  const def = await fetchDef(proname);
  const idx = def.indexOf(IS_ADMIN_LINE);
  if (idx === -1) {
    console.error(`!! ${proname}: is_admin guard line not found — SKIP (handle manually)`);
    process.exit(1);
  }
  if (def.includes('admin_has_permission')) {
    console.error(`!! ${proname}: already gated — SKIP`);
    continue;
  }
  const guarded = def.replace(IS_ADMIN_LINE, IS_ADMIN_LINE + guardFor(key));
  upParts.push(`${guarded};`);
  downParts.push(`${def};`);
}

const here = dirname(fileURLToPath(import.meta.url));
const adminDir = join(here, '..', '..', 'supabase', 'migrations-admin');
const upPath = join(adminDir, `${timestamp}_phase8_${domainKey}.sql`);
const downPath = join(adminDir, 'down', `${timestamp}_phase8_${domainKey}.sql`);

const header = `-- Phase 8 enforcement (${domain.title}): admin_has_permission gates after is_admin.\n-- Generated from live bodies by scripts/db/gen-phase8-enforcement.mjs.\n-- down: supabase/migrations-admin/down/${timestamp}_phase8_${domainKey}.sql\n\n`;
writeFileSync(upPath, header + upParts.join('\n\n') + '\n');
writeFileSync(downPath, `-- down: restore ${domain.title} RPCs without the admin_has_permission guard.\n\n` + downParts.join('\n\n') + '\n');
console.log(`wrote ${upPath}\nwrote ${downPath}\n(${upParts.length} functions gated)`);
