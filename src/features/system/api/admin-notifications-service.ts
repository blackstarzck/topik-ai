import type { AdminNotification } from '../model/admin-notification-types';
import { isSupabaseConfigured } from '@/shared/api/supabase-client';
import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import { requireClient } from '@/shared/api/supabase-service-utils';

/**
 * 관리자 인앱 알림 서비스. RPC 4종(`20260805110000`)과 1:1 이다.
 *
 * Supabase 미구성(mock/e2e) 경로는 **빈 알림함**을 돌려준다. 가짜 알림을 시드하지 않는
 * 이유: 알림은 서버 tick 이 계약 만료를 판정해 적재하는 것이고, mock 에 임의 알림을 넣으면
 * "왜 이 알림이 왔는가"가 화면만 보고는 설명되지 않는 상태가 된다. 벨의 빈 상태와 배지
 * 미표시는 mock 에서도 그대로 검증할 수 있다.
 */

type NotificationRow = {
  id: string;
  category: string | null;
  title: string | null;
  body: string | null;
  link_url: string | null;
  read_at: string | null;
  created_at: string | null;
};

function mapRow(row: NotificationRow): AdminNotification {
  return {
    id: row.id,
    category: row.category ?? '',
    title: row.title ?? '',
    body: row.body ?? '',
    linkUrl: row.link_url ?? '',
    readAt: row.read_at ?? '',
    createdAt: row.created_at ?? ''
  };
}

export function fetchAdminNotificationsSafe(
  options: { limit?: number; unreadOnly?: boolean } = {},
  signal?: AbortSignal
) {
  return toSafeResult<AdminNotification[]>(() =>
    withRetry(
      async () => {
        if (!isSupabaseConfigured) {
          return [];
        }
        const client = requireClient();
        const { data, error } = await client.rpc('admin_list_my_notifications', {
          p_limit: options.limit ?? 20,
          p_unread_only: options.unreadOnly ?? false
        });
        if (error) {
          throw new Error(error.message);
        }
        if (signal?.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        return ((data as NotificationRow[] | null) ?? []).map(mapRow);
      },
      { maxRetries: 1 }
    )
  );
}

export function fetchAdminUnreadCountSafe(signal?: AbortSignal) {
  return toSafeResult<number>(() =>
    withRetry(
      async () => {
        if (!isSupabaseConfigured) {
          return 0;
        }
        const client = requireClient();
        const { data, error } = await client.rpc('admin_count_my_unread_notifications');
        if (error) {
          throw new Error(error.message);
        }
        if (signal?.aborted) {
          throw new DOMException('Request aborted', 'AbortError');
        }
        return typeof data === 'number' ? data : Number(data ?? 0);
      },
      { maxRetries: 1 }
    )
  );
}

export function markAdminNotificationReadSafe(id: string) {
  return toSafeResult<number>(async () => {
    if (!isSupabaseConfigured) {
      return 0;
    }
    const client = requireClient();
    const { data, error } = await client.rpc('admin_mark_notification_read', { p_id: id });
    if (error) {
      throw new Error(error.message);
    }
    return typeof data === 'number' ? data : Number(data ?? 0);
  });
}

export function markAllAdminNotificationsReadSafe() {
  return toSafeResult<number>(async () => {
    if (!isSupabaseConfigured) {
      return 0;
    }
    const client = requireClient();
    const { data, error } = await client.rpc('admin_mark_all_notifications_read');
    if (error) {
      throw new Error(error.message);
    }
    return typeof data === 'number' ? data : Number(data ?? 0);
  });
}
