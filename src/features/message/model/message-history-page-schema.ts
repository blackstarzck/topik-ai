import type {
  MessageChannel,
  MessageHistory,
  MessageRecipientStatus,
  MessageTemplateMode
} from '../model/types';
import type { NotificationAttemptStatus } from '../api/notification-supabase-adapter';

// 발송 이력 화면(mock·supabase 두 변형 공용)의 순수 스키마 — Phase 4 분해로 이동(동작 동일).
// 조회 상태·Drawer·확인 모달은 각 변형 페이지가 소유하고, 여기는 상수·타입·표시 헬퍼만 둔다.

export const messageHistoryStatusFilterValues = ['완료', '부분 실패', '실패', '예약'] as const;
export type MessageHistoryModeFilter = MessageTemplateMode | 'all';
export type MessageRecipientStatusFilter = MessageRecipientStatus | 'all';

export type MessageHistoryDangerState =
  | { type: 'retry'; history: MessageHistory }
  | null;

export function parseMessageHistoryChannel(value: string | null): MessageChannel {
  return value === 'push' ? 'push' : 'mail';
}

export function parseMessageHistoryMode(value: string | null): MessageHistoryModeFilter {
  if (value === 'auto' || value === 'manual') {
    return value;
  }
  return 'all';
}

export function getMessageHistoryModeLabel(mode: MessageTemplateMode): string {
  return mode === 'auto' ? '자동' : '수동';
}

export function getMessageRecipientStatusColor(status: MessageRecipientStatus): string {
  switch (status) {
    case '성공':
      return 'success';
    case '실패':
      return 'error';
    default:
      return 'default';
  }
}

export function downloadMessageHistoryCsv(filename: string, content: string): void {
  const blob = new Blob([`\uFEFF${content}`], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export const notificationAttemptStatusOrder: NotificationAttemptStatus[] = [
  'sent',
  'failed',
  'skipped',
  'opted_out',
  'pending',
  'deduped'
];

export function getNotificationAttemptStatusColor(status: NotificationAttemptStatus): string {
  switch (status) {
    case 'sent':
      return 'success';
    case 'failed':
      return 'error';
    case 'pending':
      return 'gold';
    default:
      return 'default';
  }
}
