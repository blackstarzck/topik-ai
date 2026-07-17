import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const cleanupSql = readFileSync(
  new URL('../../scripts/db/sql/production-admin-demo-cleanup.sql', import.meta.url),
  'utf8',
).replace(/\s+/g, ' ').toLowerCase();

describe('production admin demo cleanup boundary', () => {
  it('preserves legal policy source-of-truth rows while removing demo operation rows', () => {
    expect(cleanupSql).not.toContain('delete from public.operation_policy_histories');
    expect(cleanupSql).not.toContain('delete from public.operation_policies');
    expect(cleanupSql).toContain('delete from public.operation_faqs');
    expect(cleanupSql).toContain('delete from public.operation_events');
    expect(cleanupSql).toContain('delete from public.operation_notices');
  });
});
