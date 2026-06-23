import { Alert, Button, Empty, Tag, Tooltip, notification } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useMemo, useState } from 'react';

import { questionBankDataSource } from '../api/question-bank-data-source';
import { triggerWritingTaskIngestSafe } from '../api/imported-tasks-service';
import { useImportedTasks } from '../model/use-imported-tasks';
import { AssessmentBankTabs } from '../ui/assessment-bank-tabs';
import type {
  ImportedTaskMappingStatus,
  ImportedWritingTask
} from '../model/imported-task-types';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';

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

function mappingStatusColor(status: ImportedTaskMappingStatus): string {
  if (status === 'promoted') return 'green';
  if (status === 'mapped') return 'geekblue';
  if (status === 'held') return 'volcano';
  return 'default';
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
      description: `적재: 추가 ${i.inserted} / 변경 ${i.new_version} / 동일 ${i.unchanged} (총 ${i.total})${promoteText}`
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

  const columns = useMemo<TableColumnsType<ImportedWritingTask>>(
    () => [
      {
        title: '문항 번호',
        dataIndex: 'itemNumber',
        width: 100,
        sorter: createTextSorter((record) => String(record.itemNumber ?? '')),
        render: (itemNumber: number | null) =>
          itemNumber ? `${itemNumber}번` : '미상'
      },
      {
        title: '소스 ID',
        dataIndex: 'sourceTaskId',
        width: 300,
        sorter: createTextSorter((record) => record.sourceTaskId)
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
        render: (topic: string) => topic || '-'
      },
      {
        title: '난이도',
        dataIndex: 'difficultyLevel',
        width: 90,
        sorter: createTextSorter((record) =>
          String(record.difficultyLevel ?? '')
        ),
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
        title: '최근 수신',
        dataIndex: 'lastSeenAt',
        width: 160,
        sorter: createTextSorter((record) => record.lastSeenAt),
        render: (lastSeenAt: string) => lastSeenAt || '-'
      }
    ],
    []
  );

  return (
    <>
      {notificationContextHolder}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap'
          }}
        >
          <PageTitle title="가져온 문항(인박스)" />
          <Tooltip
            title={isMock ? '실모드(Supabase)에서만 가져오기를 실행할 수 있습니다.' : ''}
          >
            <span>
              <Button
                type="primary"
                loading={ingesting}
                disabled={isMock}
                onClick={handleIngest}
              >
                외부에서 가져오기
              </Button>
            </span>
          </Tooltip>
        </div>

        <AssessmentBankTabs active="imported" />

        <ListSummaryCards items={summaryItems} />

      <AdminListCard>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="외부 공급 API에서 가져온 문항 목록입니다."
          description="목록 응답(제목·주제·난이도 등)을 무손실로 적재한 1차 착지점입니다. 문항 본문·정답은 상류의 문항별 상세 조회 엔드포인트가 확보되면 보강(승격)됩니다."
        />

        {questionBankDataSource === 'mock' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="모크 모드로 동작 중입니다."
            description="Supabase가 구성되지 않아 화면 검증용 고정 데이터를 표시합니다. 실데이터에는 기록되지 않습니다."
          />
        ) : null}

        {state.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
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
            style={{ marginBottom: 16 }}
            message="가져온 문항을 불러오는 중입니다."
          />
        ) : null}

        {state.data.length === 0 && state.status !== 'pending' ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="아직 가져온 문항이 없습니다. 우측 상단 '외부에서 가져오기' 버튼(실모드)으로 외부 목록을 가져올 수 있습니다."
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
            scroll={{ x: 1250 }}
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
