import { Button, Descriptions, Space, Typography } from 'antd';
import { Link } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';

import {
  formatPoint,
  formatPointDelta
} from '../model/commerce-points-page-schema';
import type { DangerState } from '../model/commerce-points-page-schema';
import type {
  PointExpiration,
  PointLedger,
  PointPolicy
} from '../model/point-types';
import {
  buildExpirationSummaryItems,
  buildLedgerSummaryItems,
  buildPolicySummaryItems,
  renderLocalStatusTag,
  renderSourceReference
} from './commerce-points-render-utils';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '@/shared/ui/detail-drawer/detail-drawer';

const { Paragraph, Text } = Typography;

// 포인트 정책/원장/소멸 상세 Drawer — Phase 4 분해로 페이지 JSX 에서 통째 이동(동작 동일).
// 선택 상태·모달 오프너·위험 조치·네비게이션은 페이지가 소유해 props 로 전달한다.
export type CommercePointsDetailDrawerProps = {
  selectedPolicy: PointPolicy | null;
  selectedLedger: PointLedger | null;
  selectedExpiration: PointExpiration | null;
  closeDetail: () => void;
  openEditPolicyModal: (policy: PointPolicy) => void;
  openManualAdjustmentModal: (ledger?: PointLedger | null) => void;
  openExpirationHoldModal: (expiration?: PointExpiration | null) => void;
  setDangerState: (next: DangerState) => void;
  navigate: NavigateFunction;
};

