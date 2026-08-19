import type { Dayjs } from 'dayjs';

import type { MessageGroup, MessageTemplate, MessageTemplateStatus } from './types';

// 채널 공용 템플릿 목록 화면의 순수 스키마 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 폼 인스턴스·조회 상태·발송 핸들러는 페이지가 소유하고, 여기는 상수·타입·표시 헬퍼만 둔다.

export const messageTemplateStatusFilterValues = ['활성', '비활성', '초안'] as const;
export const MESSAGE_SEND_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm';

export type MessageTestSendFormValues = {
  recipient: string;
  reason: string;
};

export type MessageLiveSendFormValues = {
  targetGroupIds: string[];
  actionType: '즉시 발송' | '예약 발송';
  scheduledAt?: Dayjs;
  reason: string;
};

export type MessageTemplateEditorState =
  | { kind: 'create' }
  | { kind: 'edit'; template: MessageTemplate }
  | null;

export type MessageTemplateDangerState =
  | { type: 'delete'; template: MessageTemplate }
  | {
    type: 'toggle';
    template: MessageTemplate;
    nextStatus: Extract<MessageTemplateStatus, '활성' | '비활성'>;
  }
  | null;

export function renderMessageGroupNames(
  groups: MessageGroup[],
  groupIds: string[]
): string {
  const names = groups
    .filter((group) => groupIds.includes(group.id))
    .map((group) => group.name);
  return names.length > 0 ? names.join(', ') : '-';
}
