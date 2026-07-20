import { describe, expect, it } from 'vitest';

import { normalizeTargetType } from '../../src/shared/model/target-type-label';

describe('normalizeTargetType', () => {
  it('maps the persisted User target to the Users UI route contract', () => {
    expect(normalizeTargetType('User')).toBe('Users');
    expect(normalizeTargetType('Users')).toBe('Users');
  });

  it('keeps unrelated target types unchanged', () => {
    expect(normalizeTargetType('AdminAccount')).toBe('AdminAccount');
  });
});
