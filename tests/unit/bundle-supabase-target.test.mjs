import { describe, expect, it } from 'vitest';

import {
  collectSupabaseRefs,
  evaluateBundleTarget,
} from '../../scripts/ci/assert-bundle-supabase-target.mjs';

const PROD_REF = 'eymlabowhfgtxbiqwxqh';
const DEV_REF = 'fglggyfvzjdsbyckinqa';

function bundle(map) {
  return {
    files: Object.keys(map),
    readFile: (path) => map[path],
  };
}

describe('production bundle Supabase target assertion', () => {
  it('extracts every Supabase project ref referenced by a bundle', () => {
    const refs = collectSupabaseRefs(
      `fetch("https://${PROD_REF}.supabase.co/rest/v1/rpc/x");const b="https://${DEV_REF}.supabase.co"`
    );
    expect([...refs].sort()).toEqual([PROD_REF, DEV_REF].sort());
  });

  it('passes when the bundle carries only the locked project', () => {
    const result = evaluateBundleTarget({
      expectedRef: PROD_REF,
      ...bundle({ 'index-a.js': `const u="https://${PROD_REF}.supabase.co";` }),
    });
    expect(result).toMatchObject({ ok: true, reason: 'ok', foundRefs: [PROD_REF] });
  });

  // This is the exact shape of the 2026-07-29 release failure: `vercel pull`
  // returns nothing for sensitive variables, so the bundle builds clean but
  // carries no endpoint and every RPC call is silently absent at runtime.
  it('fails when the bundle carries no Supabase endpoint at all', () => {
    const result = evaluateBundleTarget({
      expectedRef: PROD_REF,
      ...bundle({ 'index-a.js': 'const u=import.meta.env.VITE_SUPABASE_URL;' }),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('missing-supabase-endpoint');
  });

  it('fails when a Production build points at the development project', () => {
    const result = evaluateBundleTarget({
      expectedRef: PROD_REF,
      ...bundle({ 'index-a.js': `const u="https://${DEV_REF}.supabase.co";` }),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(`unexpected-supabase-ref:${DEV_REF}`);
  });

  it('fails when a build mixes two Supabase projects', () => {
    const result = evaluateBundleTarget({
      expectedRef: PROD_REF,
      ...bundle({
        'index-a.js': `const u="https://${PROD_REF}.supabase.co";`,
        'index-b.js': `const v="https://${DEV_REF}.supabase.co";`,
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(`unexpected-supabase-ref:${DEV_REF}`);
  });

  it('fails closed on an empty build output or a malformed expected ref', () => {
    expect(evaluateBundleTarget({ expectedRef: PROD_REF, ...bundle({}) })).toMatchObject({
      ok: false,
      reason: 'no-bundle-files',
    });
    expect(
      evaluateBundleTarget({
        expectedRef: '',
        ...bundle({ 'index-a.js': `https://${PROD_REF}.supabase.co` }),
      }).reason
    ).toBe('invalid-expected-ref:');
  });
});