export function CommercePointsDetailDrawer({
  selectedPolicy,
  selectedLedger,
  selectedExpiration,
  closeDetail,
  openEditPolicyModal,
  openManualAdjustmentModal,
  openExpirationHoldModal,
  setDangerState,
  navigate
}: CommercePointsDetailDrawerProps): JSX.Element {
  const selectedRecord = selectedPolicy ?? selectedLedger ?? selectedExpiration;

  return (
    <DetailDrawer
      open={Boolean(selectedRecord)}
      title={
        selectedPolicy
          ? `포인트 정책 상세 · ${selectedPolicy.id}`
          : selectedLedger
            ? `포인트 원장 상세 · ${selectedLedger.id}`
            : selectedExpiration
              ? `소멸 예정 상세 · ${selectedExpiration.id}`
              : '포인트 상세'
      }
      width={760}
      destroyOnHidden
      onClose={closeDetail}
      headerMeta={
        selectedPolicy
          ? renderLocalStatusTag(selectedPolicy.status)
          : selectedLedger
            ? renderLocalStatusTag(selectedLedger.status)
            : selectedExpiration
              ? renderLocalStatusTag(selectedExpiration.status)
              : null
      }
      footerStart={
        selectedPolicy ? (
          <AuditLogLink
            targetType="CommercePointPolicy"
            targetId={selectedPolicy.id}
          />
        ) : selectedLedger ? (
          <AuditLogLink
            targetType="CommercePointLedger"
            targetId={selectedLedger.id}
          />
        ) : selectedExpiration ? (
          <AuditLogLink
            targetType="CommercePointExpiration"
            targetId={selectedExpiration.id}
          />
        ) : null
      }
      footerEnd={
        selectedPolicy ? (
          <Space wrap>
            <Button size="large" onClick={() => openEditPolicyModal(selectedPolicy)}>
              수정
            </Button>
            <Button
              size="large"
              onClick={() =>
                setDangerState(
                  selectedPolicy.status === '운영 중'
                    ? { type: 'pause-policy', policy: selectedPolicy }
                    : { type: 'activate-policy', policy: selectedPolicy }
                )
              }
            >
              {selectedPolicy.status === '운영 중' ? '운영 중지' : '운영 시작'}
            </Button>
          </Space>
        ) : selectedLedger ? (
          <Space wrap>
            <Button
              size="large"
              onClick={() => navigate(`/users/${selectedLedger.userId}?tab=payment`)}
            >
              회원 상세로 이동
            </Button>
            <Button
              size="large"
              type="primary"
              onClick={() => openManualAdjustmentModal(selectedLedger)}
            >
              같은 회원으로 조정
            </Button>
          </Space>
        ) : selectedExpiration ? (
          <Space wrap>
            <Button
              size="large"
              onClick={() =>
                navigate(`/users/${selectedExpiration.userId}?tab=payment`)
              }
            >
              회원 상세로 이동
            </Button>
            {selectedExpiration.status === '보류' ? (
              <Button
                size="large"
                onClick={() =>
                  setDangerState({
                    type: 'release-expiration',
                    expiration: selectedExpiration
                  })
                }
              >
                보류 해제
              </Button>
            ) : (
              <Button
                size="large"
                type="primary"
                onClick={() => openExpirationHoldModal(selectedExpiration)}
              >
                보류 등록
              </Button>
            )}
          </Space>
        ) : null
      }
    >
      {selectedPolicy ? (
        <DetailDrawerBody>
          <DetailDrawerSection title="기본 정보">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={buildPolicySummaryItems(selectedPolicy)}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="적용 조건">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: 'targetCondition',
                  label: '대상 조건',
                  children: selectedPolicy.targetCondition
                },
                {
                  key: 'triggerSource',
                  label: '발생 원천',
                  children: selectedPolicy.triggerSource
                },
                {
                  key: 'duplicationRule',
                  label: '중복 방지 규칙',
                  children: selectedPolicy.duplicationRule
                }
              ]}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="적립/차감/소멸 규칙">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: 'earnDebitRule',
                  label: '적립/차감 규칙',
                  children: selectedPolicy.earnDebitRule
                },
                {
                  key: 'expirationRule',
                  label: '소멸 규칙',
                  children: selectedPolicy.expirationRule
                },
                {
                  key: 'manualAdjustmentRule',
                  label: '수동 조정 규칙',
                  children: selectedPolicy.manualAdjustmentRule
                }
              ]}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="운영 메모">
            <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
              {selectedPolicy.note}
            </Paragraph>
          </DetailDrawerSection>
        </DetailDrawerBody>
      ) : null}

      {selectedLedger ? (
        <DetailDrawerBody>
          <DetailDrawerSection title="회원 요약">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={buildLedgerSummaryItems(selectedLedger)}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="발생 정보">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: 'source',
                  label: '발생 원천',
                  children: renderSourceReference(
                    selectedLedger.sourceType,
                    selectedLedger.sourceId,
                    selectedLedger.sourceLabel
                  )
                },
                {
                  key: 'policy',
                  label: '관련 정책',
                  children: `${selectedLedger.policyName} (${selectedLedger.policyId})`
                },
                {
                  key: 'pointDelta',
                  label: '포인트 증감',
                  children: (
                    <Text strong type={selectedLedger.pointDelta < 0 ? 'danger' : undefined}>
                      {formatPointDelta(selectedLedger.pointDelta)}
                    </Text>
                  )
                },
                {
                  key: 'balanceAfter',
                  label: '처리 후 잔액',
                  children: formatPoint(selectedLedger.availableBalanceAfter)
                },
                {
                  key: 'expirationAt',
                  label: '만료 예정일',
                  children: selectedLedger.expirationAt || '-'
                }
              ]}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="사유/확인 정보">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                { key: 'reason', label: '조정 사유', children: selectedLedger.reason },
                {
                  key: 'approvalMemo',
                  label: '확인 메모',
                  children: selectedLedger.approvalMemo || '-'
                },
                {
                  key: 'actedBy',
                  label: '처리자',
                  children: selectedLedger.actedBy
                }
              ]}
            />
          </DetailDrawerSection>
        </DetailDrawerBody>
      ) : null}

      {selectedExpiration ? (
        <DetailDrawerBody>
          <DetailDrawerSection title="대상 요약">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={buildExpirationSummaryItems(selectedExpiration)}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="소멸 계산 정보">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: 'policy',
                  label: '관련 정책',
                  children: `${selectedExpiration.policyName} (${selectedExpiration.policyId})`
                },
                {
                  key: 'relatedLedgerId',
                  label: '관련 원장',
                  children: (
                    <Link
                      className="table-navigation-link"
                      to={`/commerce/points?tab=ledger&selected=${selectedExpiration.relatedLedgerId}`}
                    >
                      {selectedExpiration.relatedLedgerId}
                    </Link>
                  )
                },
                {
                  key: 'calculationMemo',
                  label: '계산 메모',
                  children: selectedExpiration.calculationMemo
                }
              ]}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="보류/처리 이력">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={[
                {
                  key: 'holdReason',
                  label: '보류 사유',
                  children: selectedExpiration.holdReason || '-'
                },
                {
                  key: 'heldBy',
                  label: '보류 담당자',
                  children: selectedExpiration.heldBy || '-'
                },
                {
                  key: 'processedAt',
                  label: '처리 시각',
                  children: selectedExpiration.processedAt || '-'
                }
              ]}
            />
          </DetailDrawerSection>
        </DetailDrawerBody>
      ) : null}
    </DetailDrawer>
  );
}
