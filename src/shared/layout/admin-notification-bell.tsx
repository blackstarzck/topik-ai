import { BellOutlined } from '@ant-design/icons';
import { Badge, Button, Dropdown, Empty, List, Space, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  fetchAdminNotificationsSafe,
  fetchAdminUnreadCountSafe,
  markAdminNotificationReadSafe,
  markAllAdminNotificationsReadSafe
} from '@/features/system/api/admin-notifications-service';
import type { AdminNotification } from '@/features/system/model/admin-notification-types';
import { resolveAdminNotificationCategoryLabel } from '@/features/system/model/admin-notification-types';

const { Text } = Typography;

/** 목록을 다시 읽는 주기. tick 이 10분이라 그보다 촘촘히 볼 이유가 없다. */
const POLL_INTERVAL_MS = 60_000;

function formatWhen(createdAt: string): string {
  if (!createdAt) {
    return '';
  }
  // 같은 tick 알림은 created_at 이 동일하므로 분 단위까지만 보여준다(초까지 보여줘도
  // 서로 구분되지 않아 정보가 되지 않는다).
  return createdAt.slice(0, 16).replace('T', ' ');
}

/**
 * 관리자 셸 알림 벨 — 계약 만료 임박 알림의 수신 지점이다.
 *
 * 학습자 알림함과 원장이 다르다(`admin_notifications`, 수신자 FK = `admin_accounts`).
 * 목록·미읽음 수는 폴링으로 갱신한다: 적재가 10분 cron tick 이라 실시간 구독을 붙일 이유가
 * 없고, realtime 채널을 관리자 셸에 들이면 세션마다 연결이 하나 늘어난다.
 */
export function AdminNotificationBell(): JSX.Element {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async (signal?: AbortSignal) => {
    const result = await fetchAdminUnreadCountSafe(signal);
    if (result.ok) {
      setUnreadCount(result.data);
    }
    // 실패는 조용히 넘긴다 — 배지가 잠깐 낡는 것이 셸 전체를 깨뜨리는 것보다 낫다.
  }, []);

  const refreshItems = useCallback(async () => {
    setLoading(true);
    const result = await fetchAdminNotificationsSafe({ limit: 20 });
    setLoading(false);
    if (result.ok) {
      setItems(result.data);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refreshCount(controller.signal);
    const timer = window.setInterval(() => {
      void refreshCount();
    }, POLL_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [refreshCount]);

  // 열 때만 목록을 읽는다(닫혀 있는 동안 본문까지 폴링할 이유가 없다).
  useEffect(() => {
    if (open) {
      void refreshItems();
    }
  }, [open, refreshItems]);

  const handleOpenItem = useCallback(
    async (item: AdminNotification) => {
      if (!item.readAt) {
        const result = await markAdminNotificationReadSafe(item.id);
        if (result.ok) {
          void refreshCount();
          setItems((prev) =>
            prev.map((row) =>
              row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row
            )
          );
        }
      }
      if (item.linkUrl) {
        setOpen(false);
        navigate(item.linkUrl);
      }
    },
    [navigate, refreshCount]
  );

  const handleMarkAll = useCallback(async () => {
    const result = await markAllAdminNotificationsReadSafe();
    if (!result.ok) {
      return;
    }
    void refreshCount();
    void refreshItems();
  }, [refreshCount, refreshItems]);

  const panel = (
    <div
      data-testid="admin-notification-panel"
      style={{
        width: 380,
        maxHeight: 460,
        overflowY: 'auto',
        background: '#fff',
        borderRadius: 8,
        boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
        padding: 12
      }}
    >
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text strong>알림</Text>
        <Button
          type="link"
          size="small"
          disabled={unreadCount === 0}
          onClick={() => void handleMarkAll()}
        >
          모두 읽음
        </Button>
      </Space>
      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={loading ? '불러오는 중…' : '알림이 없습니다.'}
        />
      ) : (
        <List<AdminNotification>
          size="small"
          dataSource={items}
          loading={loading}
          renderItem={(item) => (
            <List.Item
              style={{
                cursor: item.linkUrl ? 'pointer' : 'default',
                background: item.readAt ? undefined : '#f6ffed',
                paddingInline: 8,
                borderRadius: 6
              }}
              onClick={() => void handleOpenItem(item)}
            >
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Space size={6} wrap>
                  {!item.readAt ? <Badge color="green" /> : null}
                  <Tag>{resolveAdminNotificationCategoryLabel(item.category)}</Tag>
                  <Text strong style={{ fontSize: 14 }}>
                    {item.title}
                  </Text>
                </Space>
                {item.body ? (
                  <Text type="secondary" style={{ fontSize: 14 }}>
                    {item.body}
                  </Text>
                ) : null}
                <Text type="secondary" style={{ fontSize: 14 }}>
                  {formatWhen(item.createdAt)}
                </Text>
              </Space>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      placement="bottomRight"
      dropdownRender={() => panel}
    >
      <Badge count={unreadCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          icon={<BellOutlined />}
          aria-label={unreadCount > 0 ? `알림 ${unreadCount}건 미읽음` : '알림'}
          data-testid="admin-notification-bell"
          style={{ width: 40, height: 40, fontSize: 18 }}
        />
      </Badge>
    </Dropdown>
  );
}
