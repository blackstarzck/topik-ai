import type { AsyncStatus } from '@/shared/model/async-state';

/**
 * 기관 코드 화면의 **부가 조회** 결과 해석.
 *
 * 목록·상세는 주 조회(코드 메타) 외에 원장 조회를 여러 개 함께 돈다 — 노출 모드, 계약 요약,
 * 운영 설정, 노출 옵션. 이들은 주 조회와 독립적으로 실패할 수 있고, 실패해도 목록·상세
 * 자체는 계속 쓸 수 있어야 한다(fail-open).
 *
 * 🚨 문제는 이전 배선이 **실패를 "원장에 행이 없음"과 같게 취급**했다는 점이다
 * (`result.ok ? result.data : []`). 그래서 조회가 실패하면
 * - 노출 모드 컬럼이 전 코드에 대해 도메인 기본값 `배정분만` 을 보여주고(실제로는
 *   `제한 없음` 일 수 있다 — 운영자가 제한된 기관이라고 오해한다),
 * - 계약 컬럼이 `-` 를 보여준다(도메인에서 `-` 는 "계약 없음"이라는 **유효한 상태**다).
 *
 * 두 경우 모두 화면이 **틀린 값을 정상처럼** 보여준다. 그래서 네 갈래를 구분한다 —
 * `failed` 와 `missing` 은 절대 섞지 않는다(gap-register §3.13 ⑤).
 */
export type SideFetchOutcome<T> =
  | { kind: 'pending' }
  /** 조회 자체가 실패했다 — 값을 모른다. 도메인 기본값으로 해석하면 안 된다. */
  | { kind: 'failed' }
  /** 조회는 성공했고 원장에 이 코드의 행이 없다 — 도메인 기본값이 맞는 해석이다. */
  | { kind: 'missing' }
  | { kind: 'loaded'; row: T };

export function resolveSideFetchOutcome<T>(
  status: AsyncStatus,
  row: T | null | undefined
): SideFetchOutcome<T> {
  if (status === 'error') {
    return { kind: 'failed' };
  }
  if (status === 'pending' || status === 'idle') {
    return { kind: 'pending' };
  }
  // 'success' | 'empty' — 조회는 됐다. 행이 없으면 도메인 기본값으로 해석한다.
  return row == null ? { kind: 'missing' } : { kind: 'loaded', row };
}

/**
 * 이 부가 조회에 **의존하는 조작**을 허용할지.
 *
 * 값을 모르는 상태(`pending`·`failed`)에서 쓰기를 허용하면 운영자가 잘못된 전제로 조작한다
 * (예: 계약 만료 여부를 모르는데 회원을 배정). 값을 아는 두 경우에만 허용한다.
 */
export function isSideFetchActionable(outcome: SideFetchOutcome<unknown>): boolean {
  return outcome.kind === 'loaded' || outcome.kind === 'missing';
}

/** 부가 조회가 실패했는지(안내·재시도 노출 판정). */
export function isSideFetchFailed(outcome: SideFetchOutcome<unknown>): boolean {
  return outcome.kind === 'failed';
}

/** 실패한 셀에 쓰는 문구. 숫자·기본값으로 표현하지 않는다. */
export const SIDE_FETCH_FAILED_LABEL = '조회 실패';
/** 아직 조회 중인 셀에 쓰는 문구. */
export const SIDE_FETCH_PENDING_LABEL = '…';
