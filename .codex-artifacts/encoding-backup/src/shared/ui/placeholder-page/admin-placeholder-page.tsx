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
            message="硫붾돱 ?먮━ ?좎젏 상태"
            description="상세 湲곕뒫 ?뺤쓽 ?꾩씠吏留??뺣낫援ъ“? 沅뚰븳 泥닿퀎瑜?癒쇱? 怨좎젙?섍린 ?꾪빐 placeholder ?붾㈃?쇰줈 ?곌껐?덉뒿?덈떎."
          />
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>
              ?붾㈃ 紐⑹쟻
            </Title>
            <Paragraph style={{ marginBottom: 0 }}>{summary}</Paragraph>
          </div>
          <div>
            <Title level={5} style={{ marginBottom: 8 }}>
              沅뚰븳 ?꾨낫
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
                ?덉젙 湲곕뒫
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
                硫붾え
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
            description="?몃? ??ぉ, ?? ?≪뀡 ?뚮줈?곕뒗 異뷀썑 ?붽뎄?ы빆???뺤젙?섎㈃ ???붾㈃?먯꽌 ?뺤옣?⑸땲??"
          />
        </Space>
      </Card>
    </div>
  );
}


