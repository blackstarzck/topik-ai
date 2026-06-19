#!/usr/bin/env node
// Dev-only: sign in as the e2e admin and write a browser localStorage payload to
// public/__e2e_session.json so a preview browser can inject the session (Supabase
// mode). Never prints the password or token. Delete the public file after use.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const REF = 'fglggyfvzjdsbyckinqa';
const URL = `https://${REF}.supabase.co`;
const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim() : '';
};
const ANON = get('VITE_SUPABASE_PUBLISHABLE_KEY') || get('VITE_SUPABASE_ANON_KEY');
const EMAIL = get('E2E_ADMIN_EMAIL');
const PASSWORD = get('E2E_ADMIN_PASSWORD');
if (!ANON || !EMAIL || !PASSWORD) {
  console.error('missing anon key / e2e creds in .env.local');
  process.exit(1);
}

const sb = createClient(URL, ANON, { auth: { persistSession: false } });
const { data, error } = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (error) {
  console.error('signin failed:', error.message);
  process.exit(1);
}

const key = `sb-${REF}-auth-token`;
const value = JSON.stringify(data.session);
if (!existsSync('public')) mkdirSync('public');
writeFileSync('public/__e2e_session.json', JSON.stringify({ key, value }), 'utf8');
console.log('ok | signed in as', EMAIL, '| user_id', data.session.user.id, '| access_token_len', data.session.access_token.length);
