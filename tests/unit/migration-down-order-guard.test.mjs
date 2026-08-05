import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cwd } from 'node:process';
import { describe, expect, it } from 'vitest';

import { findLaterAppliedMigrations } from '../../scripts/db/migrate-core.mjs';

/**
 * 비-LIFO down 가드. 이 저장소의 여러 마이그레이션은 라이브 함수 본문을 읽어 한 블록만
 * 치환하는 방식(pg_get_functiondef 수술)이고, 그 down 은 자기 forward 가 만든 상태를
 * 전제한다. 나중 마이그를 남겨둔 채 앞선 마이그를 되돌리면 fail-closed 되거나 — 더 나쁘게 —
 * down 이 의도하지 않은 본문에 적용된다. 러너가 순서를 강제하지 않으면 사람이 기억해야 한다.
 */
describe('down 순서 가드', () => {
  const applied = [
    '20260805110000_admin_contract_expiry_notifications.sql',
    '20260805130000_admin_analytics_read_permission.sql',
    '20260805150000_admin_read_permission_alignment.sql'
  ];

  it('되돌릴 대상보다 나중에 적용된 마이그를 찾아낸다', () => {
    expect(
      findLaterAppliedMigrations({
        migrationName: '20260805110000_admin_contract_expiry_notifications.sql',
        appliedNames: applied
      })
    ).toEqual([
      '20260805130000_admin_analytics_read_permission.sql',
      '20260805150000_admin_read_permission_alignment.sql'
    ]);
  });

  it('가장 최신 마이그를 되돌릴 때는 아무것도 걸리지 않는다(LIFO)', () => {
    expect(
      findLaterAppliedMigrations({
        migrationName: '20260805150000_admin_read_permission_alignment.sql',
        appliedNames: applied
      })
    ).toEqual([]);
  });

  it('타임스탬프 문자열 비교라 같은 이름은 later 로 세지 않는다', () => {
    expect(
      findLaterAppliedMigrations({
        migrationName: '20260805130000_admin_analytics_read_permission.sql',
        appliedNames: ['20260805130000_admin_analytics_read_permission.sql']
      })
    ).toEqual([]);
  });

  it('러너가 이 검사를 실제로 배선하고 override 를 명시 플래그로만 허용한다', () => {
    // 함수만 있고 호출되지 않으면 가드가 아니다(게이트 통과 ≠ 검사가 돌았다).
    const source = readFileSync(join(cwd(), 'scripts', 'db', 'migrate-core.mjs'), 'utf8');
    expect(source).toContain('findLaterAppliedMigrations({ migrationName, appliedNames })');
    expect(source).toContain('allowOutOfOrderDown');
    expect(source).toContain("args.includes('--allow-out-of-order-down')");
    expect(source).toContain('Refusing to roll back');
    // down 액션이 tracker 를 읽어 넘기지 않으면 appliedNames 가 항상 비어 가드가 죽는다.
    expect(source).toContain('appliedNames: appliedRows.map((row) => row.name)');
  });
});
