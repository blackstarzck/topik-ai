import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const repairSql = await readFile(
  new URL(
    '../../scripts/db/sql/repair-operation-policy-history-links.sql',
    import.meta.url,
  ),
  'utf8',
);

const recoveryScript = await readFile(
  new URL('../../scripts/db/recover-prod-from-dev.mjs', import.meta.url),
  'utf8',
);

describe('operation policy production recovery', () => {
  it('repairs only missing or cross-linked current history rows without deletion', () => {
    expect(repairSql).toContain('history.policy_id = policy.id');
    expect(repairSql).toContain('history.id = policy.current_version_id');
    expect(repairSql).toContain('next_operation_policy_history_id()');
    expect(repairSql).toContain('operation_policy_snapshot(policy_row)');
    expect(repairSql).toContain('set current_version_id = next_history_id');
    expect(repairSql).not.toMatch(/\bdelete\s+from\b/i);
    expect(repairSql).not.toMatch(/\btruncate\b/i);
  });

  it('copies the complete policy registry and its complete history', () => {
    expect(recoveryScript).toMatch(
      /\{\s*schema:\s*'public',\s*table:\s*'operation_policies',\s*updateOnConflict:\s*true\s*\}/,
    );
    expect(recoveryScript).toContain(
      "{ schema: 'public', table: 'operation_policy_histories' }",
    );
    expect(recoveryScript).not.toContain(
      'where: "id in (\'POL-001\', \'POL-002\')"',
    );
    expect(recoveryScript).not.toContain(
      'where: "policy_id in (\'POL-001\', \'POL-002\')"',
    );
  });
});
