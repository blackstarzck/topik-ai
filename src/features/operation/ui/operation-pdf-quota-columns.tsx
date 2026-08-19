import { Space, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';

import {
  formatPdfQuotaLimitLabel,
  formatPdfQuotaUnitLabel,
  renderPdfQuotaTransition
} from '../model/operation-pdf-quota-page-schema';
import {
  pdfQuotaResetScopeLabels,
  type PdfQuotaPolicyHistoryEntry,
  type PdfQuotaReset,
  type PdfQuotaResetScope
} from '../model/pdf-quota-types';

const { Text } = Typography;

// 정책 변경 이력·초기화 이력 컬럼 정의 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 두 컬럼 모두 외부 상태를 참조하지 않는다(포맷 헬퍼는 스키마에서 가져온다).

export function createPdfQuotaHistoryColumns(): TableColumnsType<PdfQuotaPolicyHistoryEntry> {
  return [
    {
      title: '변경 시각',
      dataIndex: 'createdAt',
      width: 150
    },
    {
      title: '처리자',
      key: 'actor',
      width: 200,
      render: (_, record) =>
        record.actorName || record.actorEmail ? (
          <Space direction="vertical" size={0}>
            <Text>{record.actorName || '-'}</Text>
            <Text type="secondary">{record.actorEmail}</Text>
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        )
    },
    {
      title: '한도',
      key: 'limit',
      width: 150,
      render: (_, record) =>
        renderPdfQuotaTransition(
          formatPdfQuotaLimitLabel(record.limitFrom),
          formatPdfQuotaLimitLabel(record.limitTo),
          record.limitFrom !== null || record.limitTo !== null,
          formatPdfQuotaLimitLabel(record.resultLimit)
        )
    },
    {
      title: '주기',
      key: 'periodUnit',
      width: 120,
      render: (_, record) =>
        renderPdfQuotaTransition(
          formatPdfQuotaUnitLabel(record.periodUnitFrom),
          formatPdfQuotaUnitLabel(record.periodUnitTo),
          record.periodUnitFrom !== null || record.periodUnitTo !== null,
          formatPdfQuotaUnitLabel(record.resultPeriodUnit)
        )
    },
    {
      title: '기준 시간대',
      key: 'timezone',
      width: 170,
      render: (_, record) => {
        if (!record.periodTimezoneFrom && !record.periodTimezoneTo) {
          return <Text type="secondary">-</Text>;
        }
        if (record.periodTimezoneFrom === record.periodTimezoneTo) {
          return record.periodTimezoneTo;
        }
        return `${record.periodTimezoneFrom ?? '-'} → ${record.periodTimezoneTo ?? '-'}`;
      }
    },
    {
      title: '사유/근거',
      dataIndex: 'reason'
    }
  ];
}

export function createPdfQuotaResetColumns(): TableColumnsType<PdfQuotaReset> {
  return [
    {
      title: '실행일',
      dataIndex: 'createdAt',
      width: 150
    },
    {
      title: '범위',
      dataIndex: 'scope',
      width: 110,
      render: (scope: PdfQuotaResetScope) => (
        <Tag color={scope === 'global' ? 'red' : scope === 'group' ? 'blue' : undefined}>
          {pdfQuotaResetScopeLabels[scope]}
        </Tag>
      )
    },
    {
      title: '대상 수',
      dataIndex: 'targetCount',
      width: 100,
      render: (targetCount: number) => `${targetCount.toLocaleString()}명`
    },
    {
      title: '문항',
      dataIndex: 'problemId',
      width: 200,
      render: (problemId: string | null) =>
        problemId ? <Text code>{problemId}</Text> : '전체 문항'
    },
    {
      title: '사유/근거',
      dataIndex: 'reason'
    },
    {
      title: '처리자',
      key: 'actor',
      width: 200,
      render: (_, record) =>
        record.actorName || record.actorEmail ? (
          <Space direction="vertical" size={0}>
            <Text>{record.actorName || '-'}</Text>
            <Text type="secondary">{record.actorEmail}</Text>
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        )
    }
  ];
}
