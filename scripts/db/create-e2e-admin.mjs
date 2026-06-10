#!/usr/bin/env node
// D-12: 신규 스키마 연결 검증용 시드 admin 계정 생성 (talkpik-dev 전용).
// Auth admin API(service role)로 사용자 생성 + profiles.app_role=content_admin 승격.
// 자격증명은 환경변수로만 받는다(.env.local, 커밋 금지).
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

// 2. promote profile to content_admin (handle_new_user 트리거가 프로필을 만들 때까지 재시도)
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const patchRes = await fetch(
    `${URL_BASE}/rest/v1/profiles?id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ app_role: 'content_admin', status: 'active' }),
    },
  );
  const rows = await patchRes.json();
  if (patchRes.ok && Array.isArray(rows) && rows.length > 0) {
    console.log(`profile promoted: app_role=${rows[0].app_role}, status=${rows[0].status}`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 1000));
}
console.error('profile row not found after retries — check handle_new_user trigger.');
process.exit(1);
