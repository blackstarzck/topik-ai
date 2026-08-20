import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

const repairSql = await readFile(
  new URL(
    '../../scripts/db/sql/repair-operation-policy-history-links.sql',
    import.meta.url,
  ),
  'utf8',
);

// 복사 대상 테이블 카탈로그는 2026-08-20 분해로 prod-recovery-catalog.mjs 로 갔다.
// 여기 단정은 "정책 원장과 이력이 통째로 복사 대상에 들어 있다"는 계약이므로 러너와
// 카탈로그를 한 소스로 본다(파일 위치가 아니라 계약이 기준이다).
const recoveryScript = (
  await Promise.all(
    ['recover-prod-from-dev.mjs', 'prod-recovery-catalog.mjs'].map((name) =>
      readFile(new URL(`../../scripts/db/${name}`, import.meta.url), 'utf8'),
    ),
  )
).join('\n');

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
