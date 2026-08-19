import {
  operationEventTypeValues,
  operationEventVisibilityStatusValues,
  type OperationEvent
} from './types';

// 이벤트 목록 페이지의 URL 파서·조치 카피 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).

export const eventSortableFieldValues = [
  'id',
  'title',
  'eventType',
  'startAt',
  'visibilityStatus',
  'updatedAt'
] as const;

export type EventSortField = (typeof eventSortableFieldValues)[number];

export type EventActionState =
  | { type: 'schedule'; event: OperationEvent }
  | { type: 'publish'; event: OperationEvent }
  | { type: 'end'; event: OperationEvent }
  | null;

export function parseEventType(value: string | null): OperationEvent['eventType'] | null {
  return operationEventTypeValues.includes(value as OperationEvent['eventType'])
    ? (value as OperationEvent['eventType'])
    : null;
}

export function parseVisibilityStatus(
  value: string | null
): OperationEvent['visibilityStatus'] | null {
  return operationEventVisibilityStatusValues.includes(
    value as OperationEvent['visibilityStatus']
  )
    ? (value as OperationEvent['visibilityStatus'])
    : null;
}

export function parseEventSortField(value: string | null): EventSortField | null {
  return eventSortableFieldValues.includes(value as EventSortField)
    ? (value as EventSortField)
    : null;
}

export function matchesEventPeriod(
  event: OperationEvent,
  startDate: string,
  endDate: string
): boolean {
  if (startDate && event.endAt < startDate) {
    return false;
  }

  if (endDate && event.startAt > endDate) {
    return false;
  }

  return true;
}

export function getEventActionCopy(type: NonNullable<EventActionState>['type']) {
  if (type === 'schedule') {
    return {
      title: '이벤트 게시 예약',
      description: '이벤트 노출을 예약 상태로 변경합니다. 예약 사유를 입력하세요.',
      confirmText: '게시 예약 실행',
      successMessage: '이벤트 게시 예약 완료'
    };
  }

  if (type === 'publish') {
    return {
      title: '이벤트 즉시 게시',
      description: '이벤트를 즉시 노출 상태로 전환합니다. 게시 사유를 입력하세요.',
      confirmText: '즉시 게시 실행',
      successMessage: '이벤트 즉시 게시 완료'
    };
  }

  return {
    title: '이벤트 종료',
    description: '이벤트를 종료하고 노출을 중단합니다. 종료 사유를 입력하세요.',
    confirmText: '이벤트 종료 실행',
    successMessage: '이벤트 종료 완료'
  };
}
