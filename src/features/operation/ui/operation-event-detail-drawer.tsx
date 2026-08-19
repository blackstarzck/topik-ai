import { Alert, Button, Descriptions, Space, Tag, Typography } from 'antd';

import type { OperationEvent } from '../model/types';
import type { EventActionState } from '../model/operation-events-page-schema';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '@/shared/ui/detail-drawer/detail-drawer';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';

const { Paragraph } = Typography;

// 이벤트 상세 Drawer — Phase 4 분해로 페이지 본문에서 이동(레이아웃·조치 동일).
// 열림 판정·조치 확정·미리보기/수정 이동은 페이지가 소유하고 콜백으로 받는다.
export type OperationEventDetailDrawerProps = {
  event: OperationEvent | null;
  onClose: () => void;
  onPreview: (event: OperationEvent) => void;
  onEdit: (event: OperationEvent) => void;
  onAction: (type: NonNullable<EventActionState>['type'], event: OperationEvent) => void;
};

export function OperationEventDetailDrawer({
  event: selectedEvent,
  onClose,
  onPreview,
  onEdit,
  onAction
}: OperationEventDetailDrawerProps): JSX.Element {
  return (
    <DetailDrawer
      open={Boolean(selectedEvent)}
      title={selectedEvent ? `이벤트 상세 · ${selectedEvent.id}` : '이벤트 상세'}
      onClose={onClose}
      destroyOnHidden
      width={760}
      headerMeta={
        selectedEvent ? (
          <Space wrap size={8}>
            <StatusBadge status={selectedEvent.progressStatus} />
            <StatusBadge status={selectedEvent.visibilityStatus} />
            <Tag color="blue">{selectedEvent.eventType}</Tag>
          </Space>
        ) : null
      }
      footerStart={
        selectedEvent ? (
          <AuditLogLink targetType="OperationEvent" targetId={selectedEvent.id} />
        ) : null
      }
      footerEnd={
        selectedEvent ? (
          <Space wrap>
            <Button size="large" onClick={() => onPreview(selectedEvent)}>
              미리보기
            </Button>
            <Button size="large" onClick={() => onEdit(selectedEvent)}>
              수정
            </Button>
            <Button
              size="large"
              disabled={
                selectedEvent.progressStatus === '종료' ||
                selectedEvent.visibilityStatus === '예약'
              }
              onClick={() => onAction('schedule', selectedEvent)}
            >
              게시 예약
            </Button>
            <Button
              size="large"
              disabled={
                selectedEvent.progressStatus === '종료' ||
                selectedEvent.visibilityStatus === '노출'
              }
              onClick={() => onAction('publish', selectedEvent)}
            >
              즉시 게시
            </Button>
            <Button
              size="large"
              danger
              disabled={selectedEvent.progressStatus === '종료'}
              onClick={() => onAction('end', selectedEvent)}
            >
              종료
            </Button>
          </Space>
        ) : null
      }
    >
      {selectedEvent ? (
        <DetailDrawerBody>
          <Alert
            type={selectedEvent.progressStatus === '종료' ? 'warning' : 'info'}
            showIcon
            message={
              selectedEvent.progressStatus === '종료'
                ? '종료된 이벤트입니다.'
                : '이벤트 운영 정보를 확인하세요.'
            }
            description={
              selectedEvent.progressStatus === '종료'
                ? '종료된 이벤트는 자동으로 숨김 상태로 유지됩니다. 재사용이 필요하면 이벤트를 복제해 새로 등록하세요.'
                : '조치 후에는 감사 로그에서 대상 유형, 대상 ID, 수행 사유를 함께 검수하세요.'
            }
          />

          <DetailDrawerSection title="기본 정보">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: 'id', label: '이벤트 ID', children: selectedEvent.id },
                { key: 'title', label: '이벤트명', children: selectedEvent.title },
                { key: 'period', label: '진행 기간', children: `${selectedEvent.startAt} ~ ${selectedEvent.endAt}` },
                { key: 'visibility', label: '노출 상태', children: <StatusBadge status={selectedEvent.visibilityStatus} /> },
                { key: 'channels', label: '노출 위치', children: selectedEvent.exposureChannels.join(', ') },
                {
                  key: 'bannerCount',
                  label: '배너 이미지',
                  children: selectedEvent.bannerImages.length
                    ? `총 ${selectedEvent.bannerImages.length}개 · 대표 ${selectedEvent.bannerImageFileName || '첨부 이미지'}`
                    : '미등록'
                }
              ]}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="이벤트 요약">
            <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
              {selectedEvent.summary}
            </Paragraph>
          </DetailDrawerSection>

          <DetailDrawerSection title="참여 조건">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: 'targetGroup', label: '대상 그룹', children: selectedEvent.targetGroupName },
                { key: 'targetGroupId', label: '대상 그룹 ID', children: selectedEvent.targetGroupId }
              ]}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="참여 현황">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: 'participants', label: '참여자 수', children: `${selectedEvent.participantCount.toLocaleString()}명` },
                {
                  key: 'participantLimit',
                  label: '참여 제한',
                  children: selectedEvent.participantLimit
                    ? `${selectedEvent.participantLimit.toLocaleString()}명`
                    : '제한 없음'
                }
              ]}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="보상 정책">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: 'rewardType', label: '보상 유형', children: selectedEvent.rewardType },
                { key: 'rewardPolicyId', label: '보상 정책 ID', children: selectedEvent.rewardPolicyId || '미입력' },
                { key: 'rewardPolicyName', label: '보상 정책명', children: selectedEvent.rewardPolicyName || '미입력' },
                { key: 'rewardSummary', label: '보상 요약', children: selectedEvent.rewardPolicySummary }
              ]}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="메시지 및 SEO">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: 'messageTemplateId', label: '메시지 템플릿 ID', children: selectedEvent.messageTemplateId || '미연결' },
                { key: 'messageTemplateName', label: '메시지 템플릿', children: selectedEvent.messageTemplateName || '미연결' },
                { key: 'slug', label: '슬러그', children: selectedEvent.slug },
                { key: 'metaTitle', label: '공유 제목', children: selectedEvent.metaTitle || '자동 생성' },
                { key: 'metaDescription', label: '공유 설명', children: selectedEvent.metaDescription || '자동 생성' },
                { key: 'canonicalUrl', label: '대표 URL', children: selectedEvent.canonicalUrl || '자동 생성' },
                { key: 'indexingPolicy', label: '인덱싱 정책', children: selectedEvent.indexingPolicy }
              ]}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="운영 메모">
            <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
              {selectedEvent.adminMemo || '등록된 운영 메모가 없습니다.'}
            </Paragraph>
          </DetailDrawerSection>
        </DetailDrawerBody>
      ) : null}
    </DetailDrawer>
  );
}
