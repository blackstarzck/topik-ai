import { Space, Typography } from 'antd';

import { getTargetTypeLabel } from '@/shared/model/target-type-label';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';

const { Text } = Typography;

// FAQ 조치 알림 description 공통 구조 — Phase 4 분해에서 빌더로 통합(렌더 결과 동일).
export function buildFaqAuditNoticeDescription(
  targetType: 'OperationFaq' | 'OperationFaqCuration',
  targetId: string,
  lines: Array<string | false>
): JSX.Element {
  return (
    <Space direction="vertical">
      <Text>대상 유형: {getTargetTypeLabel(targetType)}</Text>
      <Text>대상 ID: {targetId}</Text>
      {lines
        .filter((line): line is string => Boolean(line))
        .map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
      <AuditLogLink targetType={targetType} targetId={targetId} />
    </Space>
  );
}

export function buildFaqErrorDescription(
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
