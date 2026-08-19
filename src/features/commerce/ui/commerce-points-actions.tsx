import { Space, Typography } from 'antd';
import type { FormInstance } from 'antd';
import type { NotificationInstance } from 'antd/es/notification/interface';
import type { Dispatch, SetStateAction } from 'react';

import {
  createManualPointAdjustmentSafe,
  exportPointExpirationsSafe,
  releasePointExpirationHoldSafe,
  savePointExpirationHoldSafe,
  savePointPolicySafe,
  updatePointPolicyStatusSafe
} from '../api/points-service';
import {
  formatPointDelta,
  getDangerCopy
} from '../model/commerce-points-page-schema';
import type {
  DangerState,
  ExpirationHoldFormValues,
  ManualAdjustmentFormValues,
  PolicyFormValues,
  PolicyModalState
} from '../model/commerce-points-page-schema';
import type { CommercePointsQuery, PointExpiration, PointLedger } from '../model/point-types';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';

const { Text } = Typography;

// 포인트 조치 실행기(변형 ⑩) — Phase 4 분해로 페이지 핸들러 본문에서 이동(동작 동일).
// 페이지가 소유한 질의·URL 갱신·상태 setter·알림 인스턴스를 컨텍스트로 주입받고,
// 실행 시점·소유권은 페이지의 3줄 위임 핸들러가 그대로 가진다.
export type PointsActionContext = {
  notificationApi: NotificationInstance;
  query: CommercePointsQuery;
  updateUrl: (nextQuery: CommercePointsQuery) => void;
  showActionError: (message: string, description?: string) => void;
  setReloadKey: Dispatch<SetStateAction<number>>;
  setPolicyModalState: Dispatch<SetStateAction<PolicyModalState>>;
  setAdjustmentModalOpen: Dispatch<SetStateAction<boolean>>;
  setAdjustmentTarget: Dispatch<SetStateAction<PointLedger | null>>;
  setExpirationHoldModalOpen: Dispatch<SetStateAction<boolean>>;
  setExpirationHoldTarget: Dispatch<SetStateAction<PointExpiration | null>>;
  setDangerState: Dispatch<SetStateAction<DangerState>>;
};

export async function runPolicySubmit(
  ctx: PointsActionContext,
  policyForm: FormInstance<PolicyFormValues>,
  policyModalState: PolicyModalState
): Promise<void> {
  const values = await policyForm.validateFields();
  const result = await savePointPolicySafe({
    policyId: policyModalState?.policy?.id,
    ...values
  });

  if (!result.ok) {
    ctx.showActionError('포인트 정책 저장에 실패했습니다.', result.error.message);
    return;
  }

  ctx.setPolicyModalState(null);
  ctx.setReloadKey((prev) => prev + 1);
  ctx.updateUrl({
    ...ctx.query,
    tab: 'policy',
    selectedId: result.data.id
  });
  ctx.notificationApi.success({
    message:
      policyModalState?.mode === 'edit'
        ? '포인트 정책을 수정했습니다.'
        : '포인트 정책을 등록했습니다.',
    description: (
      <Space direction="vertical">
        <Text>대상 유형: 포인트 정책</Text>
        <Text>대상 ID: {result.data.id}</Text>
        <AuditLogLink
          targetType="CommercePointPolicy"
          targetId={result.data.id}
        />
      </Space>
    )
  });
}

export async function runManualAdjustmentSubmit(
  ctx: PointsActionContext,
  adjustmentForm: FormInstance<ManualAdjustmentFormValues>
): Promise<void> {
  const values = await adjustmentForm.validateFields();
  const result = await createManualPointAdjustmentSafe({
    userId: values.userId.trim(),
    userName: values.userName.trim(),
    ledgerType: values.ledgerType,
    amount: values.amount,
    approvalMemo: values.approvalMemo,
    reason: values.reason
  });

  if (!result.ok) {
    ctx.showActionError('포인트 수동 조정에 실패했습니다.', result.error.message);
    return;
  }

  ctx.setAdjustmentModalOpen(false);
  ctx.setAdjustmentTarget(null);
  ctx.setReloadKey((prev) => prev + 1);
  ctx.updateUrl({
    ...ctx.query,
    tab: 'ledger',
    selectedId: result.data.id
  });
  ctx.notificationApi.success({
    message: '포인트 수동 조정을 등록했습니다.',
    description: (
      <Space direction="vertical">
        <Text>대상 유형: 포인트 원장</Text>
        <Text>대상 ID: {result.data.id}</Text>
        <Text>회원: {result.data.userName} ({result.data.userId})</Text>
        <Text>조정 포인트: {formatPointDelta(result.data.pointDelta)}</Text>
        <AuditLogLink
          targetType="CommercePointLedger"
          targetId={result.data.id}
        />
      </Space>
    )
  });
}

