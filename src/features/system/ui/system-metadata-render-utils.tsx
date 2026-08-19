import { Space, Tooltip, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';

import { TEXT } from '../model/system-metadata-page-schema';
import type { SystemMetadataGroup } from '../model/system-metadata-types';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';

const { Text } = Typography;

// 운영 설정 공용 렌더 헬퍼 — Phase 4 분해로 페이지 모듈에서 이동(동작 동일).
// 값 목록·도움말 라벨·조치 알림 description 을 컬럼/폼/Drawer/페이지가 함께 쓴다.

export function renderValueList(values: string[]): JSX.Element {
  if (values.length === 0) {
    return <Text type="secondary">{TEXT.none}</Text>;
  }

  return (
    <Space direction="vertical" size={4}>
      {values.map((value) => (
        <Text key={value}>{value}</Text>
      ))}
    </Space>
  );
}

export function createHelpLabel(label: string, description: string): JSX.Element {
  return (
    <Space size={4}>
      <span>{label}</span>
      <Tooltip title={description}>
        <QuestionCircleOutlined style={{ color: 'rgba(0, 0, 0, 0.45)' }} />
      </Tooltip>
    </Space>
  );
}

export function buildNotificationDescription(group: SystemMetadataGroup, reason: string): JSX.Element {
  return (
    <Space direction="vertical">
      <Text>Target Type: SystemMetadataGroup</Text>
      <Text>Target ID: {group.groupId}</Text>
      <Text>
        {TEXT.reason}: {reason}
      </Text>
      <AuditLogLink targetType="SystemMetadataGroup" targetId={group.groupId} />
    </Space>
  );
}
