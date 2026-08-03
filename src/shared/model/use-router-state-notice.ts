import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

import type { RouterSavedStateKey, RouterSavedStateMap } from './router-saved-state';

/**
 * 등록/수정 화면이 `routerSavedState()` 로 넘긴 "저장 완료" 신호를 목록 화면에서
 * **정확히 한 번** 소비한다(성공 알림 + 감사 로그 링크 렌더용).
 *
 * 소비 기록 ref 와 소비 즉시 초기화가 **둘 다** 있어야 한 번만 뜬다. 하나라도 빠지면 서로 다른
 * 환경에서 깨지며, 실제로 두 갈래 구현이 각각 절반씩만 갖고 있었다(2026-08-03 실측):
 * - ref 만 있고 초기화를 안 하면: history 엔트리에 state 가 남아, 다른 화면에 갔다 돌아올 때
 *   컴포넌트가 리마운트되며 ref 가 리셋되어 **오래된 알림이 다시 뜬다**(프로덕션에서도 재현).
 *   `navigate` 없이 로컬 state 로 조건부 마운트하는 화면(메시지 메일의 Segmented 토글)에서는
 *   토글마다 반복된다.
 * - 초기화만 하고 ref 가 없으면: StrictMode 가 마운트 시 effect 를 두 번 실행하고, 두 번째
 *   실행은 초기화 반영 전의 `location.state` 를 다시 읽어 **dev 에서 알림이 2개** 뜬다.
 *
 * 초기화는 `navigate` 가 아니라 `history.replaceState` 로 **이 키만** 지운다. `navigate` 로
 * 지우면 세 가지가 조용히 깨진다: ①`state: null` 이 다른 키까지 날린다(지연 마운트 서브트리가
 * 소비할 알림이 영구 소실), ②소비 시점에 캡처한 `search` 를 되쓰므로 같은 커밋에서 쿼리를
 * 정규화하는 effect 보다 훅이 아래에 선언되면 그 정규화를 되돌린다, ③`hash` 가 사라진다.
 *
 * `identify` 는 같은 도착을 식별하는 키다. 값이 다르면(다른 대상·다른 모드) 다시 알린다.
 * state 키가 여러 개인 화면은 키마다 이 훅을 한 번씩 호출한다.
 */
export function useRouterStateNotice<K extends RouterSavedStateKey>(
  stateKey: K,
  identify: (value: RouterSavedStateMap[K]) => string,
  onConsume: (value: RouterSavedStateMap[K]) => void
): void {
  const location = useLocation();
  const consumedIdentityRef = useRef<string | null>(null);
  const identifyRef = useRef(identify);
  const onConsumeRef = useRef(onConsume);

  // 최신 클로저를 ref 로 들고 있어 콜백 identity 가 매 렌더 바뀌어도 소비 effect 가
  // 재실행되지 않는다(호출부에 useCallback 을 강제하지 않기 위함).
  useEffect(() => {
    identifyRef.current = identify;
    onConsumeRef.current = onConsume;
  });

  useEffect(() => {
    const state = location.state as Partial<RouterSavedStateMap> | null;
    const value = state?.[stateKey];
    if (!value) {
      return;
    }

    const identity = identifyRef.current(value);
    if (consumedIdentityRef.current === identity) {
      return;
    }
    consumedIdentityRef.current = identity;

    onConsumeRef.current(value);

    // history 엔트리에서 이 키만 제거한다. 남은 키가 없으면 usr 자체를 비운다.
    // react-router 의 `key`/`idx` 부기는 보존해야 하므로 엔트리를 펼쳐 usr 만 교체한다.
    const remaining = { ...state } as Record<string, unknown>;
    delete remaining[stateKey];
    const historyEntry = window.history.state as Record<string, unknown> | null;
    window.history.replaceState(
      {
        ...historyEntry,
        usr: Object.keys(remaining).length > 0 ? remaining : null
      },
      ''
    );
  }, [location.state, stateKey]);
}
