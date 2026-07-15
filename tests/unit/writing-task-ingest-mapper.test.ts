import { describe, expect, it } from 'vitest';

import {
  deriveItemNumber,
  extractTasks
} from '../../src/features/assessment/server/writing-task-ingest-mapper';

/**
 * 외부 응답 형태가 미확정·가변(스웨거 자체 모순)이라 매퍼는 형태를 단정하지 않는다.
 * 봉투 다양성·식별자 부재·문항번호 미상·여분 키 보존을 단위로 검증한다.
 */

describe('deriveItemNumber', () => {
  it('item_number 숫자를 그대로 인식한다', () => {
    expect(deriveItemNumber({ item_number: 53 })).toBe(53);
  });

  it('task_type 문자열("Q54"/"task54")에서 번호를 파싱한다', () => {
    expect(deriveItemNumber({ task_type: 'Q54' })).toBe(54);
    expect(deriveItemNumber({ task_type: 'task51' })).toBe(51);
  });

  it('알 수 없으면 null(거부 아님)', () => {
    expect(deriveItemNumber({ topic: '환경' })).toBeNull();
    expect(deriveItemNumber({ item_number: 99 })).toBeNull();
  });
});

describe('extractTasks — 봉투 다양성', () => {
  it('배열 루트를 그대로 처리한다', () => {
    const result = extractTasks([{ id: 'task_1', task_type: 'Q53' }]);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].sourceTaskId).toBe('task_1');
    expect(result.tasks[0].itemNumber).toBe(53);
    expect(result.tasks[0].idStrategy).toBe('upstream');
  });

  it('{tasks} 봉투를 푼다', () => {
    const result = extractTasks({ tasks: [{ id: 'task_a' }], total: 1 });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].sourceTaskId).toBe('task_a');
  });

  it('{items} 봉투를 푼다', () => {
    const result = extractTasks({ items: [{ task_id: 'task_b' }], total: 1 });
    expect(result.tasks[0].sourceTaskId).toBe('task_b');
  });

  it('{data} 봉투를 푼다', () => {
    const result = extractTasks({ data: [{ question_id: 'task_c' }] });
    expect(result.tasks[0].sourceTaskId).toBe('task_c');
  });

  it('봉투 키가 없으면 응답 자체를 단일 task로 보고 경고를 남긴다', () => {
    const result = extractTasks({ id: 'solo', task_type: 'Q51' });
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].sourceTaskId).toBe('solo');
    expect(result.warnings.some((w) => w.includes('단일 task'))).toBe(true);
  });

  it('배열도 객체도 아니면 빈 결과 + 경고', () => {
    const result = extractTasks('nonsense');
    expect(result.tasks).toHaveLength(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('extractTasks — 결손 응답 방어', () => {
  it('식별자 부재 시 내용 해시로 파생 id를 부여하고 경고한다(결정적·멱등)', () => {
    const task = { task_type: 'Q53', topic: '환경' };
    const first = extractTasks([task]).tasks[0];
    const second = extractTasks([task]).tasks[0];
    expect(first.idStrategy).toBe('derived');
    expect(first.sourceTaskId).toMatch(/^derived-53-/);
    // 같은 내용 → 같은 파생 id(재호출 멱등).
    expect(first.sourceTaskId).toBe(second.sourceTaskId);
    expect(first.warnings.some((w) => w.includes('파생'))).toBe(true);
  });

  it('문항 번호 미상 task는 거부하지 않고 itemNumber=null로 보존한다', () => {
    const result = extractTasks([{ id: 'task_x', topic: '교육' }]);
    expect(result.tasks[0].itemNumber).toBeNull();
    expect(result.tasks[0].warnings.some((w) => w.includes('문항 번호 미상'))).toBe(true);
  });

  it('여분/미지의 키도 raw에 통째 보존한다(무손실)', () => {
    const raw = { id: 'task_y', task_type: 'Q54', unknown_future_field: { a: 1 }, extra: [1, 2] };
    const result = extractTasks([raw]);
    expect(result.tasks[0].raw).toEqual(raw);
  });

  it('객체가 아닌 항목은 건너뛰고 경고한다', () => {
    const result = extractTasks([{ id: 'ok' }, 42, null]);
    expect(result.tasks).toHaveLength(1);
    expect(result.warnings.some((w) => w.includes('건너뜀'))).toBe(true);
  });
});
