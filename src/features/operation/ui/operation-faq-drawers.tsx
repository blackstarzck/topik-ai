import { Alert, Button, Descriptions, Space, Tag, Typography } from 'antd';

import {
  formatMetricRatio,
  formatPinnedDateRange,
  getCurationStatusTagColor,
  joinKeywords,
  type DangerState,
  type FaqCurationRow,
  type FaqMetricRow
} from '../model/operation-faq-page-schema';
import {
  getFaqCategoryLabel,
  getFaqCurationModeLabel,
  getFaqCurationStatusLabel,
  getFaqExposureSurfaceLabel
} from '../model/faq-schema';
import type { OperationFaq } from '../model/types';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '@/shared/ui/detail-drawer/detail-drawer';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';

const { Paragraph, Text } = Typography;

// FAQ 상세·노출 규칙 상세 Drawer — Phase 4 분해로 이동(동작 동일).
// 선택 대상·조치 핸들러는 페이지가 소유하고, 표시 항목은 Drawer 내부에서 파생한다.

export function FaqDetailDrawer({
  faq,
  metric,
  curations,
  onClose,
  onEditFaq,
  onCreateCuration,
  onOpenCurationDrawer,
  onDanger
}: {
  faq: OperationFaq | null;
  metric: FaqMetricRow | null;
  curations: FaqCurationRow[];
  onClose: () => void;
  onEditFaq: (faq: OperationFaq) => void;
  onCreateCuration: (faqId?: string) => void;
  onOpenCurationDrawer: (curationId: string) => void;
  onDanger: (next: NonNullable<DangerState>) => void;
}): JSX.Element {

const faqDrawerInfoItems = faq
  ? [
      { key: 'faqId', label: 'FAQ ID', children: faq.id },
      { key: 'category', label: '카테고리', children: faq.category },
      {
        key: 'status',
        label: '공개 상태',
        children: <StatusBadge status={faq.status} />
      },
      { key: 'createdAt', label: '등록일', children: faq.createdAt },
      { key: 'updatedAt', label: '최종 수정', children: faq.updatedAt },
      { key: 'updatedBy', label: '수정자', children: faq.updatedBy }
    ]
  : [];

const faqMetricItems = metric
  ? [
      {
        key: 'viewCount',
        label: '조회수',
        children: `${metric.viewCount.toLocaleString()}회`
      },
      {
        key: 'searchHitCount',
        label: '검색 유입',
        children: `${metric.searchHitCount.toLocaleString()}회`
      },
      {
        key: 'helpful',
        label: '도움됨',
        children: `${metric.helpfulCount.toLocaleString()}건`
      },
      {
        key: 'notHelpful',
        label: '도움 안 됨',
        children: `${metric.notHelpfulCount.toLocaleString()}건`
      },
      {
        key: 'ratio',
        label: '도움됨 비율',
        children: formatMetricRatio(metric)
      },
      {
        key: 'lastViewedAt',
        label: '최근 조회',
        children: metric.lastViewedAt ?? '-'
      }
    ]
  : [{ key: 'empty', label: '지표 상태', children: '아직 집계된 지표가 없습니다.' }];

  return (
<DetailDrawer
  open={Boolean(faq)}
  title={faq ? `FAQ 상세 · ${faq.id}` : 'FAQ 상세'}
  width={760}
  destroyOnHidden
  onClose={onClose}
  headerMeta={faq ? <StatusBadge status={faq.status} /> : null}
  footerStart={
    faq ? (
      <AuditLogLink targetType="OperationFaq" targetId={faq.id} />
    ) : null
  }
  footerEnd={
    faq ? (
      <Space wrap>
        <Button onClick={() => onEditFaq(faq)}>FAQ 수정</Button>
        <Button onClick={() => onCreateCuration(faq.id)}>
          노출 추가
        </Button>
        <Button
          onClick={() =>
            onDanger({
              type: 'toggleFaqStatus',
              faq: faq,
              nextStatus: faq.status === '공개' ? '비공개' : '공개'
            })
          }
        >
          {faq.status === '공개' ? '비공개 전환' : '공개 전환'}
        </Button>
        <Button
          danger
          onClick={() => onDanger({ type: 'deleteFaq', faq: faq })}
        >
          FAQ 삭제
        </Button>
      </Space>
    ) : null
  }
>
  {faq ? (
    <DetailDrawerBody>
      {faq.status === '비공개' && curations.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          message="비공개 FAQ에 연결된 노출 규칙이 있습니다."
          description="비공개 전환 시 관련 노출 규칙은 자동으로 대기 상태로 전환됩니다."
        />
      ) : null}

      <DetailDrawerSection title="FAQ 정보">
        <Descriptions bordered size="small" column={1} items={faqDrawerInfoItems} />
      </DetailDrawerSection>

      <DetailDrawerSection title="질문 / 답변">
        <Descriptions
          bordered
          size="small"
          column={1}
          items={[
            { key: 'question', label: '질문', children: faq.question },
            {
              key: 'searchKeywords',
              label: '검색 키워드',
              children: joinKeywords(faq.searchKeywords) || '-'
            },
            {
              key: 'answer',
              label: '답변',
              children: (
                <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                  {faq.answer}
                </Paragraph>
              )
            }
          ]}
        />
      </DetailDrawerSection>

      <DetailDrawerSection
        title="노출 관리 요약"
        actions={
          <Button
            type="primary"
            size="large"
            onClick={() => onCreateCuration(faq.id)}
          >
            노출 추가
          </Button>
        }
      >
        {curations.length === 0 ? (
          <Alert
            type="info"
            showIcon
            message="연결된 노출 규칙이 없습니다."
            description="홈 추천 FAQ나 고객센터 대표 FAQ로 노출하려면 규칙을 추가하세요."
          />
        ) : (
          <Descriptions
            bordered
            size="small"
            column={1}
            items={curations.map((curation) => ({
              key: curation.id,
              label: curation.id,
              children: (
                <Space wrap>
                  <Tag color={getCurationStatusTagColor(curation.exposureStatus)}>
                    {getFaqCurationStatusLabel(curation.exposureStatus)}
                  </Tag>
                  <Text>{getFaqExposureSurfaceLabel(curation.surface)}</Text>
                  <Text type="secondary">{curation.displayRank}위</Text>
                  <Button type="link" onClick={() => onOpenCurationDrawer(curation.id)}>
                    노출 상세 열기
                  </Button>
                </Space>
              )
            }))}
          />
        )}
      </DetailDrawerSection>

      <DetailDrawerSection title="지표 요약">
        <Descriptions bordered size="small" column={1} items={faqMetricItems} />
      </DetailDrawerSection>
    </DetailDrawerBody>
  ) : null}
</DetailDrawer>
  );
}

