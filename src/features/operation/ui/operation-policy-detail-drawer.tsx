import { Alert, Button, Descriptions, Space, Typography } from 'antd';
import { useMemo } from 'react';

import type { AsyncState } from '@/shared/model/async-state';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '@/shared/ui/detail-drawer/detail-drawer';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';

import type {
  OperationPolicy,
  OperationPolicyHistoryEntry
} from '../model/policy-types';
import {
  createPolicyHistoryColumns,
  renderPolicyHistoryExpandedRow
} from './operation-policies-columns';

const { Paragraph, Text } = Typography;

// 정책 상세 Drawer — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 선택 정책·히스토리 조회 상태·조치 핸들러는 페이지가 소유하고 props 로 받는다.
// 히스토리 컬럼은 선택 정책에서 파생되므로 Drawer 내부에서 계산한다.

export type OperationPolicyDetailDrawerProps = {
  policy: OperationPolicy | null;
  historyState: AsyncState<OperationPolicyHistoryEntry[]>;
  onClose: () => void;
  onOpenPreview: (policy: OperationPolicy) => void;
  onEdit: (policy: OperationPolicy) => void;
  onCreateVersion: (policy: OperationPolicy) => void;
  onSendNotification: (policy: OperationPolicy) => void;
  onToggleStatus: (policy: OperationPolicy) => void;
  onDelete: (policy: OperationPolicy) => void;
  onReloadHistory: () => void;
  onOpenHistoryPreview: (entry: OperationPolicyHistoryEntry) => void;
  onPublishHistoryVersion: (
    policy: OperationPolicy,
    entry: OperationPolicyHistoryEntry
  ) => void;
};

