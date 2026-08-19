import { Space, Typography } from 'antd';

import { getTargetTypeLabel } from '@/shared/model/target-type-label';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';

const { Text } = Typography;

// 템플릿 조치 알림의 description 공통 구조(대상 유형 → 대상 ID → 부가 행 → 감사 링크).
// 페이지 안에서 7곳이 같은 구조를 반복해 Phase 4 분해에서 빌더로 통합(렌더 결과 동일).
// 부가 행은 문자열로 받고, 조건부 행은 false 를 걸러낸다.
export function buildMessageAuditNoticeDescription(
  targetId: string,
  lines: Array<string | false>
): JSX.Element {
  return (
    <Space direction="vertical">
      <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
      <Text>대상 ID: {targetId}</Text>
      {lines
        .filter((line): line is string => Boolean(line))
        .map((line, index) => (
          <Text key={index}>{line}</Text>
        ))}
      <AuditLogLink targetType="Message" targetId={targetId} />
    </Space>
  );
}
