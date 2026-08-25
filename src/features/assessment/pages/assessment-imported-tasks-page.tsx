import { Alert, Button, Empty, Input, Space, Tag, Tooltip, Typography, notification } from 'antd';
import type { TableColumnsType } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useCallback, useMemo, useState } from 'react';

import { questionBankDataSource } from '../api/question-bank-data-source';
import { triggerWritingTaskIngestSafe } from '../api/imported-tasks-service';
import { SOURCE_UPDATED_AT_COLUMN_GUIDE } from '../model/question-version-column-guides';
import { useImportedTasks } from '../model/use-imported-tasks';
import { AssessmentBankTabs } from '../ui/assessment-bank-tabs';
import type {
  ImportedTaskMappingStatus,
  ImportedTaskVersionDecision,
  ImportedWritingTask
} from '../model/imported-task-types';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import {
  isInitialSummaryLoad,
  ListSummaryCards
} from '@/shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { createInfoColumnTitle } from '@/shared/ui/table/status-column-title';
import { createTextSorter } from '@/shared/ui/table/table-column-utils';
import { COLOR, SPACE } from '@/shared/styles/design-tokens';

/**
 * 가져온 문항(인박스) 목록 — 조회 전용. 외부 공급 API(/api/writing/tasks)에서
 * 수신해 무손실 인박스에 적재된 문항을 열람한다. 현재는 목록의 얇은 필드만
 * 담기며(본문·정답은 상류 id별 상세 엔드포인트 확보 후 보강), §7 정식 문항
 * 테이블과는 분리된 적재 1차 착지점이다.
 */

const MAPPING_STATUS_LABELS: Record<ImportedTaskMappingStatus, string> = {
  raw: '원문(보강 전)',
  mapped: '매핑됨',
  promoted: '승격됨',
  held: '보류'
};

const VERSION_DECISION_LABELS: Record<ImportedTaskVersionDecision, string> = {
  legacy: '기존 이력',
  initial: '최초 버전',
  content_changed: '내용 변경',
  metadata_only: '메타데이터만 변경',
  out_of_order: '과거 시각 수신',
  timestamp_conflict: '동일 시각 충돌',
  identity_conflict: '문항 식별 충돌',
  invalid_timestamp: '잘못된 시각'
};

function mappingStatusColor(status: ImportedTaskMappingStatus): string {
  if (status === 'promoted') return 'green';
  if (status === 'mapped') return 'geekblue';
  if (status === 'held') return 'volcano';
  return 'default';
}

function versionDecisionColor(decision: ImportedTaskVersionDecision): string {
  if (decision === 'initial' || decision === 'content_changed') return 'green';
  if (decision === 'legacy') return 'default';
  if (decision === 'metadata_only') return 'blue';
  return 'volcano';
}

const ITEM_NUMBERS = [51, 52, 53, 54] as const;

