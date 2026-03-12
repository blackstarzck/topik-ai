import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Input,
  Select,
  Space,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchHistoriesSafe } from '../api/messages-service';
import { useMessageStore } from '../model/message-store';
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
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { matchesSearchField } from '../../../shared/ui/search-bar/search-bar-utils';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import {
  createColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

type HistoryStatusFilter = MessageHistoryStatus | 'all';
type HistoryModeFilter = MessageTemplateMode | 'all';

type HistoryDangerState =
  | { type: 'retry'; history: MessageHistory }
  | { type: 'duplicate'; history: MessageHistory }
  | null;

function parseChannel(value: string | null): MessageChannel {
  return value === 'push' ? 'push' : 'mail';
}

function parseStatus(value: string | null): HistoryStatusFilter {
  if (value === '완료' || value === '부분 실패' || value === '실패' || value === '예약') {
    return value;
  }
  return 'all';
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

export default function MessageHistoryPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeChannel = parseChannel(searchParams.get('channel'));
  const searchField = searchParams.get('searchField') ?? 'all';
  const statusFilter = parseStatus(searchParams.get('status'));
  const modeFilter = parseMode(searchParams.get('mode'));
  const keyword = searchParams.get('keyword') ?? '';

  const histories = useMessageStore((state) => state.histories);
  const retryHistory = useMessageStore((state) => state.retryHistory);
  const duplicateHistory = useMessageStore((state) => state.duplicateHistory);

  const [loadState, setLoadState] = useState<AsyncState<null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [detailRow, setDetailRow] = useState<MessageHistory | null>(null);
  const [recipientKeyword, setRecipientKeyword] = useState('');
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

  const visibleRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return histories.filter((history) => {
      if (history.channel !== activeChannel) {
        return false;
      }
      if (modeFilter !== 'all' && history.mode !== modeFilter) {
        return false;
      }
      if (statusFilter !== 'all' && history.status !== statusFilter) {
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
  }, [activeChannel, histories, keyword, modeFilter, searchField, statusFilter]);

  const filteredRecipients = useMemo(() => {
    if (!detailRow) {
      return [];
    }

    const normalizedKeyword = recipientKeyword.trim().toLowerCase();
    if (!normalizedKeyword) {
      return detailRow.recipients;
    }

    return detailRow.recipients.filter((recipient) => {
      return (
        recipient.userId.toLowerCase().includes(normalizedKeyword) ||
        recipient.userName.toLowerCase().includes(normalizedKeyword) ||
        recipient.destination.toLowerCase().includes(normalizedKeyword)
      );
    });
  }, [detailRow, recipientKeyword]);

  const commitParams = useCallback(
    (
      next: Partial<
        Record<'channel' | 'searchField' | 'status' | 'mode' | 'keyword', string>
      >
    ) => {
      const merged = new URLSearchParams(searchParams);

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

  const handleDangerConfirm = useCallback(
    async (reason: string) => {
      if (!dangerState) {
        return;
      }

      const result =
        dangerState.type === 'retry'
          ? retryHistory(dangerState.history.id, 'admin_current')
          : duplicateHistory(dangerState.history.id, 'admin_current');

      if (!result) {
        return;
      }

      notificationApi.success({
        message: dangerState.type === 'retry' ? '재시도 발송 등록 완료' : '복제 발송 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
            <Text>대상 ID: {result.id}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="Message" targetId={result.id} />
          </Space>
        )
      });
      setDangerState(null);
      setDetailRow(null);
    },
    [dangerState, duplicateHistory, notificationApi, retryHistory]
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
        ...createColumnFilterProps(visibleRows, (record) => record.templateName),
        sorter: createTextSorter((record) => record.templateName)
      },
      {
        title: '그룹 이름',
        dataIndex: 'groupName',
        width: 220,
        ellipsis: true,
        ...createColumnFilterProps(visibleRows, (record) => record.groupName),
        sorter: createTextSorter((record) => record.groupName)
      },
      {
        title: '수신자 수',
        dataIndex: 'targetCount',
        width: 110,
        align: 'right',
        ...createColumnFilterProps(visibleRows, (record) => record.targetCount),
        sorter: createNumberSorter((record) => record.targetCount),
        render: (value: number) => `${value.toLocaleString()}명`
      },
      {
        title: '발송 성공',
        dataIndex: 'successCount',
        width: 110,
        align: 'right',
        ...createColumnFilterProps(visibleRows, (record) => record.successCount),
        sorter: createNumberSorter((record) => record.successCount),
        render: (value: number) => `${value.toLocaleString()}명`
      },
      {
        title: '발송 실패',
        dataIndex: 'failureCount',
        width: 110,
        align: 'right',
        ...createColumnFilterProps(visibleRows, (record) => record.failureCount),
        sorter: createNumberSorter((record) => record.failureCount),
        render: (value: number) => `${value.toLocaleString()}명`
      },
      {
        title: '상태',
        dataIndex: 'status',
        width: 110,
        ...createColumnFilterProps(visibleRows, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        render: (status: MessageHistoryStatus) => <StatusBadge status={status} />
      },
      {
        title: '실행 시각',
        dataIndex: 'sentAt',
        width: 160,
        ...createColumnFilterProps(visibleRows, (record) => record.sentAt),
        sorter: createTextSorter((record) => record.sentAt)
      },
      {
        title: '미리보기',
        key: 'detail',
        width: 90,
        align: 'center',
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <Tooltip title="상세 보기">
            <Button type="text" icon={<EyeOutlined />} onClick={() => setDetailRow(record)} />
          </Tooltip>
        )
      }
    ],
    [visibleRows]
  );

  const recipientColumns = useMemo<TableColumnsType<MessageHistory['recipients'][number]>>(
    () => [
      {
        title: '사용자 ID',
        dataIndex: 'userId',
        width: 110,
        sorter: createTextSorter((record) => record.userId)
      },
      {
        title: '사용자명',
        dataIndex: 'userName',
        width: 100,
        sorter: createTextSorter((record) => record.userName)
      },
      {
        title: activeChannel === 'mail' ? '이메일' : '디바이스 ID',
        dataIndex: 'destination',
        ellipsis: true,
        sorter: createTextSorter((record) => record.destination)
      },
      {
        title: '유형',
        dataIndex: 'mode',
        width: 90,
        render: (mode: MessageTemplateMode) => getModeLabel(mode),
        sorter: createTextSorter((record) => record.mode)
      },
      {
        title: '템플릿 이름',
        dataIndex: 'templateName',
        width: 140,
        ellipsis: true,
        sorter: createTextSorter((record) => record.templateName)
      },
      {
        title: '수신 상태',
        dataIndex: 'status',
        width: 100,
        render: (status: MessageRecipientStatus) => <Tag color={getRecipientStatusColor(status)}>{status}</Tag>,
        sorter: createTextSorter((record) => record.status)
      },
      {
        title: '발송일',
        dataIndex: 'sentAt',
        width: 150,
        sorter: createTextSorter((record) => record.sentAt)
      }
    ],
    [activeChannel]
  );

  const handleRetryLoad = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

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

      <Tabs
        activeKey={activeChannel}
        onChange={(nextChannel) =>
          commitParams({ channel: nextChannel, mode: modeFilter, status: statusFilter, keyword })
        }
        items={[
          {
            key: 'mail',
            label: `메일 (${histories.filter((history) => history.channel === 'mail').length})`
          },
          {
            key: 'push',
            label: `푸시 (${histories.filter((history) => history.channel === 'push').length})`
          }
        ]}
        style={{ marginBottom: 12 }}
      />

      <Card
        extra={
          <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
            CSV
          </Button>
        }
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          채널별 발송 이력을 유지하면서, 선택한 발송건의 수신자 샘플과 성공/실패 상태를 우측
          상세 패널에서 함께 확인합니다.
        </Paragraph>

        <Tabs
          activeKey={modeFilter}
          onChange={(value) =>
            commitParams({ mode: value, channel: activeChannel, status: statusFilter, keyword })
          }
          items={[
            { key: 'all', label: `전체 (${histories.filter((history) => history.channel === activeChannel).length})` },
            {
              key: 'auto',
              label: `자동 (${histories.filter((history) => history.channel === activeChannel && history.mode === 'auto').length})`
            },
            {
              key: 'manual',
              label: `수동 (${histories.filter((history) => history.channel === activeChannel && history.mode === 'manual').length})`
            }
          ]}
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
              mode: modeFilter,
              status: statusFilter
            })
          }
          onKeywordChange={(event) =>
            commitParams({
              keyword: event.target.value,
              searchField,
              channel: activeChannel,
              mode: modeFilter,
              status: statusFilter
            })
          }
          keywordPlaceholder="검색..."
          detailTitle="상세 검색"
          detailContent={
            <SearchBarDetailField label="상태">
              <Select
                value={statusFilter}
                options={[
                  { label: '전체', value: 'all' },
                  { label: '완료', value: '완료' },
                  { label: '부분 실패', value: '부분 실패' },
                  { label: '실패', value: '실패' },
                  { label: '예약', value: '예약' }
                ]}
                onChange={(value: HistoryStatusFilter) =>
                  commitParams({
                    status: value,
                    channel: activeChannel,
                    mode: modeFilter,
                    keyword,
                    searchField
                  })
                }
              />
            </SearchBarDetailField>
          }
          onReset={() =>
            setSearchParams(new URLSearchParams({ channel: activeChannel }), {
              replace: true
            })
          }
          summary={
            <Text type="secondary">총 {visibleRows.length.toLocaleString()}건</Text>
          }
        />

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
      </Card>

      <Drawer
        open={Boolean(detailRow)}
        title={
          <Space align="center">
            <span>발송 이력 상세 정보</span>
            {detailRow ? <StatusBadge status={detailRow.status} /> : null}
          </Space>
        }
        width={720}
        destroyOnClose
        onClose={() => setDetailRow(null)}
        footer={
          detailRow ? (
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  disabled={detailRow.status === '예약'}
                  onClick={() => setDangerState({ type: 'retry', history: detailRow })}
                >
                  재시도
                </Button>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => setDangerState({ type: 'duplicate', history: detailRow })}
                >
                  복제 발송
                </Button>
              </Space>
              <Button onClick={() => setDetailRow(null)}>닫기</Button>
            </Space>
          ) : null
        }
      >
        {detailRow ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
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

            <Input.Search
              allowClear
              value={recipientKeyword}
              onChange={(event) => setRecipientKeyword(event.target.value)}
              placeholder="사용자 검색"
            />

            <Text type="secondary">
              수신자 목록은 샘플 데이터 {detailRow.recipients.length.toLocaleString()}건을 보여줍니다. 총
              대상 {detailRow.targetCount.toLocaleString()}건 기준으로 성공/실패 집계를 계산했습니다.
            </Text>

            <AdminDataTable<MessageHistory['recipients'][number]>
              rowKey="id"
              columns={recipientColumns}
              dataSource={filteredRecipients}
              pagination={{
                pageSize: 10,
                showSizeChanger: false
              }}
              scroll={{ x: 980 }}
            />
          </Space>
        ) : null}
      </Drawer>

      {dangerState ? (
        <ConfirmAction
          open
          title={dangerState.type === 'retry' ? '재시도 발송' : '복제 발송'}
          description={
            dangerState.type === 'retry'
              ? '실패 또는 부분 실패 건을 다시 발송합니다. 중복 발송 가능성을 확인한 뒤 사유를 남기세요.'
              : '현재 발송 조건을 그대로 복제해 새 발송건으로 등록합니다. 복제 목적을 남기세요.'
          }
          targetType="Message"
          targetId={dangerState.history.id}
          confirmText={dangerState.type === 'retry' ? '재시도 실행' : '복제 실행'}
          onCancel={() => setDangerState(null)}
          onConfirm={handleDangerConfirm}
        />
      ) : null}
    </div>
  );
}
