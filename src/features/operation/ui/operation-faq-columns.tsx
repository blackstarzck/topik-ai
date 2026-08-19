import { Space, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import type { SortOrder } from 'antd/es/table/interface';

import {
  getCurationModeTagColor,
  getCurationStatusTagColor,
  joinKeywords,
  type FaqCurationRow,
  type FaqMetricRow
} from '../model/operation-faq-page-schema';
import {
  getFaqCategoryLabel,
  getFaqCurationModeLabel,
  getFaqCurationStatusLabel,
  getFaqExposureSurfaceLabel
} from '../model/faq-schema';
import type {
  OperationFaq,
  OperationFaqCategory,
  OperationFaqCurationMode,
  OperationFaqCurationStatus,
  OperationFaqExposureSurface,
  OperationFaqStatus
} from '../model/types';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import { createNumberSorter, createTextSorter } from '@/shared/ui/table/table-column-utils';
import { TableActionMenu } from '@/shared/ui/table/table-action-menu';

const { Text } = Typography;

// FAQ 3탭 테이블 컬럼 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// URL 정렬 상태와 편집 핸들러는 페이지가 소유하고 인자로 받는다.

export function createFaqMasterColumns({
  masterSortField,
  masterSortOrder,
  onOpenCurationCreate,
  onOpenFaqEdit
}: {
  masterSortField: string | null;
  masterSortOrder: SortOrder | null;
  onOpenCurationCreate: (faqId?: string) => void;
  onOpenFaqEdit: (faq: OperationFaq) => void;
}): TableColumnsType<OperationFaq> {
  return [
  {
    title: 'FAQ ID',
    dataIndex: 'id',
    width: 120,
    sorter: createTextSorter((record) => record.id),
    sortOrder: masterSortField === 'id' ? masterSortOrder : null
  },
  {
    title: '질문',
    dataIndex: 'question',
    width: 320,
    sorter: createTextSorter((record) => record.question),
    sortOrder: masterSortField === 'question' ? masterSortOrder : null
  },
  {
    title: '카테고리',
    dataIndex: 'category',
    width: 120,
    sorter: createTextSorter((record) => record.category),
    sortOrder: masterSortField === 'category' ? masterSortOrder : null,
    render: (category: OperationFaqCategory) => getFaqCategoryLabel(category)
  },
  {
    title: '검색 키워드',
    dataIndex: 'searchKeywords',
    width: 220,
    render: (searchKeywords: string[]) => (
      <Text type="secondary">{joinKeywords(searchKeywords) || '-'}</Text>
    )
  },
  {
    title: '최종 수정',
    dataIndex: 'updatedAt',
    width: 140,
    sorter: createTextSorter((record) => record.updatedAt),
    sortOrder: masterSortField === 'updatedAt' ? masterSortOrder : null
  },
  {
    title: createStatusColumnTitle('상태', ['공개', '비공개']),
    dataIndex: 'status',
    width: 110,
    sorter: createTextSorter((record) => record.status),
    sortOrder: masterSortField === 'status' ? masterSortOrder : null,
    render: (status: OperationFaqStatus) => <StatusBadge status={status} />
  },
  {
    title: '액션',
    key: 'action',
    width: 116,
    onCell: () => ({
      onClick: (event) => event.stopPropagation()
    }),
    render: (_, record) => (
      <TableActionMenu
        items={[
          {
            key: `edit-${record.id}`,
            label: 'FAQ 수정',
            onClick: () => onOpenFaqEdit(record)
          },
          {
            key: `curation-${record.id}`,
            label: '노출 추가',
            onClick: () => onOpenCurationCreate(record.id)
          }
        ]}
      />
    )
  }
];
}

export function createFaqCurationColumns({
  curationSortField,
  curationSortOrder,
  onOpenCurationEdit
}: {
  curationSortField: string | null;
  curationSortOrder: SortOrder | null;
  onOpenCurationEdit: (curation: FaqCurationRow) => void;
}): TableColumnsType<FaqCurationRow> {
  return [
  {
    title: '노출 ID',
    dataIndex: 'id',
    width: 140,
    sorter: createTextSorter((record) => record.id),
    sortOrder: curationSortField === 'id' ? curationSortOrder : null
  },
  {
    title: '노출 위치',
    dataIndex: 'surface',
    width: 160,
    sorter: createTextSorter((record) => record.surface),
    sortOrder: curationSortField === 'surface' ? curationSortOrder : null,
    render: (surface: OperationFaqExposureSurface) =>
      getFaqExposureSurfaceLabel(surface)
  },
  {
    title: '연결 FAQ',
    dataIndex: 'faqId',
    width: 320,
    render: (_, record) => (
      <Space direction="vertical" size={0}>
        <Text>{record.faq?.question ?? '삭제되었거나 동기화되지 않은 FAQ'}</Text>
        <Text type="secondary">{record.faqId}</Text>
      </Space>
    )
  },
  {
    title: '노출 순서',
    dataIndex: 'displayRank',
    width: 110,
    sorter: createNumberSorter((record) => record.displayRank),
    sortOrder: curationSortField === 'displayRank' ? curationSortOrder : null
  },
  {
    title: '설정 방식',
    dataIndex: 'curationMode',
    width: 120,
    render: (curationMode: OperationFaqCurationMode) => (
      <Tag color={getCurationModeTagColor(curationMode)}>
        {getFaqCurationModeLabel(curationMode)}
      </Tag>
    )
  },
  {
    title: '노출 상태',
    dataIndex: 'exposureStatus',
    width: 120,
    sorter: createTextSorter((record) => record.exposureStatus),
    sortOrder:
      curationSortField === 'exposureStatus' ? curationSortOrder : null,
    render: (status: OperationFaqCurationStatus) => (
      <Tag color={getCurationStatusTagColor(status)}>
        {getFaqCurationStatusLabel(status)}
      </Tag>
    )
  },
  {
    title: '최종 수정',
    dataIndex: 'updatedAt',
    width: 140,
    sorter: createTextSorter((record) => record.updatedAt),
    sortOrder: curationSortField === 'updatedAt' ? curationSortOrder : null
  },
  {
    title: '액션',
    key: 'action',
    width: 96,
    onCell: () => ({
      onClick: (event) => event.stopPropagation()
    }),
    render: (_, record) => (
      <TableActionMenu
        items={[
          {
            key: `edit-${record.id}`,
            label: '노출 수정',
            onClick: () => onOpenCurationEdit(record)
          }
        ]}
      />
    )
  }
];
}

export function createFaqMetricColumns({
  metricSortField,
  metricSortOrder
}: {
  metricSortField: string | null;
  metricSortOrder: SortOrder | null;
}): TableColumnsType<FaqMetricRow> {
  return [
  {
    title: 'FAQ ID',
    dataIndex: 'faqId',
    width: 120,
    sorter: createTextSorter((record) => record.faqId),
    sortOrder: metricSortField === 'faqId' ? metricSortOrder : null
  },
  {
    title: '질문',
    dataIndex: 'faq',
    width: 320,
    render: (_, record) => record.faq?.question ?? '삭제된 FAQ'
  },
  {
    title: '카테고리',
    dataIndex: 'faq',
    width: 120,
    render: (_, record) =>
      record.faq ? getFaqCategoryLabel(record.faq.category) : '-'
  },
  {
    title: '조회수',
    dataIndex: 'viewCount',
    width: 110,
    sorter: createNumberSorter((record) => record.viewCount),
    sortOrder: metricSortField === 'viewCount' ? metricSortOrder : null
  },
  {
    title: '검색 유입',
    dataIndex: 'searchHitCount',
    width: 120,
    sorter: createNumberSorter((record) => record.searchHitCount),
    sortOrder:
      metricSortField === 'searchHitCount' ? metricSortOrder : null
  },
  {
    title: '도움됨',
    dataIndex: 'helpfulCount',
    width: 110,
    sorter: createNumberSorter((record) => record.helpfulCount),
    sortOrder: metricSortField === 'helpfulCount' ? metricSortOrder : null
  },
  {
    title: '도움 안 됨',
    dataIndex: 'notHelpfulCount',
    width: 130,
    sorter: createNumberSorter((record) => record.notHelpfulCount),
    sortOrder:
      metricSortField === 'notHelpfulCount' ? metricSortOrder : null
  },
  {
    title: '최근 조회',
    dataIndex: 'lastViewedAt',
    width: 150,
    sorter: createTextSorter((record) => record.lastViewedAt ?? ''),
    sortOrder: metricSortField === 'lastViewedAt' ? metricSortOrder : null,
    render: (lastViewedAt: string | null) => lastViewedAt ?? '-'
  }
];
}
