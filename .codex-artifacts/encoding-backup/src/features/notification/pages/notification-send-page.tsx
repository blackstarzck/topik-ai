import {
  Button,
  Card,
  DatePicker,
  Descriptions,
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
import { markRequiredDescriptionItems } from '../../../shared/ui/descriptions/description-label';

const { Text } = Typography;

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

      <Card>
        <Form
          form={form}
          initialValues={{
            target: 'all',
            channel: 'push',
            sendMode: 'instant'
          }}
        >
          <Descriptions
            bordered
            size="small"
            column={2}
            className="admin-form-descriptions"
            items={markRequiredDescriptionItems(
              [
                {
                  key: 'title',
                  label: '알림 제목',
                  span: 2,
                  children: (
                    <Form.Item
                      name="title"
                      rules={[{ required: true, message: '알림 제목???낅젰?섏꽭??' }]}
                    >
                      <Input placeholder="?? 정기 점검 안내" />
                    </Form.Item>
                  )
                },
                {
                  key: 'content',
                  label: '알림 내용',
                  span: 2,
                  children: (
                    <Form.Item
                      name="content"
                      rules={[{ required: true, message: '알림 내용???낅젰?섏꽭??' }]}
                    >
                      <Input.TextArea rows={5} placeholder="알림 硫붿떆吏瑜??낅젰?섏꽭??" />
                    </Form.Item>
                  )
                },
                {
                  key: 'target',
                  label: '발송 대상,
                  children: (
                    <Form.Item
                      name="target"
                      rules={[{ required: true, message: '발송 대상을 선택하세요.' }]}
                    >
                      <Select
                        options={[
                          { label: '전체', value: 'all' },
                          { label: '프리미엄 사용자, value: 'premium' },
                          { label: '정지 회원 ?쒖쇅', value: 'active' }
                        ]}
                      />
                    </Form.Item>
                  )
                },
                {
                  key: 'channel',
                  label: '발송 梨꾨꼸',
                  children: (
                    <Form.Item
                      name="channel"
                      rules={[{ required: true, message: '발송 채널을 선택하세요.' }]}
                    >
                      <Select
                        options={[
                          { label: '?몄떆', value: 'push' },
                          { label: '이메일, value: 'email' }
                        ]}
                      />
                    </Form.Item>
                  )
                },
                {
                  key: 'sendMode',
                  label: '발송 諛⑹떇',
                  span: 2,
                  children: (
                    <Form.Item
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
                  )
                },
                ...(sendMode === 'scheduled'
                  ? [
                      {
                        key: 'scheduleAt',
                        label: '예약 발송 시각',
                        span: 2,
                        children: (
                          <Form.Item
                            name="scheduleAt"
                            rules={[{ required: true, message: '예약 시각을 선택하세요.' }]}
                          >
                            <DatePicker showTime style={{ width: '100%' }} />
                          </Form.Item>
                        )
                      }
                    ]
                  : [])
              ],
              [
                'title',
                'content',
                'target',
                'channel',
                'sendMode',
                ...(sendMode === 'scheduled' ? ['scheduleAt'] : [])
              ]
            )}
          />

          <Space>
            <Button type="primary" onClick={handleSubmit}>
              {actionLabel}
            </Button>
            <Button onClick={() => form.resetFields()}>초기화/Button>
          </Space>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              발송 寃곌낵??Notification / History ?붾㈃?먯꽌 ?뺤씤?⑸땲??
            </Text>
          </div>
        </Form>
      </Card>
    </div>
  );
}


