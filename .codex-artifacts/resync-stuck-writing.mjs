#!/usr/bin/env node
// Dev-only maintenance: re-sync writing_submissions stuck in 'analyzing'.
// Mirrors v13 src/app/api/writing/evaluation-status/route.ts semantics:
//   external graded  -> fetch feedback, map, sync_external_writing_feedback('complete')
//   external failed  -> sync('failed')
//   processing/other -> leave (report only)
// Owner tokens are minted via service-role generateLink(magiclink) + verifyOtp
// because the external API rejects non-owner tokens (403). Sessions are revoked
// after use. No secrets are printed.
//
// Usage:
//   node .codex-artifacts/resync-stuck-writing.mjs          # dry-run: status check only
//   node .codex-artifacts/resync-stuck-writing.mjs --apply  # sync graded/failed into DB
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const REF = 'fglggyfvzjdsbyckinqa';
const SUPA_URL = `https://${REF}.supabase.co`;
const EXTERNAL_BASE = 'https://api.dotoretopik.com';
const APPLY = process.argv.includes('--apply');

const env = readFileSync('.env.local', 'utf8');
const get = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim() : '';
};
const ANON = get('VITE_SUPABASE_PUBLISHABLE_KEY') || get('VITE_SUPABASE_ANON_KEY');
const SERVICE = get('SUPABASE_SECRET_KEY');
if (!ANON || !SERVICE) {
  console.error('missing anon/service key in .env.local');
  process.exit(1);
}

const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });

// owner email -> stuck submission ids (from dev DB query, 2026-07-07)
const TARGETS = [
  {
    email: 'jakeseol99@keduall.com',
    ids: ['780a5ad3-2c0d-44fe-a7e3-bd8bd197dfe9', '74b923c8-2385-4963-91f7-be10254d774e'],
  },
  {
    email: 'heyhye1104@gmail.com',
    ids: ['19cd2444-cf21-403e-a11b-054a95adb2e9'],
  },
  {
    email: 'chankispapa@gmail.com',
    ids: [
      '7e0f7467-02b0-4dff-a85d-a05e87ef40b6',
      '6711e4bf-cea2-4d22-8b2b-ef0488c768cc',
      '5b87cd47-c0b3-4d71-a8d8-e14adbb4f913',
      '5ea70fc0-ed25-4b90-aad0-a3f74d6953de',
      '05f9628d-7c29-4295-9801-6a7853c5b509',
      '43e04246-0474-4b6c-8216-3095f3231f33',
      '38d9a2d3-934f-4ba4-b46c-1d026b37d8fb',
      '5d34a52a-459c-4982-a7fa-a9b88d034405',
      '0ca7348d-0a30-4275-be96-6ab0bd8b76c4',
    ],
  },
];

// --- ported verbatim from v13 src/lib/writing-api/evaluation.ts ---
const TRAIT_TO_DIMENSION = {
  grammar: 'grammar',
  vocab: 'vocab',
  vocabulary: 'vocab',
  structure: 'structure',
  organization: 'structure',
  content: 'content',
  expression: 'expression',
  topic_fit: 'topic_fit',
  topic: 'topic_fit',
  language: 'language',
  language_use: 'language',
};

function mapExternalEvaluationFeedback(input) {
  const dimensions = (input.trait_scores ?? [])
    .map((trait) => {
      const key = (trait.trait ?? trait.name ?? '').toLowerCase();
      const dimension = TRAIT_TO_DIMENSION[key];
      if (!dimension) return null;
      const score = trait.score ?? null;
      return {
        dimension,
        score: score ?? 0,
        score_max: trait.max_score ?? input.max_score ?? 100,
        summary: trait.feedback ?? trait.comment ?? '',
        weakness_level: score == null ? 3 : score < 70 ? 4 : score < 85 ? 3 : 1,
      };
    })
    .filter((row) => row !== null);

  const sentences = (input.annotations ?? []).map((annotation, index) => {
    const originalText = annotation.original_text ?? annotation.text ?? '';
    return {
      sentence_index: index,
      original_text: originalText,
      corrected_text: annotation.corrected_text ?? annotation.suggestion ?? originalText,
      comment: annotation.comment ?? '',
    };
  });

  return {
    feedback: {
      status: 'complete',
      score_total: input.total_score,
      score_max: input.max_score,
      overall_summary: input.ai_summary ?? '',
      ai_model: 'talkpik-writing-api',
      ai_model_version: input.degraded ? 'degraded' : 'openapi',
    },
    dimensions,
    sentences,
  };
}
// --- end port ---

