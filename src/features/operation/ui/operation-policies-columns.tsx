import { Button, Descriptions, Space, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import type { SortOrder } from 'antd/es/table/interface';
import { Link } from 'react-router-dom';

import {
  getHistoryActionLabel,
  policyStatusFilterValues,
  type PolicySortField
} from '../model/operation-policies-page-schema';
import type {
  OperationPolicy,
  OperationPolicyHistoryEntry,
  OperationPolicyStatus
} from '../model/policy-types';
import { BinaryStatusSwitch } from '@/shared/ui/table/binary-status-switch';
import { createStatusColumnTitle } from '@/shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';

const { Text } = Typography;

// 정책 목록·히스토리 컬럼과 히스토리 스냅샷 확장 행 — Phase 4 분해로 이동(동작 동일).
// URL 정렬/필터 상태와 조치 핸들러는 페이지(또는 Drawer)가 소유하고 인자로 받는다.

export type OperationPolicyColumnsOptions = {
  sortField: PolicySortField | null;
  sortOrder: SortOrder | null;
  statusFilter: OperationPolicyStatus | null;
  onToggleStatus: (policy: OperationPolicy) => void;
};

export function createOperationPolicyColumns({
  sortField,
  sortOrder,
  statusFilter,
  onToggleStatus
}: OperationPolicyColumnsOptions): TableColumnsType<OperationPolicy> {
  return [
  {
    title: '정책 ID',
    dataIndex: 'id',
    width: 120,
    sorter: createTextSorter((record) => record.id),
    sortOrder: sortField === 'id' ? sortOrder : null
  },
  {
    title: '운영 영역',
    dataIndex: 'category',
    width: 140,
    sorter: createTextSorter((record) => record.category),
    sortOrder: sortField === 'category' ? sortOrder : null
  },
  {
    title: '정책 유형',
    dataIndex: 'policyType',
    width: 210,
    sorter: createTextSorter((record) => record.policyType),
    sortOrder: sortField === 'policyType' ? sortOrder : null
  },
  {
    title: '문서명',
    dataIndex: 'title',
    width: 260,
    sorter: createTextSorter((record) => record.title),
    sortOrder: sortField === 'title' ? sortOrder : null
  },
  {
    title: '추적 상태',
    dataIndex: 'trackingStatus',
    width: 130,
    sorter: createTextSorter((record) => record.trackingStatus),
    sortOrder: sortField === 'trackingStatus' ? sortOrder : null
  },
  {
    title: '버전',
    dataIndex: 'versionLabel',
    width: 110,
    sorter: createTextSorter((record) => record.versionLabel),
    sortOrder: sortField === 'versionLabel' ? sortOrder : null
  },
  {
    title: '시행일',
    dataIndex: 'effectiveDate',
    width: 120,
    sorter: createTextSorter((record) => record.effectiveDate),
    sortOrder: sortField === 'effectiveDate' ? sortOrder : null
  },
  {
    title: createStatusColumnTitle('상태', ['게시', '숨김']),
    dataIndex: 'status',
    width: 132,
    filteredValue: statusFilter ? [statusFilter] : null,
    ...createDefinedColumnFilterProps(policyStatusFilterValues, (record) => record.status),
    sorter: createTextSorter((record) => record.status),
    sortOrder: sortField === 'status' ? sortOrder : null,
    onCell: () => ({
      onClick: (event) => {
        event.stopPropagation();
      }
    }),
    render: (_, record) => (
      <BinaryStatusSwitch
        checked={record.status === '게시'}
        checkedLabel="게시"
        uncheckedLabel="숨김"
        onToggle={() => onToggleStatus(record)}
      />
    )
  },
  {
    title: '최근 수정',
    dataIndex: 'updatedAt',
    width: 160,
    sorter: createTextSorter((record) => record.updatedAt),
    sortOrder: sortField === 'updatedAt' ? sortOrder : null
  },
  {
    title: '수정자',
    dataIndex: 'updatedBy',
    width: 130,
    render: (updatedBy: string) => (
      <Link
        className="table-navigation-link"
        to={`/system/admins?keyword=${updatedBy}`}
        onClick={(event) => event.stopPropagation()}
      >
        {updatedBy}
      </Link>
    )
  }
];
}

export type PolicyHistoryColumnsOptions = {
  selectedPolicy: OperationPolicy | null;
  onOpenHistoryPreview: (entry: OperationPolicyHistoryEntry) => void;
  onPublishHistoryVersion: (
    policy: OperationPolicy,
    entry: OperationPolicyHistoryEntry
  ) => void;
};

export function createPolicyHistoryColumns({
  selectedPolicy,
  onOpenHistoryPreview,
  onPublishHistoryVersion
}: PolicyHistoryColumnsOptions): TableColumnsType<OperationPolicyHistoryEntry> {
  return [
  {
    title: '버전',
    dataIndex: 'versionLabel',
    width: 120
  },
  {
    title: '상태',
    dataIndex: 'status',
    width: 120
  },
  {
    title: '변경 유형',
    dataIndex: 'action',
    width: 130,
    render: (action: OperationPolicyHistoryEntry['action']) =>
      getHistoryActionLabel(action)
  },
  {
    title: '변경 시각',
    dataIndex: 'changedAt',
    width: 160
  },
  {
    title: '수정자',
    dataIndex: 'changedBy',
    width: 140
  },
  {
    title: '액션',
    key: 'actions',
    width: 200,
    onCell: () => ({
      onClick: (event) => {
        event.stopPropagation();
      }
    }),
    render: (_, entry) => (
      <Space size={8}>
        <Button
          size="small"
          onClick={(event) => {
            event.stopPropagation();
            onOpenHistoryPreview(entry);
          }}
        >
          본문 보기
        </Button>
        <Button
          size="small"
          type="primary"
          onClick={(event) => {
            event.stopPropagation();
            if (!selectedPolicy) {
              return;
            }

            onPublishHistoryVersion(selectedPolicy, entry);
          }}
        >
          이 버전 게시
        </Button>
      </Space>
    )
  }
];
}

export function renderPolicyHistoryExpandedRow(
  entry: OperationPolicyHistoryEntry
): JSX.Element {
  const snapshot = entry.snapshot;

  return (
    <Descriptions
      bordered
      size="small"
      column={2}
      items={[
        {
          key: 'action',
          label: '변경 유형',
          children: getHistoryActionLabel(entry.action)
        },
        {
          key: 'trackingStatus',
          label: '추적 상태',
          children: snapshot.trackingStatus
        },
        {
          key: 'effectiveDate',
          label: '시행일',
          children: snapshot.effectiveDate
        },
        {
          key: 'requiresConsent',
          label: '동의 필요',
          children: snapshot.requiresConsent ? '예' : '아니오'
        },
        {
          key: 'category',
          label: '운영 영역',
          children: snapshot.category
        },
        {
          key: 'policyType',
          label: '정책 유형',
          children: snapshot.policyType
        },
        {
          key: 'summary',
          label: '버전 요약',
          span: 2,
          children: snapshot.summary || '등록된 요약이 없습니다.'
        },
        {
          key: 'exposureSurfaces',
          label: '노출 위치',
          span: 2,
          children:
            snapshot.exposureSurfaces.length > 0
              ? snapshot.exposureSurfaces.join(', ')
              : '등록된 노출 위치가 없습니다.'
        },
        {
          key: 'relatedAdminPages',
          label: '연관 관리자 화면',
          span: 2,
          children:
            snapshot.relatedAdminPages.length > 0 ? (
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                {snapshot.relatedAdminPages.map((pageName) => (
                  <li key={pageName}>{pageName}</li>
                ))}
              </ul>
            ) : (
              '등록된 연관 관리자 화면이 없습니다.'
            )
        },
        {
          key: 'relatedUserPages',
          label: '연관 사용자 화면',
          span: 2,
          children:
            snapshot.relatedUserPages.length > 0 ? (
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                {snapshot.relatedUserPages.map((pageName) => (
                  <li key={pageName}>{pageName}</li>
                ))}
              </ul>
            ) : (
              '등록된 연관 사용자 화면이 없습니다.'
            )
        },
        {
          key: 'sourceDocuments',
          label: '추적 근거 문서',
          span: 2,
          children:
            snapshot.sourceDocuments.length > 0 ? (
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                {snapshot.sourceDocuments.map((documentPath) => (
                  <li key={documentPath}>
                    <Text code>{documentPath}</Text>
                  </li>
                ))}
              </ul>
            ) : (
              '등록된 추적 근거 문서가 없습니다.'
            )
        },
        {
          key: 'legalReferences',
          label: '법령 및 근거',
          span: 2,
          children:
            snapshot.legalReferences.length > 0 ? (
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                {snapshot.legalReferences.map((reference) => (
                  <li key={reference}>{reference}</li>
                ))}
              </ul>
            ) : (
              '등록된 법령 및 근거가 없습니다.'
            )
        },
        {
          key: 'note',
          label: '변경 사유',
          span: 2,
          children: entry.note || '기록된 메모가 없습니다.'
        }
      ]}
    />
  );
}
