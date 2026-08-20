import {
  Alert,
  Button,
  Descriptions,
  Space,
  Tag,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  cancelNotificationDispatchSafe,
  fetchNotificationDispatchAttemptsSafe,
  fetchNotificationDispatchesSafe
} from '../api/messages-service';
import {
  notificationAttemptStatusLabels,
  notificationDbChannelLabels,
  notificationDispatchStatusLabels,
  notificationDispatchTargetTypeLabels,
  type NotificationAttemptStatus,
  type NotificationDeliveryAttemptItem,
  type NotificationDispatchListItem
} from '../api/notification-supabase-adapter';
import {
  getNotificationAttemptStatusColor,
  notificationAttemptStatusOrder
} from '../model/message-history-page-schema';
import type { AsyncState } from '@/shared/model/async-state';
import { getTargetTypeLabel } from '@/shared/model/target-type-label';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '@/shared/ui/detail-drawer/detail-drawer';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import {
  createDrawerTableScroll,
  fixDrawerTableFirstColumn
} from '@/shared/ui/table/drawer-table';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// supabase 모드 — notification_dispatches(실행 ledger) + delivery_attempts 집계.
// 전달(집행)은 DB 파이프라인(10분 cron) 몫이라 재시도 액션은 제공하지 않고
// 새로고침으로 상태 전이를 반영한다 (WP2-3).
// ---------------------------------------------------------------------------

