/**
 * 외부 응답에서 적재 후보(task)를 방어적으로 추출하는 순수 매퍼.
 *
 * 상류 응답에는 배열과 tasks/items/data/results 봉투 형태가 공존하므로 이 매퍼는
 * 안정적인 식별자와 문항 번호만 정규화하고 나머지는 raw로 통째 보존한다(무손실).
 * §7 컬럼 매핑과 검증은 승격 RPC가 담당하며, 이 경계에서는 원문을 파괴적으로
 * 선별하지 않는다.
 *
 * 순수 함수(외부 의존 0) — tests/unit에서 단위 검증.
 */

export type RawTask = Record<string, unknown>;

export type IdStrategy = 'upstream' | 'derived';

export type MappedTask = {
  /** 멱등 기준 키. 상류 id가 있으면 그대로, 없으면 내용 해시로 파생. */
  sourceTaskId: string;
  /** 51/52/53/54 또는 미상(null). 거부하지 않고 null로 보존. */
  itemNumber: number | null;
  /** 응답 task 원본 객체 전체(무손실 보존 대상). */
  raw: RawTask;
  idStrategy: IdStrategy;
  warnings: string[];
};

export type ExtractResult = {
  tasks: MappedTask[];
  warnings: string[];
};

const ENVELOPE_KEYS = ['tasks', 'items', 'data', 'results'] as const;

function isObject(value: unknown): value is RawTask {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 결정적 32bit FNV-1a 해시(파생 id용). 외부 의존 없이 재호출 멱등성 확보. */
function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // 부호 제거 후 8자리 16진수.
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * 문항 번호 파생: item_number(숫자) → task_type/type 문자열의 51~54 패턴 순.
 * "Q54", "task54", "54", 54 모두 54로. 미상이면 null(거부 아님).
 */
export function deriveItemNumber(task: RawTask): number | null {
  const direct = task.item_number;
  if (typeof direct === 'number' && [51, 52, 53, 54].includes(direct)) {
    return direct;
  }

  for (const key of ['task_type', 'type', 'taskType']) {
    const value = task[key];
    if (typeof value === 'string') {
      const match = /(51|52|53|54)/.exec(value);
      if (match) {
        return Number(match[1]);
      }
    }
    if (typeof value === 'number' && [51, 52, 53, 54].includes(value)) {
      return value;
    }
  }

  return null;
}

/** 식별자 파생: 상류 id 후보 → 없으면 내용 해시 기반 파생(idStrategy='derived'). */
function deriveSourceTaskId(
  task: RawTask,
  itemNumber: number | null
): { sourceTaskId: string; idStrategy: IdStrategy; warning: string | null } {
  for (const key of ['source_task_id', 'id', 'task_id', 'taskId', 'question_id', 'questionId']) {
    const value = task[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return { sourceTaskId: value.trim(), idStrategy: 'upstream', warning: null };
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return { sourceTaskId: String(value), idStrategy: 'upstream', warning: null };
    }
  }

  // 상류 id 부재 → 내용 해시로 결정적 파생. 내용이 같으면 같은 id → 재호출 멱등.
  const derived = `derived-${itemNumber ?? 'x'}-${stableHash(JSON.stringify(task))}`;
  return {
    sourceTaskId: derived,
    idStrategy: 'derived',
    warning: `상류 식별자 부재 — 내용 해시로 파생 id 부여(${derived}). 상류 id 확정 시 재적재 필요.`
  };
}

/** 응답 봉투(array | tasks | items | data | results | 단일객체)에서 task 배열을 꺼낸다. */
function unwrapEnvelope(parsed: unknown): { items: unknown[]; warning: string | null } {
  if (Array.isArray(parsed)) {
    return { items: parsed, warning: null };
  }
  if (isObject(parsed)) {
    for (const key of ENVELOPE_KEYS) {
      const value = parsed[key];
      if (Array.isArray(value)) {
        return { items: value, warning: null };
      }
    }
    // 봉투 키가 없으면 응답 자체를 단일 task로 간주.
    return { items: [parsed], warning: '알려진 봉투 키(tasks/items/data/results) 없음 — 응답을 단일 task로 처리.' };
  }
  return { items: [], warning: '응답이 배열도 객체도 아님 — 적재할 task 없음.' };
}

export function extractTasks(parsed: unknown): ExtractResult {
  const warnings: string[] = [];
  const { items, warning: envelopeWarning } = unwrapEnvelope(parsed);
  if (envelopeWarning) {
    warnings.push(envelopeWarning);
  }

  const tasks: MappedTask[] = [];
  items.forEach((item, index) => {
    if (!isObject(item)) {
      warnings.push(`인덱스 ${index}: task가 객체가 아님 — 건너뜀.`);
      return;
    }
    const itemNumber = deriveItemNumber(item);
    const { sourceTaskId, idStrategy, warning } = deriveSourceTaskId(item, itemNumber);
    const taskWarnings: string[] = [];
    if (warning) {
      taskWarnings.push(warning);
    }
    if (itemNumber === null) {
      taskWarnings.push('문항 번호 미상 — item_number=null로 보존(거부하지 않음).');
    }
    tasks.push({ sourceTaskId, itemNumber, raw: item, idStrategy, warnings: taskWarnings });
  });

  return { tasks, warnings };
}
