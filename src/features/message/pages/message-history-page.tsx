import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Input,
  Space,
  Tabs,
  Tag,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType, TablePaginationConfig } from 'antd';
import {
  DownloadOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { messageDataSource } from '../api/message-data-source';
import {
  cancelNotificationDispatchSafe,
  fetchHistoriesSafe,
  fetchNotificationDispatchAttemptsSafe,
  fetchNotificationDispatchesSafe,
  retryMessageHistorySafe
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
import type {
  MessageChannel,
  MessageHistory,
  MessageHistoryStatus,
  MessageRecipientStatus,
  MessageTemplateMode
} from '../model/types';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '../../../shared/ui/detail-drawer/detail-drawer';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import {
  createDrawerTableScroll,
  fixDrawerTableFirstColumn
} from '../../../shared/ui/table/drawer-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { UserNavigationLink } from '../../../shared/ui/user/user-reference';

const { Text } = Typography;
const messageHistoryStatusFilterValues = ['완료', '부분 실패', '실패', '예약'] as const;
type HistoryModeFilter = MessageTemplateMode | 'all';
type RecipientStatusFilter = MessageRecipientStatus | 'all';

type HistoryDangerState =
  | { type: 'retry'; history: MessageHistory }
  | null;

function parseChannel(value: string | null): MessageChannel {
  return value === 'push' ? 'push' : 'mail';
}

function parseMode(value: string | null): HistoryModeFilter {
  if (value === 'auto' || value === 'manual') {
    return value;
  }
  return 'all';
}

function getModeLabel(mode: MessageTemplateMode): string {
  return mode === 'auto' ? '자동' : '수동';
}

function getRecipientStatusColor(status: MessageRecipientStatus): string {
  switch (status) {
    case '성공':
      return 'success';
    case '실패':
      return 'error';
    default:
      return 'default';
  }
}

function downloadCsvFile(filename: string, content: string): void {
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

function MockMessageHistoryPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeChannel = parseChannel(searchParams.get('channel'));
  const searchField = searchParams.get('searchField') ?? 'all';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const modeFilter = parseMode(searchParams.get('mode'));
  const keyword = searchParams.get('keyword') ?? '';
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

  const [histories, setHistories] = useState<MessageHistory[]>([]);
  const [loadState, setLoadState] = useState<AsyncState<null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [detailRow, setDetailRow] = useState<MessageHistory | null>(null);
  const [recipientKeyword, setRecipientKeyword] = useState('');
  const [recipientStatusFilter, setRecipientStatusFilter] =
    useState<RecipientStatusFilter>('all');
  const [dangerState, setDangerState] = useState<HistoryDangerState>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({
      status: 'pending',
      data: null,
      errorMessage: null,
      errorCode: null
    });

    void fetchHistoriesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setHistories(result.data);
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

  const channelCounts = useMemo(
    () => ({
      mail: histories.filter((history) => history.channel === 'mail').length,
      push: histories.filter((history) => history.channel === 'push').length
    }),
    [histories]
  );

  const activeChannelModeCounts = useMemo(() => {
    const channelHistories = histories.filter((history) => history.channel === activeChannel);

    return {
      all: channelHistories.length,
      auto: channelHistories.filter((history) => history.mode === 'auto').length,
      manual: channelHistories.filter((history) => history.mode === 'manual').length
    };
  }, [activeChannel, histories]);

  const historySummaryCardItems = useMemo(
    () => [
      {
        key: 'all' as const,
        label: '전체 발송',
        value: `${activeChannelModeCounts.all.toLocaleString()}건`
      },
      {
        key: 'auto' as const,
        label: '자동 발송',
        value: `${activeChannelModeCounts.auto.toLocaleString()}건`
      },
      {
        key: 'manual' as const,
        label: '수동 발송',
        value: `${activeChannelModeCounts.manual.toLocaleString()}건`
      }
    ],
    [activeChannelModeCounts]
  );

  const visibleRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return histories.filter((history) => {
      if (history.channel !== activeChannel) {
        return false;
      }
      if (modeFilter !== 'all' && history.mode !== modeFilter) {
        return false;
      }
      if (!matchesSearchDateRange(history.sentAt, startDate, endDate)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        id: history.id,
        templateName: history.templateName,
        groupName: history.groupName
      });
    });
  }, [activeChannel, endDate, histories, keyword, modeFilter, searchField, startDate]);

  const filteredRecipients = useMemo(() => {
    if (!detailRow) {
      return [];
    }

    const normalizedKeyword = recipientKeyword.trim().toLowerCase();
    return detailRow.recipients.filter((recipient) => {
      if (recipientStatusFilter !== 'all' && recipient.status !== recipientStatusFilter) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return (
        recipient.userId.toLowerCase().includes(normalizedKeyword) ||
        recipient.userName.toLowerCase().includes(normalizedKeyword)
      );
    });
  }, [detailRow, recipientKeyword, recipientStatusFilter]);

  const recipientStatusOptions = useMemo(() => {
    if (!detailRow) {
      return [];
    }

    const counts = detailRow.recipients.reduce(
      (acc, recipient) => {
        acc[recipient.status] += 1;
        return acc;
      },
      {
        성공: 0,
        실패: 0,
        예약: 0
      } satisfies Record<MessageRecipientStatus, number>
    );

    return [
      { key: 'all' as const, label: `전체 (${detailRow.recipients.length})` },
      { key: '성공' as const, label: `성공 (${counts['성공']})` },
      { key: '실패' as const, label: `실패 (${counts['실패']})` },
      { key: '예약' as const, label: `예약 (${counts['예약']})` }
    ];
  }, [detailRow]);

  const recipientTablePagination = useMemo<TablePaginationConfig>(
    () => ({
      position: ['bottomRight'],
      defaultPageSize: 10,
      showSizeChanger: true,
      pageSizeOptions: ['10', '20', '50']
    }),
    []
  );

  const commitParams = useCallback(
    (
      next: Partial<
        Record<
          'channel' | 'searchField' | 'startDate' | 'endDate' | 'mode' | 'keyword',
          string
        >
      >
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete('status');

      Object.entries(next).forEach(([key, value]) => {
        if (!value || value === 'all') {
          merged.delete(key);
          return;
        }
        merged.set(key, value);
      });

      if (!merged.get('channel')) {
        merged.set('channel', activeChannel);
      }

      setSearchParams(merged, { replace: true });
    },
    [activeChannel, searchParams, setSearchParams]
  );

  const handleApplyDateRange = useCallback(() => {
    commitParams({
      startDate: draftStartDate,
      endDate: draftEndDate,
      channel: activeChannel,
      mode: modeFilter,
      keyword,
      searchField
    });
  }, [
    activeChannel,
    commitParams,
    draftEndDate,
    draftStartDate,
    keyword,
    modeFilter,
    searchField
  ]);

  const handleModeFilterChange = useCallback(
    (nextMode: HistoryModeFilter) => {
      commitParams({ mode: nextMode, channel: activeChannel, keyword });
    },
    [activeChannel, commitParams, keyword]
  );

  const historySummaryCards = useMemo(
    () =>
      historySummaryCardItems.map((item) => ({
        ...item,
        active: modeFilter === item.key,
        onClick: () => handleModeFilterChange(item.key)
      })),
    [handleModeFilterChange, historySummaryCardItems, modeFilter]
  );

  const handleDangerConfirm = useCallback(
    async (reason: string) => {
      if (!dangerState) {
        return;
      }

      const result = await retryMessageHistorySafe(
        dangerState.history.id,
        'admin_current'
      );
      if (!result.ok || !result.data) {
        if (!result.ok) {
          notificationApi.error({
            message: '\uC7AC\uC2DC\uB3C4 \uBC1C\uC1A1 \uC2E4\uD328',
            description: result.error.message
          });
        }
        return;
      }

      notificationApi.success({
        message: '\uC7AC\uC2DC\uB3C4 \uBC1C\uC1A1 \uB4F1\uB85D \uC644\uB8CC',
        description: (
          <Space direction="vertical">
            <Text>\uB300\uC0C1 \uC720\uD615: {getTargetTypeLabel('Message')}</Text>
            <Text>\uB300\uC0C1 ID: {result.data.id}</Text>
            <Text>\uC0AC\uC720/\uADFC\uAC70: {reason}</Text>
            <AuditLogLink targetType="Message" targetId={result.data.id} />
          </Space>
        )
      });
      setDangerState(null);
      setDetailRow(null);
      setReloadKey((prev) => prev + 1);
    },
    [dangerState, notificationApi]
  );

  const handleExportCsv = useCallback(() => {
    const rows = visibleRows.map((history) => {
      return [
        history.id,
        history.channel === 'mail' ? '메일' : '푸시',
        getModeLabel(history.mode),
        history.templateName,
        history.groupName,
        String(history.targetCount),
        String(history.successCount),
        String(history.failureCount),
        history.status,
        history.actionType,
        history.sentAt
      ].join(',');
    });

    downloadCsvFile(
      `message-history-${activeChannel}-${new Date().toISOString().slice(0, 10)}.csv`,
      ['발송 ID,채널,유형,템플릿명,그룹,대상 수,성공,실패,상태,발송 방식,실행 시각', ...rows].join('\n')
    );
  }, [activeChannel, visibleRows]);

  const columns = useMemo<TableColumnsType<MessageHistory>>(
    () => [
      {
        title: '템플릿 이름',
        dataIndex: 'templateName',
        width: 220,
        sorter: createTextSorter((record) => record.templateName)
      },
      {
        title: '그룹 이름',
        dataIndex: 'groupName',
        width: 220,
        ellipsis: true,
        sorter: createTextSorter((record) => record.groupName)
      },
      {
        title: '수신자 수',
        dataIndex: 'targetCount',
        width: 110,
        sorter: createNumberSorter((record) => record.targetCount),
        render: (value: number) => `${value.toLocaleString()}명`
      },
      {
        title: '발송 성공',
        dataIndex: 'successCount',
        width: 110,
        sorter: createNumberSorter((record) => record.successCount),
        render: (value: number) => `${value.toLocaleString()}명`
      },
      {
        title: '발송 실패',
        dataIndex: 'failureCount',
        width: 110,
        sorter: createNumberSorter((record) => record.failureCount),
        render: (value: number) => `${value.toLocaleString()}명`
      },
      {
        title: createStatusColumnTitle('상태', ['완료', '부분 실패', '실패', '예약']),
        dataIndex: 'status',
        width: 110,
        ...createDefinedColumnFilterProps(
          messageHistoryStatusFilterValues,
          (record) => record.status
        ),
        sorter: createTextSorter((record) => record.status),
        render: (status: MessageHistoryStatus) => <StatusBadge status={status} />
      },
      {
        title: '실행 시각',
        dataIndex: 'sentAt',
        width: 160,
        sorter: createTextSorter((record) => record.sentAt)
      }
    ],
    []
  );

  const recipientColumns = useMemo<TableColumnsType<MessageHistory['recipients'][number]>>(
    () =>
      fixDrawerTableFirstColumn<MessageHistory['recipients'][number]>([
        {
          title: '사용자',
          key: 'user',
          sorter: createTextSorter((record) => `${record.userName} ${record.userId}`),
          render: (_, record) => (
            <UserNavigationLink
              userId={record.userId}
              userName={record.userName}
              withId
            />
          )
        },
        {
          title: createStatusColumnTitle('수신 상태', ['성공', '실패', '예약']),
          dataIndex: 'status',
          width: 100,
          render: (status: MessageRecipientStatus) => (
            <Tag color={getRecipientStatusColor(status)}>{status}</Tag>
          ),
          sorter: createTextSorter((record) => record.status)
        },
        {
          title: '발송일',
          dataIndex: 'sentAt',
          width: 150,
          sorter: createTextSorter((record) => record.sentAt)
        }
      ]),
    []
  );

  const handleRetryLoad = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="발송 이력" />
      <ListSummaryCards items={historySummaryCards} />

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
          <div className="admin-list-card-toolbar-stack">
            <Tabs
              activeKey={activeChannel}
              onChange={(nextChannel) =>
                commitParams({ channel: nextChannel, mode: modeFilter, keyword })
              }
              items={[
                {
                  key: 'mail',
                  label: `메일 (${channelCounts.mail})`
                },
                {
                  key: 'push',
                  label: `푸시 (${channelCounts.push})`
                }
              ]}
              className="admin-list-card-toolbar-tabs"
            />

            <SearchBar
              searchField={searchField}
              searchFieldOptions={[
                { label: '전체', value: 'all' },
                { label: '발송 ID', value: 'id' },
                { label: '템플릿 이름', value: 'templateName' },
                { label: '그룹 이름', value: 'groupName' }
              ]}
              keyword={keyword}
              onSearchFieldChange={(value) =>
                commitParams({
                  searchField: value,
                  channel: activeChannel,
                  mode: modeFilter
                })
              }
              onKeywordChange={(event) =>
                commitParams({
                  keyword: event.target.value,
                  searchField,
                  channel: activeChannel,
                  mode: modeFilter
                })
              }
              keywordPlaceholder="검색..."
              detailTitle="상세 검색"
              detailContent={
                <SearchBarDetailField label="발송일">
                  <SearchBarDateRange
                    startDate={draftStartDate}
                    endDate={draftEndDate}
                    onChange={handleDraftDateChange}
                  />
                </SearchBarDetailField>
              }
              onApply={handleApplyDateRange}
              onDetailOpenChange={handleDetailOpenChange}
              onReset={handleDraftReset}
              summary={
                <Text type="secondary">총 {visibleRows.length.toLocaleString()}건</Text>
              }
              actions={
                <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
                  CSV
                </Button>
              }
            />
          </div>
        }
      >

        {loadState.status !== 'pending' && visibleRows.length === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="조건에 맞는 발송 이력이 없습니다."
            description="채널, 유형, 상태, 검색어를 조정해서 다시 확인하세요."
          />
        ) : null}

        <AdminDataTable<MessageHistory>
          rowKey="id"
          columns={columns}
          dataSource={visibleRows}
          onRow={(record) => ({
            onClick: () => {
              setRecipientKeyword('');
              setRecipientStatusFilter('all');
              setDetailRow(record);
            },
            style: { cursor: 'pointer' }
          })}
          loading={loadState.status === 'pending'}
          pagination={{
            pageSize: 10,
            showSizeChanger: false
          }}
          scroll={{ x: 1110 }}
        />
      </AdminListCard>

      <DetailDrawer
        open={Boolean(detailRow)}
        title={detailRow ? `발송 이력 상세 · ${detailRow.id}` : '발송 이력 상세'}
        width={720}
        destroyOnHidden
        onClose={() => {
          setDetailRow(null);
          setRecipientKeyword('');
          setRecipientStatusFilter('all');
        }}
        headerMeta={
          detailRow ? <StatusBadge status={detailRow.status} /> : null
        }
        footerStart={
          detailRow ? (
            <AuditLogLink targetType="Message" targetId={detailRow.id} />
          ) : null
        }
        footerEnd={
          detailRow ? (
            <Space wrap>
              <Button
                icon={<ReloadOutlined />}
                disabled={detailRow.status === '예약'}
                onClick={() => setDangerState({ type: 'retry', history: detailRow })}
              >
                재시도
              </Button>
            </Space>
          ) : null
        }
      >
        {detailRow ? (
          <DetailDrawerBody>
            <DetailDrawerSection title="기본 정보">
              <Descriptions
                bordered
                size="small"
                column={2}
                items={[
                  { key: 'templateName', label: '템플릿 이름', children: detailRow.templateName },
                  { key: 'groupName', label: '그룹 이름', children: detailRow.groupName },
                  { key: 'targetCount', label: '수신자 수', children: `${detailRow.targetCount.toLocaleString()}명` },
                  { key: 'mode', label: '유형', children: getModeLabel(detailRow.mode) },
                  { key: 'successCount', label: '발송 성공', children: `${detailRow.successCount.toLocaleString()}명` },
                  { key: 'failureCount', label: '발송 실패', children: `${detailRow.failureCount.toLocaleString()}명` },
                  { key: 'actionType', label: '발송 방식', children: detailRow.actionType },
                  { key: 'sentAt', label: '발송일', children: detailRow.scheduledAt ?? detailRow.sentAt }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="수신자 조회">
              <Input.Search
                allowClear
                value={recipientKeyword}
                onChange={(event) => setRecipientKeyword(event.target.value)}
                placeholder="사용자 검색"
              />
              <div
                className="message-history-recipient-status-filter"
                role="group"
                aria-label="수신 상태 필터"
              >
                {recipientStatusOptions.map((option) => (
                  <Checkbox
                    key={option.key}
                    checked={recipientStatusFilter === option.key}
                    onChange={() => setRecipientStatusFilter(option.key)}
                    className="message-history-recipient-status-filter-item"
                  >
                    {option.label}
                  </Checkbox>
                ))}
              </div>
              <AdminDataTable<MessageHistory['recipients'][number]>
                rowKey="id"
                columns={recipientColumns}
                dataSource={filteredRecipients}
                pagination={recipientTablePagination}
                scroll={createDrawerTableScroll(560)}
                tableLayout="auto"
              />
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>

      {dangerState ? (
        <ConfirmAction
          open
          title="재시도 발송"
          description="실패 또는 부분 실패 건을 다시 발송합니다. 중복 발송 가능성을 확인한 뒤 사유를 남기세요."
          targetType="Message"
          targetId={dangerState.history.id}
          confirmText="재시도 실행"
          onCancel={() => setDangerState(null)}
          onConfirm={handleDangerConfirm}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// supabase 모드 — notification_dispatches(실행 ledger) + delivery_attempts 집계.
// 전달(집행)은 DB 파이프라인(10분 cron) 몫이라 재시도 액션은 제공하지 않고
// 새로고침으로 상태 전이를 반영한다 (WP2-3).
// ---------------------------------------------------------------------------

const notificationAttemptStatusOrder: NotificationAttemptStatus[] = [
  'sent',
  'failed',
  'skipped',
  'opted_out',
  'pending',
  'deduped'
];

function getNotificationAttemptStatusColor(status: NotificationAttemptStatus): string {
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

function NotificationDispatchHistoryPage(): JSX.Element {
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

export default function MessageHistoryPage(): JSX.Element {
  if (messageDataSource === 'supabase') {
    return <NotificationDispatchHistoryPage />;
  }

  return <MockMessageHistoryPage />;
}