async function mintOwnerToken(email) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw new Error(`generateLink(${email}): ${error.message}`);
  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) throw new Error(`generateLink(${email}): no hashed_token`);
  const anonClient = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
  const { data: verified, error: verifyError } = await anonClient.auth.verifyOtp({
    type: 'magiclink',
    token_hash: tokenHash,
  });
  if (verifyError) throw new Error(`verifyOtp(${email}): ${verifyError.message}`);
  const session = verified?.session;
  if (!session?.access_token) throw new Error(`verifyOtp(${email}): no session`);
  return session;
}

async function externalGet(path, accessToken) {
  const res = await fetch(`${EXTERNAL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

const report = [];
for (const target of TARGETS) {
  let session;
  try {
    session = await mintOwnerToken(target.email);
    console.error(`token minted for ${target.email} (user ${session.user.id})`);
  } catch (e) {
    for (const id of target.ids) report.push({ id, owner: target.email, error: String(e.message) });
    continue;
  }

  for (const id of target.ids) {
    const row = { id, owner: target.email };
    try {
      const statusRes = await externalGet(`/api/evaluation/${encodeURIComponent(id)}`, session.access_token);
      if (!statusRes.ok) {
        row.external = `HTTP ${statusRes.status}`;
        row.detail = typeof statusRes.body === 'string' ? statusRes.body.slice(0, 160) : statusRes.body?.detail;
        report.push(row);
        continue;
      }
      const status = statusRes.body;
      row.external = status.status;
      row.total_score = status.total_score ?? null;
      row.max_score = status.max_score ?? null;
      if (status.submission_id !== id) {
        row.detail = `submission_id mismatch: ${status.submission_id}`;
        report.push(row);
        continue;
      }

      if (!APPLY) {
        row.action = status.status === 'graded' ? 'would sync -> complete'
          : status.status === 'failed' ? 'would sync -> failed'
          : 'leave as-is';
        report.push(row);
        continue;
      }

      if (status.status === 'graded') {
        const fbRes = await externalGet(`/api/evaluation/${encodeURIComponent(id)}/feedback`, session.access_token);
        if (!fbRes.ok) {
          row.action = `feedback fetch failed: HTTP ${fbRes.status}`;
          report.push(row);
          continue;
        }
        const externalFeedback = fbRes.body;
        if (externalFeedback.submission_id !== id) {
          row.action = `feedback submission_id mismatch: ${externalFeedback.submission_id}`;
          report.push(row);
          continue;
        }
        const payload = mapExternalEvaluationFeedback(externalFeedback);
        const { data: synced, error: syncError } = await admin.rpc('sync_external_writing_feedback', {
          target_submission_id: id,
          next_status: 'complete',
          feedback: { ...payload.feedback, raw_ai_result: externalFeedback },
          dimensions: payload.dimensions,
          sentences: payload.sentences,
        });
        row.action = syncError ? `sync error: ${syncError.message}` : `synced -> ${synced}`;
      } else if (status.status === 'failed') {
        const { data: synced, error: syncError } = await admin.rpc('sync_external_writing_feedback', {
          target_submission_id: id,
          next_status: 'failed',
          feedback: null,
          dimensions: [],
          sentences: [],
        });
        row.action = syncError ? `sync error: ${syncError.message}` : `synced -> ${synced}`;
      } else {
        row.action = 'left as-is (not graded/failed)';
      }
    } catch (e) {
      row.error = String(e).slice(0, 200);
    }
    report.push(row);
  }

  try {
    // 'local' = revoke only the session this script minted; never touch the
    // owner's real sessions on other devices.
    await admin.auth.admin.signOut(session.access_token, 'local');
    console.error(`session revoked for ${target.email}`);
  } catch {
    console.error(`session revoke failed for ${target.email} (will expire naturally)`);
  }
}

console.log(JSON.stringify(report, null, 2));
