import { toSafeResult, withRetry } from '@/shared/api/safe-request';
import { formatUserDisplayName } from '@/shared/ui/user/user-reference';
import { useCouponStore } from '@/features/commerce/model/coupon-store';
import { getMockUserRealName } from '@/features/users/api/users-service';
import { usePermissionStore } from '../model/permission-store';
import { useSystemMetadataStore } from '../model/system-metadata-store';
import type { SystemAuditLogRow } from '../model/system-log-types';
import { createMockSystemAuditLogs } from './mock-system-audit-logs';
import { loadSystemAuditLogsFromSupabase } from './supabase-system-audit-logs-service';
import { systemAuditLogsDataSource } from './system-audit-logs-data-source';
import { sleep } from '@/shared/api/supabase-service-utils';

function getAuditActionLabel(action: string): string {
  if (action === 'service_status_changed') {
    return '노출 상태 변경';
  }
  if (action === 'tag_assigned') {
    return '태그 부여';
  }
  if (action === 'tag_removed') {
    return '태그 제거';
  }
  if (action === 'question_institutions_changed') {
    return '기관 노출 설정 변경';
  }
  if (action === 'question_institutions_cleared') {
    return '기관 노출 설정 해제';
  }
  if (action === 'institution_exposure_mode_changed') {
    return '기관 노출 모드 변경';
  }
  if (action === 'institution_code_created') {
    return '기관 코드 생성';
  }
  if (action === 'institution_code_updated') {
    return '기관 코드 수정';
  }
  if (action === 'institution_code_deleted') {
    return '기관 코드 삭제';
  }
  if (action === 'question_received') {
    return '문항 수신';
  }
  if (action === 'tag_master_status_changed') {
    return '태그 마스터 상태 변경';
  }
  if (action === 'review_memo_saved') {
    return '검수 메모 저장';
  }
  if (action === 'review_completed') {
    return '검수 완료';
  }
  if (action === 'review_on_hold') {
    return '검수 보류';
  }
  if (action === 'review_revision_requested') {
    return '수정 요청';
  }
  if (action === 'review_status_changed') {
    return '검수 상태 변경';
  }
  if (action === 'operation_candidate_exposed') {
    return '노출 후보';
  }
  if (action === 'operation_candidate_hidden') {
    return '숨김 후보';
  }
  if (action === 'operation_excluded') {
    return '운영 제외';
  }
  return action;
}

export function decorateAuditLogAction(row: SystemAuditLogRow): SystemAuditLogRow {
  return {
    ...row,
    action: getAuditActionLabel(row.action)
  };
}

function decorateMockAuditLog(row: SystemAuditLogRow): SystemAuditLogRow {
  if (row.targetType !== 'Users') {
    return decorateAuditLogAction(row);
  }

  const userName = getMockUserRealName(row.targetId);
  return {
    ...decorateAuditLogAction(row),
    targetUserName: userName,
    targetDisplayName: userName
      ? formatUserDisplayName(userName, row.targetId)
      : row.targetId
  };
}

async function loadSystemAuditLogs(
  signal?: AbortSignal
): Promise<SystemAuditLogRow[]> {
  if (systemAuditLogsDataSource === 'supabase') {
    return loadSystemAuditLogsFromSupabase(signal);
  }

  await sleep(180, signal);

  const permissionRows: SystemAuditLogRow[] = usePermissionStore
    .getState()
    .audits.map((audit) => ({
      logId: audit.id,
      targetType: audit.targetType,
      targetId: audit.targetId,
      action: audit.action,
      actor: audit.changedBy,
      reason: audit.reason,
      createdAt: audit.createdAt
    }));

  const couponRows: SystemAuditLogRow[] = useCouponStore
    .getState()
    .audits.map((audit) => ({
      logId: audit.id,
      targetType: audit.targetType,
      targetId: audit.targetId,
      action: audit.action,
      actor: audit.changedBy,
      reason: audit.reason,
      createdAt: audit.createdAt
    }));

  const metadataRows: SystemAuditLogRow[] = useSystemMetadataStore
    .getState()
    .audits.map((audit) => ({
      logId: audit.id,
      targetType: audit.targetType,
      targetId: audit.targetId,
      action: audit.action,
      actor: audit.changedBy,
      reason: audit.reason,
      createdAt: audit.createdAt
    }));

  return [
    ...metadataRows,
    ...couponRows,
    ...permissionRows,
    ...createMockSystemAuditLogs()
  ]
    .map(decorateMockAuditLog)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function fetchSystemAuditLogsSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadSystemAuditLogs(signal), { maxRetries: 1 })
  );
}