export function OperationPolicyDetailDrawer({
  policy,
  historyState,
  onClose,
  onOpenPreview,
  onEdit,
  onCreateVersion,
  onSendNotification,
  onToggleStatus,
  onDelete,
  onReloadHistory,
  onOpenHistoryPreview,
  onPublishHistoryVersion
}: OperationPolicyDetailDrawerProps): JSX.Element {
  const historyColumns = useMemo(
    () =>
      createPolicyHistoryColumns({
        selectedPolicy: policy,
        onOpenHistoryPreview,
        onPublishHistoryVersion
      }),
    [onOpenHistoryPreview, onPublishHistoryVersion, policy]
  );

  return (
<DetailDrawer
  open={Boolean(policy)}
  title={policy ? `정책 상세 · ${policy.id}` : '정책 상세'}
  onClose={onClose}
  destroyOnHidden
  width={760}
  headerMeta={
    policy ? (
      <AuditLogLink
        targetType="OperationPolicy"
        targetId={policy.id}
      />
    ) : null
  }
  footerEnd={
    policy ? (
      <Space wrap>
        <Button
          size="large"
          onClick={() => onOpenPreview(policy)}
        >
          본문 미리보기
        </Button>
        <Button
          type="primary"
          size="large"
          onClick={() => onEdit(policy)}
        >
          내용 수정
        </Button>
        <Button
          size="large"
          onClick={() => onCreateVersion(policy)}
        >
          새 버전 등록
        </Button>
        {(policy.policyType === '이용약관' ||
          policy.policyType === '개인정보 처리방침') &&
        policy.status === '게시' ? (
          <Button
            size="large"
            onClick={() => onSendNotification(policy)}
          >
            사용자에게 알림
          </Button>
        ) : null}
        <Button size="large" onClick={() => onToggleStatus(policy)}>
          {policy.status === '게시' ? '숨김' : '게시'}
        </Button>
        <Button
          danger
          size="large"
          onClick={() => onDelete(policy)}
        >
          정책 삭제
        </Button>
      </Space>
    ) : null
  }
>
  {policy ? (
    <DetailDrawerBody>
      <Alert
        type={
          policy.trackingStatus === '정책 미확정'
            ? 'warning'
            : policy.requiresConsent
              ? 'info'
              : 'success'
        }
        showIcon
        message={
          policy.trackingStatus === '정책 미확정'
            ? '정책 미확정 문서입니다.'
            : policy.requiresConsent
              ? '동의 화면과 함께 검수해야 하는 문서입니다.'
              : '운영 기준 문서입니다.'
        }
        description={
          policy.trackingStatus === '정책 미확정'
            ? '현재는 문서/IA 기준으로만 추적 중이며, 관련 화면 구현 또는 승인 체계 확정이 필요합니다.'
            : policy.requiresConsent
              ? '회원가입/결제/마이페이지에 실제 노출되는 동의 문구와 시행일, 버전이 일치하는지 확인하세요.'
              : '관련 관리자 화면과 근거 문서가 최신 코드베이스와 일치하는지 함께 검수하세요.'
        }
      />

      <DetailDrawerSection title="기본 정보">
        <Descriptions
          bordered
          size="small"
          column={1}
          items={[
            { key: 'id', label: '정책 ID', children: policy.id },
            {
              key: 'category',
              label: '운영 영역',
              children: policy.category
            },
            {
              key: 'policyType',
              label: '정책 유형',
              children: policy.policyType
            },
            { key: 'title', label: '문서명', children: policy.title },
            { key: 'versionLabel', label: '버전', children: policy.versionLabel },
            {
              key: 'effectiveDate',
              label: '시행일',
              children: policy.effectiveDate
            },
            { key: 'status', label: '상태', children: policy.status },
            {
              key: 'trackingStatus',
              label: '추적 상태',
              children: policy.trackingStatus
            },
            {
              key: 'requiresConsent',
              label: '동의 필요',
              children: policy.requiresConsent ? '예' : '아니오'
            },
            {
              key: 'exposureSurfaces',
              label: '노출 위치',
              children: policy.exposureSurfaces.join(', ')
            },
            {
              key: 'updatedAt',
              label: '최근 수정',
              children: `${policy.updatedAt} · ${policy.updatedBy}`
            }
          ]}
        />
      </DetailDrawerSection>

      <DetailDrawerSection title="정책 요약">
        <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
          {policy.summary}
        </Paragraph>
      </DetailDrawerSection>

      <DetailDrawerSection title="운영 범위 및 추적 근거">
        <Descriptions
          bordered
          size="small"
          column={1}
          items={[
            {
              key: 'relatedAdminPages',
              label: '연관 관리자 화면',
              children:
                policy.relatedAdminPages.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {policy.relatedAdminPages.map((pageName) => (
                      <li key={pageName}>{pageName}</li>
                    ))}
                  </ul>
                ) : (
                  '등록된 연관 화면이 없습니다.'
                )
            },
            {
              key: 'relatedUserPages',
              label: '연관 사용자 화면',
              children:
                policy.relatedUserPages.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {policy.relatedUserPages.map((pageName) => (
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
              children:
                policy.sourceDocuments.length > 0 ? (
                  <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                    {policy.sourceDocuments.map((documentPath) => (
                      <li key={documentPath}>
                        <Text code>{documentPath}</Text>
                      </li>
                    ))}
                  </ul>
                ) : (
                  '등록된 근거 문서가 없습니다.'
                )
            }
          ]}
        />
      </DetailDrawerSection>

      <DetailDrawerSection title="법령 및 근거">
        {policy.legalReferences.length > 0 ? (
          <ul style={{ margin: 0, paddingInlineStart: 18 }}>
            {policy.legalReferences.map((reference) => (
              <li key={reference}>{reference}</li>
            ))}
          </ul>
        ) : (
          <Text type="secondary">등록된 법령/근거가 없습니다.</Text>
        )}
      </DetailDrawerSection>

      <DetailDrawerSection title="관리자 메모">
        <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
          {policy.adminMemo || '등록된 관리자 메모가 없습니다.'}
        </Paragraph>
      </DetailDrawerSection>

      <DetailDrawerSection
        title="정책 히스토리"
        actions={
          historyState.status === 'error' ? (
            <Button size="small" onClick={onReloadHistory}>
              다시 시도
            </Button>
          ) : null
        }
      >
        <Space direction="vertical" size={12} style={{ display: 'flex' }}>
          {historyState.status === 'pending' ? (
            <Alert
              type="info"
              showIcon
              message="정책 히스토리를 불러오는 중입니다."
              description="마지막 성공 상태가 있으면 같은 Drawer 안에서 계속 확인할 수 있습니다."
            />
          ) : null}

          {historyState.status === 'error' ? (
            <Alert
              type="error"
              showIcon
              message="정책 히스토리를 불러오지 못했습니다."
              description={
                <Space direction="vertical">
                  <Text>
                    {historyState.errorMessage ??
                      '일시적인 오류가 발생했습니다.'}
                  </Text>
                  {historyState.errorCode ? (
                    <Text type="secondary">
                      오류 코드: {historyState.errorCode}
                    </Text>
                  ) : null}
                </Space>
              }
            />
          ) : null}

          {historyState.status === 'empty' ? (
            <Alert
              type="info"
              showIcon
              message="등록된 정책 히스토리가 없습니다."
              description="최초 등록 이후 조치가 누적되면 이 테이블에 변경 이력이 추가됩니다."
            />
          ) : null}

          <Text type="secondary">
            행을 펼치면 해당 시점의 정책 스냅샷을 확인할 수 있습니다. 하단
            관리 버튼은 현재 선택된 정책 기준으로 동작합니다.
          </Text>

          <AdminDataTable<OperationPolicyHistoryEntry>
            rowKey="id"
            pagination={false}
            scroll={{ x: 1080 }}
            loading={historyState.status === 'pending'}
            columns={historyColumns}
            dataSource={historyState.data}
            expandable={{
              fixed: 'left',
              expandRowByClick: true,
              expandedRowRender: renderPolicyHistoryExpandedRow,
              rowExpandable: () => true
            }}
          />
        </Space>
      </DetailDrawerSection>
    </DetailDrawerBody>
  ) : null}
</DetailDrawer>
  );
}
