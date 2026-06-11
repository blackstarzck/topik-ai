import { Alert, Button, Space, Tabs, Tag, Tooltip, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchQuestionBankTagMasterCatalogSafe,
  fetchQuestionBankTopicMasterCatalogSafe
} from '../api/assessment-question-bank-service';
import { questionBankDataSource } from '../api/question-bank-data-source';
import type {
  TopikWritingTagMasterCatalogRow,
  TopikWritingTopicMasterCatalogRow
} from '../model/assessment-question-bank-types';
import type { AsyncState } from '../../../shared/model/async-state';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import {
  createDefinedColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

/**
 * P5-1 마스터 조회 surface (실행계획안 §9): TOPIK 쓰기 주제/태그 마스터를
 * /system/metadata에 읽기 전용으로 노출한다. 모크 그룹 store(편집 가능 인메모리
 * SoT)와 달리 이 섹션의 SoT는 Supabase 실데이터이므로 편집 액션을 제공하지
 * 않는다 — tag_master 활성/비활성 write는 P5-3 후속(전용 RPC 신설 필요),
 * 추천키/반복방지키 JSONB는 문항 상세 화면에서 조회한다(D-10 비범위).
 */

const CATALOG_PAGINATION = {
  pageSize: 20,
  showSizeChanger: false,
  hideOnSinglePage: true
} as const;

type CatalogState<T> = AsyncState<T[]>;

function createInitialState<T>(): CatalogState<T> {
  return { status: 'pending', data: [], errorMessage: null, errorCode: null };
}

function renderActiveTag(isActive: boolean): JSX.Element {
  return <Tag color={isActive ? 'green' : 'default'}>{isActive ? '활성' : '비활성'}</Tag>;
}

function renderLongText(value: string): JSX.Element {
  if (!value) {
    return <Text type="secondary">-</Text>;
  }
  return (
    <Tooltip title={value}>
      <Text style={{ maxWidth: 280 }} ellipsis>
        {value}
      </Text>
    </Tooltip>
  );
}

function buildCountSummary(total: number, activeCount: number): string {
  return `총 ${total.toLocaleString()}건 · 활성 ${activeCount.toLocaleString()}건`;
}

export function AssessmentMasterCatalogSection(): JSX.Element {
  const [topicState, setTopicState] = useState<
    CatalogState<TopikWritingTopicMasterCatalogRow>
  >(createInitialState);
  const [tagState, setTagState] = useState<
    CatalogState<TopikWritingTagMasterCatalogRow>
  >(createInitialState);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => setReloadKey((prev) => prev + 1), []);

  useEffect(() => {
    const controller = new AbortController();

    setTopicState((prev) => ({ ...prev, status: 'pending', errorMessage: null, errorCode: null }));
    setTagState((prev) => ({ ...prev, status: 'pending', errorMessage: null, errorCode: null }));

    void fetchQuestionBankTopicMasterCatalogSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) {
        setTopicState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setTopicState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    void fetchQuestionBankTagMasterCatalogSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) {
        setTagState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setTagState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => controller.abort();
  }, [reloadKey]);

  const topicColumns = useMemo<TableColumnsType<TopikWritingTopicMasterCatalogRow>>(
    () => [
      {
        title: '정렬',
        dataIndex: 'sortOrder',
        width: 80,
        render: (value: number | null) =>
          value === null ? <Text type="secondary">-</Text> : value
      },
      {
        title: '종합 주제',
        dataIndex: 'topicMain',
        width: 140,
        ...createDefinedColumnFilterProps(
          topicState.data.map((row) => row.topicMain),
          (record) => record.topicMain
        ),
        sorter: createTextSorter((record) => record.topicMain),
        render: (value: string) => <Tag color="blue">{value}</Tag>
      },
      { title: '세부 내용', dataIndex: 'topicDetail', width: 200 },
      {
        title: '상태',
        dataIndex: 'isActive',
        width: 90,
        filters: [
          { text: '활성', value: true },
          { text: '비활성', value: false }
        ],
        onFilter: (value, record) => record.isActive === value,
        render: (value: boolean) => renderActiveTag(value)
      },
      {
        title: '출처',
        dataIndex: 'sourceName',
        render: (value: string) => renderLongText(value)
      },
      {
        title: '메모',
        dataIndex: 'memo',
        width: 220,
        render: (value: string | null) => renderLongText(value ?? '')
      }
    ],
    [topicState.data]
  );

  const tagColumns = useMemo<TableColumnsType<TopikWritingTagMasterCatalogRow>>(
    () => [
      { title: '태그 코드', dataIndex: 'tagCode', width: 200 },
      { title: '태그명', dataIndex: 'tagNameKo', width: 140 },
      {
        title: '그룹',
        dataIndex: 'tagGroup',
        width: 110,
        ...createDefinedColumnFilterProps(
          tagState.data.map((row) => row.tagGroup),
          (record) => record.tagGroup
        ),
        sorter: createTextSorter((record) => record.tagGroup),
        render: (value: string) => <Tag color="purple">{value}</Tag>
      },
      {
        title: '상태',
        dataIndex: 'isActive',
        width: 90,
        filters: [
          { text: '활성', value: true },
          { text: '비활성', value: false }
        ],
        onFilter: (value, record) => record.isActive === value,
        render: (value: boolean) => renderActiveTag(value)
      },
      {
        title: '설명',
        dataIndex: 'description',
        render: (value: string) => renderLongText(value)
      },
      {
        title: '사용 규칙',
        dataIndex: 'usageRule',
        render: (value: string) => renderLongText(value)
      },
      {
        title: '예시 문항',
        dataIndex: 'exampleQuestionId',
        width: 180,
        render: (value: string | null) =>
          value ? <Text>{value}</Text> : <Text type="secondary">-</Text>
      },
      {
        title: '최근 수정',
        dataIndex: 'updatedAt',
        width: 150,
        render: (value: string) =>
          value ? <Text>{value}</Text> : <Text type="secondary">-</Text>
      }
    ],
    [tagState.data]
  );

  const topicActiveCount = useMemo(
    () => topicState.data.filter((row) => row.isActive).length,
    [topicState.data]
  );
  const tagActiveCount = useMemo(
    () => tagState.data.filter((row) => row.isActive).length,
    [tagState.data]
  );

  const renderCatalogStateAlerts = (
    state: CatalogState<unknown>,
    subjectLabel: string
  ): JSX.Element | null => {
    if (state.status === 'error') {
      return (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={`${subjectLabel}를 불러오지 못했습니다.`}
          description={state.errorMessage ?? ''}
          action={
            <Button size="small" onClick={reload}>
              다시 시도
            </Button>
          }
        />
      );
    }
    if (state.status === 'empty') {
      return (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={`등록된 ${subjectLabel}가 없습니다.`}
          description={
            questionBankDataSource === 'legacy'
              ? '마스터 데이터는 신규 스키마(topik_writing) 전용입니다. legacy 롤백 모드에서는 표시되지 않습니다.'
              : undefined
          }
        />
      );
    }
    return null;
  };

  return (
    <AdminListCard
      title="TOPIK 쓰기 마스터 데이터 (읽기 전용)"
      style={{ marginTop: 24 }}
      data-testid="assessment-master-catalog-section"
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="문항 메타데이터의 기준 축인 주제/태그 마스터를 조회하는 영역입니다."
        description={
          <Space direction="vertical" size={4}>
            <Text>
              위 운영 설정 카탈로그와 달리 이 데이터의 원본은 평가 데이터베이스
              (topik_writing_topic_master / topik_writing_tag_master)이며, 이 화면에서는
              편집할 수 없습니다.
            </Text>
            <Text>
              태그별 추천·반복방지 부여 현황은 문항 상세에서, 태그 부여/제거는 TOPIK 쓰기
              문항 관리에서 진행합니다. 마스터 값 자체의 변경은 데이터 공급 계약과 후속
              운영 결정에 따릅니다.
            </Text>
          </Space>
        }
      />
      {questionBankDataSource === 'mock' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="모크 모드로 동작 중입니다."
          description="Supabase가 구성되지 않아 화면 검증용 고정 마스터 데이터를 표시합니다."
        />
      ) : null}
      <Tabs
        defaultActiveKey="topic"
        items={[
          {
            key: 'topic',
            label: '주제 마스터',
            children: (
              <div data-testid="topic-master-catalog">
                {renderCatalogStateAlerts(topicState, '주제 마스터')}
                <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                  {buildCountSummary(topicState.data.length, topicActiveCount)} — 17개 고정
                  종합 주제 × 세부 내용 축입니다. 문항 목록의 주제 필터가 이 마스터를
                  따릅니다.
                </Paragraph>
                <AdminDataTable<TopikWritingTopicMasterCatalogRow>
                  rowKey="topicId"
                  pagination={CATALOG_PAGINATION}
                  scroll={{ x: 1000 }}
                  loading={topicState.status === 'pending'}
                  columns={topicColumns}
                  dataSource={topicState.data}
                />
              </div>
            )
          },
          {
            key: 'tag',
            label: '태그 마스터',
            children: (
              <div data-testid="tag-master-catalog">
                {renderCatalogStateAlerts(tagState, '태그 마스터')}
                <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                  {buildCountSummary(tagState.data.length, tagActiveCount)} — 태그 부여
                  옵션의 값 사전입니다. 그룹별 사용 규칙이 노출 제외 기준(운영주의)과
                  연동됩니다.
                </Paragraph>
                <AdminDataTable<TopikWritingTagMasterCatalogRow>
                  rowKey="tagCode"
                  pagination={CATALOG_PAGINATION}
                  scroll={{ x: 1400 }}
                  loading={tagState.status === 'pending'}
                  columns={tagColumns}
                  dataSource={tagState.data}
                />
              </div>
            )
          }
        ]}
      />
    </AdminListCard>
  );
}
