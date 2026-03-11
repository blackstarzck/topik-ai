import { Alert, Card, Empty, Space, Tag, Typography } from 'antd';

import { PageTitle } from '../page-title/page-title';

const { Paragraph, Text, Title } = Typography;

type AdminPlaceholderPageProps = {
  title: string;
  summary: string;
  ownerRole: string;
  supportingRoles?: string[];
  capabilities?: string[];
  notes?: string[];
};

export default function AdminPlaceholderPage({
  title,
  summary,
  ownerRole,
  supportingRoles = [],
  capabilities = [],
  notes = []
}: AdminPlaceholderPageProps): JSX.Element {
  return (
    <div>
      <PageTitle title={title} />
      <Card>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="메뉴 자리 선점 상태"
            description="상세 기능 정의 전이지만 정보구조와 권한 체계를 먼저 고정하기 위해 placeholder 화면으로 연결했습니다."
          />
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>
              화면 목적
            </Title>
            <Paragraph style={{ marginBottom: 0 }}>{summary}</Paragraph>
          </div>
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>
              권한 후보
            </Title>
            <Space wrap>
              <Tag color="blue">{ownerRole}</Tag>
              {supportingRoles.map((role) => (
                <Tag key={role}>{role}</Tag>
              ))}
            </Space>
          </div>
          {capabilities.length > 0 ? (
            <div>
              <Title level={5} style={{ marginBottom: 8 }}>
                예정 기능
              </Title>
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                {capabilities.map((capability) => (
                  <li key={capability} style={{ marginBottom: 6 }}>
                    <Text>{capability}</Text>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {notes.length > 0 ? (
            <div>
              <Title level={5} style={{ marginBottom: 8 }}>
                메모
              </Title>
              <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                {notes.map((note) => (
                  <li key={note} style={{ marginBottom: 6 }}>
                    <Text type="secondary">{note}</Text>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="세부 항목, 폼, 액션 플로우는 추후 요구사항이 확정되면 이 화면에서 확장합니다."
          />
        </Space>
      </Card>
    </div>
  );
}
