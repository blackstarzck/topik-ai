import { useCallback, useEffect, useRef, useState } from 'react';

import type { SafeResult } from '../api/safe-request';
import type { AsyncState } from './async-state';

/**
 * safe facade(fetch*Safe) 호출의 수명주기를 표준화하는 훅.
 *
 * 기존 42개 컴포넌트에 수기 배선돼 있던 fetch effect(AbortController 생성 →
 * pending 전환 → abort 가드 → 성공/실패 반영 → cleanup abort)를 단일 정의로
 * 통합한다(Phase 3b 파일럿 — gap-register §3.13). 기존 배선과 동일한 계약:
 *
 * - 초기 status 는 'pending' 이다. 기존 페이지들이 첫 프레임부터 스피너를
 *   그리므로 'idle' 프레임을 만들지 않는다.
 * - 실패 시 직전 data 를 보존한다(마지막 성공 상태 fallback — AGENTS §4).
 * - abort 된 응답은 무시한다(언마운트/재조회 race 차단).
 * - 빈 결과는 'empty' 로 매핑한다(기본: 배열 길이 0. isEmpty 로 재정의 가능).
 *
 * fetcher 는 반드시 useCallback 으로 감싸 전달한다 — 의존성이 바뀔 때만
 * 재조회되며, react-hooks/exhaustive-deps 가 호출부에서 의존성을 검증한다.
 */
export type UseAsyncResourceOptions<T> = {
  initialData: T;
  /** 빈 결과 판정. 기본값은 배열이면 length === 0. */
  isEmpty?: (data: T) => boolean;
};

export type UseAsyncResourceResult<T> = {
  state: AsyncState<T>;
  /** 같은 fetcher 로 재조회한다(진행 중 요청은 abort). */
  reload: () => void;
};

function isEmptyByDefault(data: unknown): boolean {
  return Array.isArray(data) && data.length === 0;
}

export function useAsyncResource<T>(
  fetcher: (signal: AbortSignal) => Promise<SafeResult<T>>,
  options: UseAsyncResourceOptions<T>
): UseAsyncResourceResult<T> {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'pending',
    data: options.initialData,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);

  // isEmpty 는 최신 참조만 유지한다 — 인라인 함수가 넘어와도 재조회를 유발하지 않는다.
  const isEmptyRef = useRef(options.isEmpty);
  isEmptyRef.current = options.isEmpty;

  useEffect(() => {
    const controller = new AbortController();

    setState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));
    void fetcher(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        const isEmpty = isEmptyRef.current ?? isEmptyByDefault;
        setState({
          status: isEmpty(result.data) ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [fetcher, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  return { state, reload };
}
