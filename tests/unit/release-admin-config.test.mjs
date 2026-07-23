import { describe, expect, it } from 'vitest';
import { releaseProtectionHeaders } from '../../playwright.release-admin.config.ts';

describe('release admin browser config', () => {
  it('does not add Vercel protection headers without an automation bypass secret', () => {
    expect(releaseProtectionHeaders({})).toBeUndefined();
    expect(releaseProtectionHeaders({ VERCEL_AUTOMATION_BYPASS_SECRET: '   ' }))
      .toBeUndefined();
  });

  it('adds the protected candidate headers without changing the secret', () => {
    expect(releaseProtectionHeaders({
      VERCEL_AUTOMATION_BYPASS_SECRET: 'candidate-secret'
    })).toEqual({
      'x-vercel-protection-bypass': 'candidate-secret',
      'x-vercel-set-bypass-cookie': 'true'
    });
  });
});