export async function runExpirationHoldSubmit(
  ctx: PointsActionContext,
  expirationHoldForm: FormInstance<ExpirationHoldFormValues>
): Promise<void> {
  const values = await expirationHoldForm.validateFields();
  const result = await savePointExpirationHoldSafe({
    expirationId: values.expirationId,
    holdReason: values.holdReason
  });

  if (!result.ok) {
    ctx.showActionError('소멸 보류 등록에 실패했습니다.', result.error.message);
    return;
  }

  ctx.setExpirationHoldModalOpen(false);
  ctx.setExpirationHoldTarget(null);
  ctx.setReloadKey((prev) => prev + 1);
  ctx.updateUrl({
    ...ctx.query,
    tab: 'expiration',
    selectedId: result.data.id
  });
  ctx.notificationApi.success({
    message: '소멸 보류를 등록했습니다.',
    description: (
      <Space direction="vertical">
        <Text>대상 유형: 포인트 소멸</Text>
        <Text>대상 ID: {result.data.id}</Text>
        <AuditLogLink
          targetType="CommercePointExpiration"
          targetId={result.data.id}
        />
      </Space>
    )
  });
}

export async function runDangerConfirm(
  ctx: PointsActionContext,
  dangerState: DangerState,
  reason: string
): Promise<void> {
  if (!dangerState) {
    return;
  }

  if (
    dangerState.type === 'activate-policy' ||
    dangerState.type === 'pause-policy'
  ) {
    const result = await updatePointPolicyStatusSafe({
      policyId: dangerState.policy.id,
      nextStatus:
        dangerState.type === 'activate-policy' ? '운영 중' : '중지',
      reason
    });

    if (!result.ok) {
      ctx.showActionError('포인트 정책 상태 변경에 실패했습니다.', result.error.message);
      return;
    }

    ctx.setDangerState(null);
    ctx.setReloadKey((prev) => prev + 1);
    ctx.updateUrl({
      ...ctx.query,
      tab: 'policy',
      selectedId: result.data.id
    });
    ctx.notificationApi.success({
      message: getDangerCopy(dangerState).successMessage,
      description: (
        <Space direction="vertical">
          <Text>대상 유형: 포인트 정책</Text>
          <Text>대상 ID: {result.data.id}</Text>
          <Text>사유/근거: {reason}</Text>
          <AuditLogLink
            targetType="CommercePointPolicy"
            targetId={result.data.id}
          />
        </Space>
      )
    });
    return;
  }

  const result = await releasePointExpirationHoldSafe({
    expirationId: dangerState.expiration.id,
    reason
  });

  if (!result.ok) {
    ctx.showActionError('소멸 보류 해제에 실패했습니다.', result.error.message);
    return;
  }

  ctx.setDangerState(null);
  ctx.setReloadKey((prev) => prev + 1);
  ctx.updateUrl({
    ...ctx.query,
    tab: 'expiration',
    selectedId: result.data.id
  });
  ctx.notificationApi.success({
    message: getDangerCopy(dangerState).successMessage,
    description: (
      <Space direction="vertical">
        <Text>대상 유형: 포인트 소멸</Text>
        <Text>대상 ID: {result.data.id}</Text>
        <Text>사유/근거: {reason}</Text>
        <AuditLogLink
          targetType="CommercePointExpiration"
          targetId={result.data.id}
        />
      </Space>
    )
  });
}

export async function runExportExpirations(
  ctx: PointsActionContext,
  itemCount: number
): Promise<void> {
  const result = await exportPointExpirationsSafe({
    itemCount: itemCount
  });

  if (!result.ok) {
    ctx.showActionError('소멸 예정 내역 내보내기에 실패했습니다.', result.error.message);
    return;
  }

  ctx.notificationApi.success({
    message: '소멸 예정 내역을 내보냈습니다.',
    description: `${result.data.exportedAt} 기준 ${result.data.itemCount.toLocaleString()}건`
  });
}
