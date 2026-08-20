import { Alert, Button, Descriptions, Space, Tag, Typography } from 'antd';
import type { DescriptionsProps } from 'antd';
import { useMemo } from 'react';

import { buildPolicyItems } from '../model/users-referrals-page-schema';
import type {
  ReferralRewardLedgerEntry,
  ReferralSummary
} from '../model/referrals-types';
import {
  createReferralRelationColumns,
  createReferralRewardLedgerColumns,
  renderAnomalyTag
} from './users-referrals-columns';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '@/shared/ui/detail-drawer/detail-drawer';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import {
  createDrawerTableScroll,
  DRAWER_TABLE_PAGINATION,
  fixDrawerTableFirstColumn
} from '@/shared/ui/table/drawer-table';
import { UserNavigationLink } from '@/shared/ui/user/user-reference';
import { SPACE } from '@/shared/styles/design-tokens';

const { Paragraph, Title } = Typography;

// 추천 코드 상세 Drawer — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 선택 대상과 조치 핸들러는 페이지가 소유하고 props 로 받는다. 보상 원장 그룹·
// 상태 경보·컬럼은 선택 대상에서 파생되므로 Drawer 내부에서 계산한다.

function buildBasicInfoItems(
  referral: ReferralSummary
): DescriptionsProps['items'] {
  return [
    { key: 'id', label: '추천 코드 ID', children: referral.id },
    { key: 'code', label: '추천 코드', children: referral.code },
    {
      key: 'referrer',
      label: '추천인 회원',
      children: (
        <UserNavigationLink
          userId={referral.referrerUserId}
          userName={referral.referrerName}
        />
      )
    },
    { key: 'email', label: '추천인 이메일', children: referral.referrerEmail },
    {
      key: 'status',
      label: '코드 상태',
      children: <StatusBadge status={referral.status} />
    },
    { key: 'createdAt', label: '생성일', children: referral.createdAt },
    { key: 'expiresAt', label: '만료일', children: referral.expiresAt },
    { key: 'lastUsedAt', label: '최근 사용일', children: referral.lastUsedAt },
    {
      key: 'lastActionAt',
      label: '최근 조치일',
      children: referral.lastActionAt
    }
  ];
}

export type ReferralDetailDrawerProps = {
  referral: ReferralSummary | null;
  onClose: () => void;
  onOpenPoints: (userId: string) => void;
  onOpenAdjustment: (referral: ReferralSummary) => void;
  onReviewAnomaly: (referral: ReferralSummary) => void;
  onDeactivate: (referral: ReferralSummary) => void;
  onActivate: (referral: ReferralSummary) => void;
};