export function NotificationDispatchHistoryPage(): JSX.Element {
  const [dispatches, setDispatches] = useState<NotificationDispatchListItem[]>([]);
  const [loadState, setLoadState] = useState<AsyncState<null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [detailDispatch, setDetailDispatch] =
    useState<NotificationDispatchListItem | null>(null);
  const [cancelTarget, setCancelTarget] =
    useState<NotificationDispatchListItem | null>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [attempts, setAttempts] = useState<NotificationDeliveryAttemptItem[]>([]);
  const [attemptsState, setAttemptsState] = useState<AsyncState<null>>({
    status: 'empty',
    data: null,
    errorMessage: null,
    errorCode: null
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({
      status: 'pending',
      data: null,
      errorMessage: null,
      errorCode: null
    });

    void fetchNotificationDispatchesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setDispatches(result.data);
        setLoadState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: null,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setLoadState({
        status: 'error',
        data: null,
        errorMessage: result.error.message,
        errorCode: result.error.code
      });
    });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  const detailDispatchId = detailDispatch?.id ?? null;

  useEffect(() => {
    if (!detailDispatchId) {
      setAttempts([]);
      return;
    }

    const controller = new AbortController();
    setAttemptsState({
      status: 'pending',
      data: null,
      errorMessage: null,
      errorCode: null
    });

    void fetchNotificationDispatchAttemptsSafe(detailDispatchId, controller.signal).then(
      (result) => {
        if (controller.signal.aborted) {
          return;
        }

        if (result.ok) {
          setAttempts(result.data);
          setAttemptsState({
            status: result.data.length === 0 ? 'empty' : 'success',
            data: null,
            errorMessage: null,
            errorCode: null
          });
          return;
        }

        setAttemptsState({
          status: 'error',
          data: null,
          errorMessage: result.error.message,
          errorCode: result.error.code
        });
      }
    );

    return () => {
      controller.abort();
    };
  }, [detailDispatchId, reloadKey]);

  const attemptStatusCounts = useMemo(() => {
    const counts: Record<NotificationAttemptStatus, number> = {
      pending: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      opted_out: 0,
      deduped: 0
    };
    attempts.forEach((attempt) => {
      counts[attempt.status] += 1;
    });
    return counts;
  }, [attempts]);

  const handleRetryLoad = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleCancelConfirm = useCallback(
    async (reason: string) => {
      if (!cancelTarget) {
        return;
      }

      const result = await cancelNotificationDispatchSafe(cancelTarget.id, reason);
      if (!result.ok) {
        notificationApi.error({
          message: '예약 발송 취소 실패',
          description: result.error.message
        });
        return;
      }

      notificationApi.success({
        message: '예약 발송 취소 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Notification')}</Text>
            <Text>대상 ID: {cancelTarget.id}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="Notification" targetId={cancelTarget.id} />
          </Space>
        )
      });
      setCancelTarget(null);
      setDetailDispatch(null);
      setReloadKey((prev) => prev + 1);
    },
    [cancelTarget, notificationApi]
  );

  const columns = useMemo<TableColumnsType<NotificationDispatchListItem>>(
    () => [
      {
        title: '실행 시각',
        dataIndex: 'createdAt',
        width: 150,
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: '템플릿 키',
        dataIndex: 'templateKey',
        width: 160,
        sorter: createTextSorter((record) => record.templateKey)
      },
      {
        title: '채널',
        dataIndex: 'channels',
        width: 110,
        render: (channels: string[]) =>
          channels
            .map((channel) => notificationDbChannelLabels[channel] ?? channel)
            .join(', ') || '-'
      },
      {
        title: '발송 유형',
        dataIndex: 'targetType',
        width: 110,
        ...createDefinedColumnFilterProps(
          Object.values(notificationDispatchTargetTypeLabels),
          (record) => notificationDispatchTargetTypeLabels[record.targetType]
        ),
        render: (_: unknown, record: NotificationDispatchListItem) =>
          notificationDispatchTargetTypeLabels[record.targetType]
      },
      {
        title: createStatusColumnTitle(
          '상태',
          Object.values(notificationDispatchStatusLabels)
        ),
        dataIndex: 'status',
        width: 110,
        ...createDefinedColumnFilterProps(
          Object.values(notificationDispatchStatusLabels),
          (record) => notificationDispatchStatusLabels[record.status]
        ),
        sorter: createTextSorter((record) => record.status),
        render: (_: unknown, record: NotificationDispatchListItem) => (
          <StatusBadge status={notificationDispatchStatusLabels[record.status]} />
        )
      },
      {
        title: '대상 수',
        dataIndex: 'recipientCount',
        width: 100,
        sorter: createNumberSorter((record) => record.recipientCount),
        render: (value: number) => `${value.toLocaleString()}명`
      },
      {
        title: '실행자',
        dataIndex: 'actorId',
        width: 160,
        ellipsis: true,
        render: (value: string) => value || '-'
      },
      {
        title: '사유',
        dataIndex: 'reason',
        ellipsis: true,
        render: (value: string) => value || '-'
      },
      {
        title: '관리',
        key: 'actions',
        width: 110,
        fixed: 'right',
        render: (_: unknown, record: NotificationDispatchListItem) =>
          record.status === 'scheduled' ? (
            <Button
              size="small"
              danger
              onClick={(event) => {
                event.stopPropagation();
                setCancelTarget(record);
              }}
            >
              예약 취소
            </Button>
          ) : (
            <Text type="secondary">-</Text>
          )
      }
    ],
    []
  );

  const attemptColumns = useMemo<TableColumnsType<NotificationDeliveryAttemptItem>>(
    () =>
      fixDrawerTableFirstColumn<NotificationDeliveryAttemptItem>([
        {
          title: '사용자 ID',
          dataIndex: 'userId',
          ellipsis: true,
          sorter: createTextSorter((record) => record.userId)
        },
        {
          title: '채널',
          dataIndex: 'channel',
          width: 90,
          render: (value: string) => notificationDbChannelLabels[value] ?? value
        },
        {
          title: createStatusColumnTitle(
            '수신 상태',
            Object.values(notificationAttemptStatusLabels)
          ),
          dataIndex: 'status',
          width: 110,
          sorter: createTextSorter((record) => record.status),
          render: (_: unknown, record: NotificationDeliveryAttemptItem) => (
            <Tag color={getNotificationAttemptStatusColor(record.status)}>
              {notificationAttemptStatusLabels[record.status]}
            </Tag>
          )
        },
        {
          title: '오류 메시지',
          dataIndex: 'errorMessage',
          ellipsis: true,
          render: (value?: string) => value ?? '-'
        },
        {
          title: '발송일',
          dataIndex: 'sentAt',
          width: 150,
          sorter: createTextSorter((record) => record.sentAt ?? ''),
          render: (value?: string) => value ?? '-'
        }
      ]),
    []
  );

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="발송 이력" />

      {loadState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="발송 이력 조회에 실패했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>{loadState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
              <Text type="secondary">오류 코드: {loadState.errorCode ?? '-'}</Text>
              <Button onClick={handleRetryLoad}>다시 시도</Button>
            </Space>
          }
        />
      ) : null}

      <AdminListCard
        toolbar={
          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Text type="secondary">
              발송 실행(dispatch) 기준 이력입니다. 전달은 발송 파이프라인이 주기 처리하므로
              새로고침으로 상태 전이를 확인하세요. 총 {dispatches.length.toLocaleString()}건
            </Text>
            <Button icon={<ReloadOutlined />} onClick={handleRetryLoad}>
              새로고침
            </Button>
          </Space>
        }
      >
        {loadState.status !== 'pending' && dispatches.length === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="발송 이력이 없습니다."
            description="템플릿 발송 실행 또는 나에게 보내기를 수행하면 이력이 생성됩니다."
          />
        ) : null}

        <AdminDataTable<NotificationDispatchListItem>
          rowKey="id"
          columns={columns}
          dataSource={dispatches}
          onRow={(record) => ({
            onClick: () => setDetailDispatch(record),
            style: { cursor: 'pointer' }
          })}
          loading={loadState.status === 'pending'}
          pagination={{
            pageSize: 10,
            showSizeChanger: false
          }}
          scroll={{ x: 1310 }}
        />
      </AdminListCard>

      <DetailDrawer
        open={Boolean(detailDispatch)}
        title={detailDispatch ? `발송 이력 상세 · ${detailDispatch.id}` : '발송 이력 상세'}
        width={760}
        destroyOnHidden
        onClose={() => setDetailDispatch(null)}
        headerMeta={
          detailDispatch ? (
            <StatusBadge
              status={notificationDispatchStatusLabels[detailDispatch.status]}
            />
          ) : null
        }
        footerStart={
          detailDispatch ? (
            <AuditLogLink targetType="Notification" targetId={detailDispatch.id} />
          ) : null
        }
        footerEnd={
          detailDispatch && detailDispatch.status === 'scheduled' ? (
            <Button danger onClick={() => setCancelTarget(detailDispatch)}>
              예약 취소
            </Button>
          ) : null
        }
      >
        {detailDispatch ? (
          <DetailDrawerBody>
            <DetailDrawerSection title="기본 정보">
              <Descriptions
                bordered
                size="small"
                column={2}
                items={[
                  {
                    key: 'templateKey',
                    label: '템플릿 키',
                    children: detailDispatch.templateKey
                  },
                  {
                    key: 'targetType',
                    label: '발송 유형',
                    children:
                      notificationDispatchTargetTypeLabels[detailDispatch.targetType]
                  },
                  {
                    key: 'channels',
                    label: '채널',
                    children:
                      detailDispatch.channels
                        .map((channel) => notificationDbChannelLabels[channel] ?? channel)
                        .join(', ') || '-'
                  },
                  {
                    key: 'recipientCount',
                    label: '대상 수(ledger)',
                    children: `${detailDispatch.recipientCount.toLocaleString()}명`
                  },
                  {
                    key: 'createdAt',
                    label: '실행 시각',
                    children: detailDispatch.createdAt
                  },
                  {
                    key: 'scheduledAt',
                    label: '예약 시각',
                    children: detailDispatch.scheduledAt ?? '-'
                  },
                  {
                    key: 'completedAt',
                    label: '완료 시각',
                    children: detailDispatch.completedAt ?? '-'
                  },
                  {
                    key: 'actor',
                    label: '실행자',
                    children: detailDispatch.actorId || '-'
                  },
                  {
                    key: 'reason',
                    label: '사유/근거',
                    span: 2,
                    children: detailDispatch.reason || '-'
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="전달 결과 집계">
              {attemptsState.status === 'error' ? (
                <Alert
                  type="error"
                  showIcon
                  message="전달 내역 조회에 실패했습니다."
                  description={attemptsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}
                />
              ) : (
                <Descriptions
                  bordered
                  size="small"
                  column={4}
                  items={[
                    {
                      key: 'total',
                      label: '대상 수',
                      span: 4,
                      children: `${attempts.length.toLocaleString()}명 (전달 시도 합계)`
                    },
                    ...notificationAttemptStatusOrder.map((status) => ({
                      key: status,
                      label: notificationAttemptStatusLabels[status],
                      children: attemptStatusCounts[status].toLocaleString()
                    }))
                  ]}
                />
              )}
            </DetailDrawerSection>

            <DetailDrawerSection title="수신자별 전달 내역">
              {attemptsState.status !== 'pending' && attempts.length === 0 ? (
                <Alert
                  type="info"
                  showIcon
                  message="전달 시도가 아직 없습니다."
                  description="발송 파이프라인 처리 전이거나 대상이 없습니다. 새로고침으로 다시 확인하세요."
                />
              ) : null}
              <AdminDataTable<NotificationDeliveryAttemptItem>
                rowKey="id"
                columns={attemptColumns}
                dataSource={attempts}
                loading={attemptsState.status === 'pending'}
                pagination={{
                  position: ['bottomRight'],
                  defaultPageSize: 10,
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50']
                }}
                scroll={createDrawerTableScroll(640)}
                tableLayout="auto"
              />
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>

      {cancelTarget ? (
        <ConfirmAction
          open
          title="예약 발송 취소"
          description="예약된 발송 실행을 취소합니다. 취소 후에는 발송 파이프라인이 이 예약을 집행하지 않습니다(발송 0건). 되돌릴 수 없으니 사유를 남기세요."
          targetType="Notification"
          targetId={cancelTarget.id}
          confirmText="예약 취소 실행"
          onCancel={() => setCancelTarget(null)}
          onConfirm={handleCancelConfirm}
        />
      ) : null}
    </div>
  );
}
