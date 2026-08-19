import { Space, Typography } from 'antd';

import { getTargetTypeLabel } from '@/shared/model/target-type-label';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';

const { Text } = Typography;

// 정책 조치 알림 description 공통 구조 — Phase 4 분해에서 빌더로 통합(렌더 결과 동일).
// 성공: 대상 유형 → 대상 ID → 부가 행 → 감사 링크 / 실패: 메시지 → 오류 코드.
export function buildPolicyAuditNoticeDescription(
  policyId: string,
  lines: Array<string | false>
): JSX.Element {
  return (
    <Space direction="vertical">
      <Text>대상 유형: {getTargetTypeLabel('OperationPolicy')}</Text>
      <Text>대상 ID: {policyId}</Text>
      {lines
        .filter((line): line is string => Boolean(line))
        .map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
      <AuditLogLink targetType="OperationPolicy" targetId={policyId} />
    </Space>
  );
}

export function buildPolicyErrorDescription(
  message: string,
  code: string | null | undefined
): JSX.Element {
  return (
    <Space direction="vertical">
      <Text>{message}</Text>
      <Text type="secondary">오류 코드: {code}</Text>
    </Space>
  );
}
