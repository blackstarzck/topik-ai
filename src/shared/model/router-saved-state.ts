/**
 * 등록/수정 화면 → 목록 화면으로 router state 로 넘기는 "저장 완료" 신호의 키·페이로드 계약.
 *
 * 생산자와 소비자가 **같은 리터럴을 공유**해야 한다. 예전에는 양쪽이 각자 인라인 객체 리터럴로
 * 키를 적었기 때문에 한쪽 오타가 "알림이 안 뜬다"로만 나타나고 typecheck·lint·게이트가 전부
 * 침묵했다. 이 맵을 단일 출처로 두면 오타가 컴파일 오류가 된다.
 *
 * 소비는 `useRouterStateNotice`, 생산은 `routerSavedState` 로만 한다.
 */
export type RouterSavedStateMap = {
  operationNoticeSaved: {
    noticeId: string;
    mode: 'create' | 'edit';
  };
  operationPolicySaved: {
    policyId: string;
    mode: 'create' | 'edit' | 'version';
  };
  operationEventSaved: {
    eventId: string;
    mode: 'create' | 'edit';
    action: 'save' | 'schedule';
  };
  messageTemplateContentSaved: {
    templateId: string;
    mode: 'auto' | 'manual';
  };
  commerceCouponSaved: {
    couponId: string;
    mode: 'create' | 'edit';
  };
  commerceCouponTemplateSaved: {
    templateId: string;
    mode: 'create' | 'edit';
  };
  /** 기관 코드 생성 페이지 → 상세 페이지. 생성 화면은 즉시 이동해 자기 알림을 띄울 수 없다. */
  institutionCodeCreated: {
    code: string;
    label: string;
  };
};

export type RouterSavedStateKey = keyof RouterSavedStateMap;

/** `navigate(..., { state: routerSavedState('operationNoticeSaved', { ... }) })` 형태로 쓴다. */
export function routerSavedState<K extends RouterSavedStateKey>(
  key: K,
  value: RouterSavedStateMap[K]
): Record<K, RouterSavedStateMap[K]> {
  return { [key]: value } as Record<K, RouterSavedStateMap[K]>;
}