export function ReferralDetailDrawer({
  referral,
  onClose,
  onOpenPoints,
  onOpenAdjustment,
  onReviewAnomaly,
  onDeactivate,
  onActivate
}: ReferralDetailDrawerProps): JSX.Element {
  const rewardGroups = useMemo(() => {
  if (!referral) {
    return {
      relationEntryMap: new Map<string, ReferralRewardLedgerEntry[]>(),
      codeLevelEntries: [] as ReferralRewardLedgerEntry[]
    };
  }

  const relationEntryMap = new Map<string, ReferralRewardLedgerEntry[]>();
  const relationIds = new Set(
    referral.relations.map((relation) => relation.id)
  );

  referral.relations.forEach((relation) => {
    relationEntryMap.set(relation.id, []);
  });

  const codeLevelEntries: ReferralRewardLedgerEntry[] = [];

  referral.rewardLedger.forEach((entry) => {
    if (entry.relationId && relationIds.has(entry.relationId)) {
      relationEntryMap.get(entry.relationId)?.push(entry);
      return;
    }

    codeLevelEntries.push(entry);
  });

  return { relationEntryMap, codeLevelEntries };
  }, [referral]);

  const relationColumns = useMemo(
    () => createReferralRelationColumns(rewardGroups.relationEntryMap),
    [rewardGroups.relationEntryMap]
  );
  const rewardLedgerColumns = useMemo(() => createReferralRewardLedgerColumns(), []);
  const codeLevelRewardLedgerColumns = useMemo(
    () => fixDrawerTableFirstColumn<ReferralRewardLedgerEntry>(rewardLedgerColumns),
    [rewardLedgerColumns]
  );

  const statusAlert = useMemo(() => {
  if (!referral) {
    return null;
  }
  if (referral.anomalyStatus === '검토 필요') {
    return {
      type: 'warning' as const,
      message: '이상치 검토가 필요한 추천 코드입니다.',
      description:
        '추천 관계와 보상 원장을 함께 확인한 뒤 검토 완료 또는 코드 상태 변경을 진행하세요.'
    };
  }
  if (referral.status === '비활성') {
    return {
      type: 'info' as const,
      message: '현재 비활성 상태의 추천 코드입니다.',
      description:
        '사용자 화면에서는 코드 입력이 차단될 가능성이 있으므로 만료/비활성 안내 문구 설계와 함께 확인해야 합니다.'
    };
  }
  return {
    type: 'info' as const,
    message: '추천 정책 일부가 아직 미확정입니다.',
    description:
      '추천 확정 시점, 보상 수단, 수동 보정 권한, 회수 규칙은 가정값 기준으로 표시됩니다.'
  };
  }, [referral]);

  return (
    <DetailDrawer
      open={Boolean(referral)}
      title={
        referral
          ? `추천 코드 상세 · ${referral.code}`
          : '추천 코드 상세'
      }
      width={720}
      onClose={onClose}
      headerMeta={
        referral ? (
          <Space>
            <StatusBadge status={referral.status} />
            {renderAnomalyTag(
              referral.anomalyStatus,
              referral.anomalyFlags.length
            )}
          </Space>
        ) : null
      }
      footerStart={
        referral ? (
          <AuditLogLink
            targetType="Referral"
            targetId={referral.id}
          />
        ) : null
      }
      footerEnd={
        referral ? (
          <Space wrap>
            <Button
              onClick={() => onOpenPoints(referral.referrerUserId)}
            >
              포인트 관리 이동
            </Button>
            <Button onClick={() => onOpenAdjustment(referral)}>
              보상 조정
            </Button>
            {referral.anomalyStatus === '검토 필요' ? (
              <Button onClick={() => onReviewAnomaly(referral)}>
                이상치 검토 완료
              </Button>
            ) : null}
            {referral.status === '활성' ? (
              <Button
                danger
                type="primary"
                onClick={() => onDeactivate(referral)}
              >
                코드 비활성화
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={() => onActivate(referral)}
              >
                코드 재활성화
              </Button>
            )}
          </Space>
        ) : null
      }
    >
      {referral ? (
        <DetailDrawerBody>
          {statusAlert ? (
            <Alert
              type={statusAlert.type}
              showIcon
              message={statusAlert.message}
              description={statusAlert.description}
            />
          ) : null}

          <DetailDrawerSection title="기본 정보">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={buildBasicInfoItems(referral)}
            />
          </DetailDrawerSection>

          <DetailDrawerSection title="추천 관계 및 보상">
            <AdminDataTable
              rowKey={(relation) => relation.id}
              columns={relationColumns}
              dataSource={referral.relations}
              pagination={DRAWER_TABLE_PAGINATION}
              scroll={createDrawerTableScroll(960)}
              locale={{ emptyText: '추천 관계가 없습니다.' }}
              expandable={{
                fixed: 'left',
                rowExpandable: (relation) =>
                  (rewardGroups.relationEntryMap.get(relation.id) ?? [])
                    .length > 0,
                expandedRowRender: (relation) => {
                  const relationEntries =
                    rewardGroups.relationEntryMap.get(relation.id) ??
                    [];

                  return (
                    <AdminDataTable
                      rowKey={(entry) => entry.id}
                      columns={rewardLedgerColumns}
                      dataSource={relationEntries}
                      pagination={false}
                      scroll={createDrawerTableScroll(720)}
                      locale={{ emptyText: '이 관계에 연결된 원장 이력이 없습니다.' }}
                    />
                  );
                }
              }}
            />
            {rewardGroups.codeLevelEntries.length > 0 ? (
              <div style={{ marginTop: SPACE.base }}>
                <Title level={5} style={{ marginTop: 0, marginBottom: SPACE.xs }}>
                  코드 단위 조정
                </Title>
                <AdminDataTable
                  rowKey={(entry) => entry.id}
                  columns={codeLevelRewardLedgerColumns}
                  dataSource={rewardGroups.codeLevelEntries}
                  pagination={DRAWER_TABLE_PAGINATION}
                  scroll={createDrawerTableScroll(720)}
                  locale={{ emptyText: '코드 단위 조정이 없습니다.' }}
                />
              </div>
            ) : null}
          </DetailDrawerSection>

          <DetailDrawerSection title="정책 스냅샷">
            <Descriptions
              bordered
              size="small"
              column={1}
              items={buildPolicyItems(referral)}
            />
            <Paragraph type="secondary" style={{ marginTop: SPACE.xs, marginBottom: 0 }}>
              {referral.policySnapshot.note}
            </Paragraph>
          </DetailDrawerSection>

          <DetailDrawerSection title="이상치 및 운영 메모">
            <Space wrap style={{ marginBottom: SPACE.xs }}>
              {referral.anomalyFlags.length > 0 ? (
                referral.anomalyFlags.map((flag) => (
                  <Tag color="volcano" key={flag}>
                    {flag}
                  </Tag>
                ))
              ) : (
                <Tag>이상치 플래그 없음</Tag>
              )}
            </Space>
            <Paragraph style={{ marginBottom: 0 }}>
              {referral.adminMemo}
            </Paragraph>
          </DetailDrawerSection>
        </DetailDrawerBody>
      ) : null}
    </DetailDrawer>
  );
}
