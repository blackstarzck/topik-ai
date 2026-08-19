import { useCallback, useEffect, useRef, useState } from 'react';

import type { AppApiError } from '../api/api-error';
import type { SafeResult } from '../api/safe-request';
import type { AsyncState } from './async-state';

/**
 * safe facade(fetch*Safe) 호출의 수명주기를 표준화하는 훅.
 *
 * 수기 배선돼 있던 fetch effect(AbortController 생성 → pending 전환 → abort 가드 →
 * 성공/실패 반영 → cleanup abort)를 단일 정의로 통합한다(Phase 3b — gap-register
 * §3.13). 기본 계약:
 *
 * - 초기 status 는 'pending' 이다. 기존 페이지들이 첫 프레임부터 스피너를
 *   그리므로 'idle' 프레임을 만들지 않는다.
 * - 실패 시 직전 data 를 보존한다(마지막 성공 상태 fallback — AGENTS §4).
 *   `keepDataOnError: false` 면 initialData 로 되돌린다(권한 회수·상세 이탈 계열).
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
  /**
   * false 면 조회하지 않는다(권한 미보유·필수 파라미터 부재). 비활성 동안 state 는
   * 그대로 유지된다 — 기존 `if (!canRead) return;` 조기 반환과 동일. 기본 true.
   */
  enabled?: boolean;
  /** false 면 실패 시 data 를 initialData 로 되돌린다. 기본 true(직전 데이터 보존). */
  keepDataOnError?: boolean;
  /**
   * false 면 재조회 때 status 를 pending 으로 바꾸지 않는다(직전 화면 유지형 재시도).
   * 최초 조회는 초기 status 가 이미 pending 이라 영향 없다. 기본 true.
   */
  pendingOnRefetch?: boolean;
  /**
   * 에러 표시문 매핑(번역 등). clearData 를 true 로 돌려주면 그 에러에 한해
   * 데이터도 initialData 로 소거한다(예: 권한 회수 즉시 화면에서 수치 제거).
   */
  mapError?: (error: AppApiError) => { message: string; clearData?: boolean };
};

export type UseAsyncResourceResult<T> = {
  state: AsyncState<T>;
  /** 같은 fetcher 로 재조회한다(진행 중 요청은 abort). */
  reload: () => void;
  /**
   * 조치 성공 후 서버 재조회 없이 목록을 로컬 갱신한다. 기존 페이지들의 조치 후
   * setState 와 동일하게 empty/success 를 재판정하고 에러 표시를 지운다.
   */
  mutate: (updater: (data: T) => T) => void;
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
  const enabled = options.enabled ?? true;

  // 콜백/정책 옵션은 최신 참조만 유지한다 — 인라인 전달이 재조회를 유발하지 않는다.
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();

    if (optionsRef.current.pendingOnRefetch ?? true) {
      setState((prev) => ({
        ...prev,
        status: 'pending',
        errorMessage: null,
        errorCode: null
      }));
    }
    void fetcher(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      const current = optionsRef.current;

      if (result.ok) {
        const isEmpty = current.isEmpty ?? isEmptyByDefault;
        setState({
          status: isEmpty(result.data) ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      const mapped = current.mapError?.(result.error);
      const clearData = mapped?.clearData ?? (current.keepDataOnError ?? true) === false;
      setState((prev) => ({
        status: 'error',
        data: clearData ? current.initialData : prev.data,
        errorMessage: mapped?.message ?? result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [enabled, fetcher, reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const mutate = useCallback((updater: (data: T) => T) => {
    setState((prev) => {
      const next = updater(prev.data);
      const isEmpty = optionsRef.current.isEmpty ?? isEmptyByDefault;
      return {
        status: isEmpty(next) ? 'empty' : 'success',
        data: next,
        errorMessage: null,
        errorCode: null
      };
    });
  }, []);

  return { state, reload, mutate };
}
