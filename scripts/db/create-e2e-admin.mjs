#!/usr/bin/env node
// 신규 스키마 연결 검증용 시드 admin 계정 생성 (talkpik-dev 전용).
// 관리자 계정 분리 이후: Auth admin API(service role)로 사용자 생성 + admin_accounts에
// platform_admin 으로 upsert. 관리자 식별은 profiles.app_role 이 아니라 admin_accounts 에서
// 이뤄진다(헬퍼 is_admin/is_platform_admin 가 admin_accounts 를 읽음). 자격증명은 환경변수로만.
//
// Usage:
//   set E2E_ADMIN_EMAIL=...; set E2E_ADMIN_PASSWORD=...; set SUPABASE_SECRET_KEY=...
//   node scripts/db/create-e2e-admin.mjs

const URL_BASE = process.env.VITE_SUPABASE_URL ?? 'https://fglggyfvzjdsbyckinqa.supabase.co';
const SECRET = process.env.SUPABASE_SECRET_KEY;
const EMAIL = process.env.E2E_ADMIN_EMAIL;
const PASSWORD = process.env.E2E_ADMIN_PASSWORD;

if (!SECRET || !EMAIL || !PASSWORD) {
  console.error('SUPABASE_SECRET_KEY, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD must be set.');
  process.exit(1);
}

const headers = {
  apikey: SECRET,
  Authorization: `Bearer ${SECRET}`,
  'Content-Type': 'application/json',
};

// 1. find-or-create auth user
let userId = null;
const listRes = await fetch(`${URL_BASE}/auth/v1/admin/users?page=1&per_page=1000`, { headers });
if (!listRes.ok) {
  console.error(`list users failed: HTTP ${listRes.status} ${await listRes.text()}`);
  process.exit(1);
}
const listJson = await listRes.json();
const existing = (listJson.users ?? listJson).find?.((u) => u.email === EMAIL);
if (existing) {
  userId = existing.id;
  console.log(`auth user already exists: ${userId}`);
} else {
  const createRes = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true }),
  });
  const created = await createRes.json();
  if (!createRes.ok) {
    console.error(`create user failed: HTTP ${createRes.status} ${JSON.stringify(created)}`);
    process.exit(1);
  }
  userId = created.id;
  console.log(`auth user created: ${userId}`);
}

// 2. upsert admin_accounts (new model: admin identity lives here, not profiles.app_role).
//    service role bypasses RLS. The handle_new_user-created profiles row (if any) is a
//    harmless vestige on dev; physical removal of admins' profiles rows is a separate,
//    backup-guarded production step (see scripts/db/phase7-delete-admin-profiles.mjs).
const adminRow = {
  id: userId,
  email: EMAIL,
  display_name: 'E2E Admin',
  role: 'platform_admin',
  status: 'active',
};
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const upsertRes = await fetch(`${URL_BASE}/rest/v1/admin_accounts`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(adminRow),
  });
  const rows = await upsertRes.json();
  if (upsertRes.ok && Array.isArray(rows) && rows.length > 0) {
    console.log(`admin_accounts ensured: role=${rows[0].role}, status=${rows[0].status}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.error('admin_accounts upsert failed after retries.');
process.exit(1);
