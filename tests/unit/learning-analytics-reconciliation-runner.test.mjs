import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runner = readFileSync(
  new URL('../../scripts/etl/reconcile-learning-analytics-metadata.mjs', import.meta.url),
  'utf8'
);

describe('learning analytics reconciliation runner verification', () => {
  it('verifies apply and restore by expected problem id and target cardinality', () => {
    expect(runner).toContain('problemId: row.expected_problem_id');
    expect(runner).toContain('actual.length !== sortedExpected.length');
    expect(runner).not.toContain('target.problemId === row.problem_id');
  });

  it('verifies created source-map anchors on apply and their removal on restore', () => {
    expect(runner).toContain('verifiedSourceMapAnchorCount');
    expect(runner).toContain('created source-map anchor(s) remain');
    expect(runner).toContain('removedSourceMapAnchorCount');
  });
});
