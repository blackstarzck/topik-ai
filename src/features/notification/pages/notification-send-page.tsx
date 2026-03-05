import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Typography,
  message
} from 'antd';
import type { Dayjs } from 'dayjs';
import { useMemo } from 'react';

import { PageTitle } from '../../../shared/ui/page-title/page-title';

const { Paragraph, Text } = Typography;

type NotificationSendForm = {
  title: string;
  content: string;
  target: string;
  channel: 'push' | 'email';
  sendMode: 'instant' | 'scheduled';
  scheduleAt?: Dayjs;
};

export default function NotificationSendPage(): JSX.Element {
  const [form] = Form.useForm<NotificationSendForm>();
  const [messageApi, contextHolder] = message.useMessage();

  const sendMode = Form.useWatch('sendMode', form);

  const actionLabel = useMemo(
    () => (sendMode === 'scheduled' ? '예약 발송' : '즉시 발송'),
    [sendMode]
  );

  const handleSubmit = async (): Promise<void> => {
    const values = await form.validateFields();
    const modeLabel = values.sendMode === 'scheduled' ? '예약' : '즉시';

    messageApi.success(
      `${values.channel.toUpperCase()} ${modeLabel} 발송 요청이 등록되었습니다.`
    );
  };

  return (
    <div>
      {contextHolder}
      <PageTitle title="알림 발송" />
      <Paragraph className="page-description">
        알림 제목, 내용, 발송 대상, 채널, 즉시/예약 발송을 설정합니다.
      </Paragraph>

      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            target: 'all',
            channel: 'push',
            sendMode: 'instant'
          }}
        >
          <Form.Item
            label="알림 제목"
            name="title"
            rules={[{ required: true, message: '알림 제목을 입력하세요.' }]}
          >
            <Input placeholder="예: 정기 점검 안내" />
          </Form.Item>

          <Form.Item
            label="알림 내용"
            name="content"
            rules={[{ required: true, message: '알림 내용을 입력하세요.' }]}
          >
            <Input.TextArea rows={5} placeholder="알림 메시지를 입력하세요." />
          </Form.Item>

          <Form.Item
            label="발송 대상"
            name="target"
            rules={[{ required: true, message: '발송 대상을 선택하세요.' }]}
          >
            <Select
              options={[
                { label: '전체', value: 'all' },
                { label: '프리미엄 사용자', value: 'premium' },
                { label: '정지 회원 제외', value: 'active' }
              ]}
            />
          </Form.Item>

          <Form.Item
            label="발송 채널"
            name="channel"
            rules={[{ required: true, message: '발송 채널을 선택하세요.' }]}
          >
            <Select
              options={[
                { label: '푸시', value: 'push' },
                { label: '이메일', value: 'email' }
              ]}
            />
          </Form.Item>

          <Form.Item
            label="발송 방식"
            name="sendMode"
            rules={[{ required: true, message: '발송 방식을 선택하세요.' }]}
          >
            <Radio.Group
              options={[
                { label: '즉시 발송', value: 'instant' },
                { label: '예약 발송', value: 'scheduled' }
              ]}
            />
          </Form.Item>

          {sendMode === 'scheduled' ? (
            <Form.Item
              label="예약 발송 시각"
              name="scheduleAt"
              rules={[{ required: true, message: '예약 시각을 선택하세요.' }]}
            >
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
          ) : null}

          <Space>
            <Button type="primary" onClick={handleSubmit}>
              {actionLabel}
            </Button>
            <Button onClick={() => form.resetFields()}>초기화</Button>
          </Space>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              발송 결과는 Notification / History 화면에서 확인합니다.
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
}