export function CurationDetailDrawer({
  curation,
  metricRows,
  onClose,
  onEditCuration,
  onOpenFaqDrawer,
  onDanger
}: {
  curation: FaqCurationRow | null;
  metricRows: FaqMetricRow[];
  onClose: () => void;
  onEditCuration: (curation: FaqCurationRow) => void;
  onOpenFaqDrawer: (faqId: string) => void;
  onDanger: (next: NonNullable<DangerState>) => void;
}): JSX.Element {
  const curationDrawerItems = curation
  ? [
      { key: 'curationId', label: '노출 ID', children: curation.id },
      {
        key: 'surface',
        label: '노출 위치',
        children: getFaqExposureSurfaceLabel(curation.surface)
      },
      {
        key: 'displayRank',
        label: '노출 순서',
        children: `${curation.displayRank}위`
      },
      {
        key: 'curationMode',
        label: '설정 방식',
        children: getFaqCurationModeLabel(curation.curationMode)
      },
      {
        key: 'exposureStatus',
        label: '노출 상태',
        children: (
          <Tag color={getCurationStatusTagColor(curation.exposureStatus)}>
            {getFaqCurationStatusLabel(curation.exposureStatus)}
          </Tag>
        )
      },
      {
        key: 'pinnedPeriod',
        label: '노출 기간',
        children: formatPinnedDateRange(
          curation.pinnedStartAt,
          curation.pinnedEndAt
        )
      },
      { key: 'updatedAt', label: '최종 수정', children: curation.updatedAt },
      { key: 'updatedBy', label: '수정자', children: curation.updatedBy }
    ]
  : [];

const curationLinkedFaqItems = curation
  ? [
      { key: 'faqId', label: 'FAQ ID', children: curation.faqId },
      {
        key: 'question',
        label: '질문',
        children: curation.faq?.question ?? '삭제되었거나 동기화되지 않은 FAQ'
      },
      {
        key: 'category',
        label: '카테고리',
        children: curation.faq
          ? getFaqCategoryLabel(curation.faq.category)
          : '-'
      },
      {
        key: 'status',
        label: 'FAQ 상태',
        children: curation.faq ? (
          <StatusBadge status={curation.faq.status} />
        ) : (
          '-'
        )
      }
    ]
  : [];

  return (
<DetailDrawer
  open={Boolean(curation)}
  title={curation ? `FAQ 노출 상세 · ${curation.id}` : 'FAQ 노출 상세'}
  width={720}
  destroyOnHidden
  onClose={onClose}
  headerMeta={
    curation ? (
      <Tag color={getCurationStatusTagColor(curation.exposureStatus)}>
        {getFaqCurationStatusLabel(curation.exposureStatus)}
      </Tag>
    ) : null
  }
  footerStart={
    curation ? (
      <AuditLogLink
        targetType="OperationFaqCuration"
        targetId={curation.id}
      />
    ) : null
  }
  footerEnd={
    curation ? (
      <Space wrap>
        <Button onClick={() => onEditCuration(curation)}>
          노출 수정
        </Button>
        <Button
          onClick={() =>
            onDanger({
              type: 'toggleCurationStatus',
              curation: curation,
              nextStatus:
                curation.exposureStatus === 'active'
                  ? 'paused'
                  : 'active'
            })
          }
        >
          {curation.exposureStatus === 'active'
            ? '노출 일시중지'
            : '노출 재개'}
        </Button>
        <Button
          danger
          onClick={() =>
            onDanger({
              type: 'deleteCuration',
              curation: curation
            })
          }
        >
          노출 삭제
        </Button>
      </Space>
    ) : null
  }
>
  {curation ? (
    <DetailDrawerBody>
      <DetailDrawerSection title="노출 규칙">
        <Descriptions bordered size="small" column={1} items={curationDrawerItems} />
      </DetailDrawerSection>

      <DetailDrawerSection
        title="연결 FAQ"
        actions={
          curation.faq ? (
            <Button
              type="primary"
              size="large"
              onClick={() => onOpenFaqDrawer(curation.faqId)}
            >
              FAQ 상세 열기
            </Button>
          ) : null
        }
      >
        <Descriptions bordered size="small" column={1} items={curationLinkedFaqItems} />
      </DetailDrawerSection>

      <DetailDrawerSection title="지표 참고">
        <Descriptions
          bordered
          size="small"
          column={1}
          items={[
            {
              key: 'viewCount',
              label: '조회수',
              children:
                metricRows
                  .find((metric) => metric.faqId === curation.faqId)
                  ?.viewCount.toLocaleString() ?? '-'
            },
            {
              key: 'searchHitCount',
              label: '검색 유입',
              children:
                metricRows
                  .find((metric) => metric.faqId === curation.faqId)
                  ?.searchHitCount.toLocaleString() ?? '-'
            },
            {
              key: 'helpfulRatio',
              label: '도움됨 비율',
              children: formatMetricRatio(
                metricRows.find((metric) => metric.faqId === curation.faqId) ??
                  null
              )
            }
          ]}
        />
      </DetailDrawerSection>
    </DetailDrawerBody>
  ) : null}
</DetailDrawer>
  );
}