export default function AssessmentImportedTasksPage(): JSX.Element {
  const { state, reload } = useImportedTasks();
  const hasCached = state.data.length > 0;
  const [ingesting, setIngesting] = useState(false);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const isMock = questionBankDataSource === 'mock';

  const handleIngest = useCallback(async () => {
    setIngesting(true);
    const result = await triggerWritingTaskIngestSafe();
    setIngesting(false);

    if (!result.ok) {
      notificationApi.error({
        message: '외부 문항 가져오기에 실패했습니다.',
        description: result.error.message
      });
      return;
    }

    const { ingest: i, promote: p } = result.data;
    const promoteText = p
      ? ` · 승격: 신규 ${p.promoted_new} / 갱신 ${p.promoted_updated} / 보류 ${p.held}`
      : '';
    notificationApi.success({
      message: '외부 문항을 가져왔습니다.',
      description: `적재: 추가 ${i.inserted} / 내용 변경 ${i.new_version} / 메타데이터만 변경 ${i.metadata_only} / 보류 ${i.held} / 동일 ${i.unchanged} (총 ${i.total})${promoteText}`
    });
    reload();
  }, [notificationApi, reload]);

  const summaryItems = useMemo(() => {
    const countOf = (num: number) =>
      state.data.filter((task) => task.itemNumber === num).length;
    return [
      {
        key: 'imported-total',
        label: '전체 가져온 문항',
        value: `${state.data.length.toLocaleString()}건`
      },
      ...ITEM_NUMBERS.map((num) => ({
        key: `imported-${num}`,
        label: `${num}번`,
        value: `${countOf(num).toLocaleString()}건`
      }))
    ];
  }, [state.data]);

  const topicFilterOptions = useMemo(
    () =>
      Array.from(new Set(state.data.map((task) => task.topic).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'ko'))
        .map((value) => ({ text: value, value })),
    [state.data]
  );

  const columns = useMemo<TableColumnsType<ImportedWritingTask>>(
    () => [
      {
        title: '문항 번호',
        dataIndex: 'itemNumber',
        width: 100,
        sorter: createTextSorter((record) => String(record.itemNumber ?? '')),
        filters: ITEM_NUMBERS.map((number) => ({
          text: `${number}번`,
          value: number
        })),
        onFilter: (value, record) => record.itemNumber === value,
        render: (itemNumber: number | null) =>
          itemNumber ? `${itemNumber}번` : '미상'
      },
      {
        title: '소스 ID',
        dataIndex: 'sourceTaskId',
        width: 300,
        sorter: createTextSorter((record) => record.sourceTaskId),
        filterIcon: (filtered) => (
          <SearchOutlined style={{ color: filtered ? COLOR.primary : undefined }} />
        ),
        filterDropdown: ({
          setSelectedKeys,
          selectedKeys,
          confirm,
          clearFilters
        }) => (
          <div
            style={{ padding: SPACE.xs }}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <Input
              allowClear
              placeholder="소스 ID 검색"
              value={selectedKeys[0] as string | undefined}
              onChange={(event) =>
                setSelectedKeys(event.target.value ? [event.target.value] : [])
              }
              onPressEnter={() => confirm()}
              style={{ marginBottom: SPACE.xs, display: 'block', width: 220 }}
            />
            <Space>
              <Button
                type="primary"
                size="small"
                icon={<SearchOutlined />}
                onClick={() => confirm()}
              >
                검색
              </Button>
              <Button
                size="small"
                onClick={() => {
                  clearFilters?.();
                  confirm();
                }}
              >
                초기화
              </Button>
            </Space>
          </div>
        ),
        onFilter: (value, record) =>
          record.sourceTaskId
            .toLowerCase()
            .includes(String(value).toLowerCase())
      },
      {
        title: '제목',
        dataIndex: 'title',
        width: 220,
        sorter: createTextSorter((record) => record.title),
        render: (title: string) => title || '-'
      },
      {
        title: '주제',
        dataIndex: 'topic',
        width: 140,
        sorter: createTextSorter((record) => record.topic),
        filters: topicFilterOptions,
        onFilter: (value, record) => record.topic === value,
        render: (topic: string) => topic || '-'
      },
      {
        title: '난이도',
        dataIndex: 'difficultyLevel',
        width: 90,
        sorter: createTextSorter((record) =>
          String(record.difficultyLevel ?? '')
        ),
        filters: [1, 2, 3, 4, 5, 6].map((level) => ({
          text: `난이도 ${level}`,
          value: level
        })),
        onFilter: (value, record) => record.difficultyLevel === value,
        render: (difficulty: number | null) => difficulty ?? '-'
      },
      {
        title: '생성 출처',
        dataIndex: 'generatedBy',
        width: 110,
        sorter: createTextSorter((record) => record.generatedBy),
        render: (generatedBy: string) => generatedBy || '-'
      },
      {
        title: '적재 상태',
        dataIndex: 'mappingStatus',
        width: 130,
        sorter: createTextSorter((record) => record.mappingStatus),
        render: (status: ImportedTaskMappingStatus) => (
          <Tag color={mappingStatusColor(status)}>
            {MAPPING_STATUS_LABELS[status]}
          </Tag>
        )
      },
      {
        title: '최근 수신본',
        dataIndex: 'isLatestReceived',
        width: 120,
        sorter: (a, b) => Number(a.isLatestReceived) - Number(b.isLatestReceived),
        filters: [
          { text: '최근 수신본', value: true },
          { text: '이전 수신본', value: false }
        ],
        onFilter: (value, record) => record.isLatestReceived === value,
        render: (value: boolean) => (
          <Tag color={value ? 'blue' : 'default'}>{value ? '최근' : '이전'}</Tag>
        )
      },
      {
        title: '이력 판정',
        dataIndex: 'versionDecision',
        width: 170,
        sorter: createTextSorter((record) => record.versionDecision),
        filters: Object.entries(VERSION_DECISION_LABELS).map(([value, text]) => ({
          text,
          value
        })),
        onFilter: (value, record) => record.versionDecision === value,
        render: (decision: ImportedTaskVersionDecision) => (
          <Tag color={versionDecisionColor(decision)}>
            {VERSION_DECISION_LABELS[decision]}
          </Tag>
        )
      },
      {
        title: '원본 생성 시각',
        dataIndex: 'sourceCreatedAt',
        width: 170,
        sorter: createTextSorter((record) => record.sourceCreatedAt),
        render: (value: string) => value || '-'
      },
      {
        title: createInfoColumnTitle('원본 수정 시각', SOURCE_UPDATED_AT_COLUMN_GUIDE),
        dataIndex: 'sourceUpdatedAt',
        width: 170,
        sorter: createTextSorter((record) => record.sourceUpdatedAt),
        render: (value: string) => value || '-'
      },
      {
        title: 'content hash',
        dataIndex: 'contentHash',
        width: 200,
        ellipsis: true,
        render: (value: string) => (
          <Typography.Text code ellipsis={{ tooltip: value }}>
            {value || '-'}
          </Typography.Text>
        )
      },
      {
        title: '판정 사유',
        dataIndex: 'holdReason',
        width: 300,
        ellipsis: true,
        render: (value: string) => (
          <Typography.Text ellipsis={{ tooltip: value }}>
            {value || '-'}
          </Typography.Text>
        )
      },
      {
        title: '최근 수신',
        dataIndex: 'lastSeenAt',
        width: 160,
        sorter: createTextSorter((record) => record.lastSeenAt),
        render: (lastSeenAt: string) => lastSeenAt || '-'
      }
    ],
    [topicFilterOptions]
  );

  const toolbar = (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <Tooltip
        title={isMock ? '실모드(Supabase)에서만 가져오기를 실행할 수 있습니다.' : ''}
      >
        <span>
          <Button
            type="primary"
            size="large"
            loading={ingesting}
            disabled={isMock}
            onClick={handleIngest}
          >
            외부에서 가져오기
          </Button>
        </span>
      </Tooltip>
    </div>
  );

  return (
    <>
      {notificationContextHolder}
      <div>
        <PageTitle title="가져온 문항(인박스)" />

        <AssessmentBankTabs active="imported" />

        <ListSummaryCards
          items={summaryItems}
          loading={isInitialSummaryLoad(state.status, hasCached)}
        />

        <AdminListCard toolbar={toolbar}>
        {questionBankDataSource === 'mock' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: SPACE.base }}
            message="모크 모드로 동작 중입니다."
            description="Supabase가 구성되지 않아 화면 검증용 고정 데이터를 표시합니다. 실데이터에는 기록되지 않습니다."
          />
        ) : null}

        {state.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: SPACE.base }}
            message="가져온 문항을 불러오지 못했습니다."
            description={state.errorMessage ?? ''}
            action={
              <Button size="small" onClick={reload}>
                다시 시도
              </Button>
            }
          />
        ) : null}

        {state.status === 'pending' && !hasCached ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: SPACE.base }}
            message="가져온 문항을 불러오는 중입니다."
          />
        ) : null}

        {state.data.length === 0 && state.status !== 'pending' ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="아직 가져온 문항이 없습니다. 본문 상단 '외부에서 가져오기' 버튼(실모드)으로 외부 목록을 가져올 수 있습니다."
          />
        ) : (
          <AdminDataTable<ImportedWritingTask>
            rowKey="importId"
            pagination={{
              defaultPageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [20, 50, 100],
              showTotal: (total) => `총 ${total.toLocaleString()}건`
            }}
            scroll={{ x: 2380 }}
            tableLayout="fixed"
            columns={columns}
            dataSource={state.data}
          />
        )}
        </AdminListCard>
      </div>
    </>
  );
}
