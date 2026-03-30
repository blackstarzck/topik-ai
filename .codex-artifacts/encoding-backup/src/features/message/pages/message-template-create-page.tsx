import { Alert, Button, Form, Space } from 'antd';
import { useCallback, useEffect, useMemo } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from 'react-router-dom';

import { useMessageStore } from '../model/message-store';
import type { MessageChannel } from '../model/types';
import {
  MessageHtmlEditor,
  createMessageBodyJson,
  getMessageChannelMeta,
  parseMessageTemplateMode,
  type TemplateContentFormValues
} from '../ui/message-template-form-fields';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';

type MessageTemplateCreatePageProps = {
  channel: MessageChannel;
};

export default function MessageTemplateCreatePage({
  channel
}: MessageTemplateCreatePageProps): JSX.Element {
  const meta = useMemo(() => getMessageChannelMeta(channel), [channel]);
  const navigate = useNavigate();
  const location = useLocation();
  const { templateId } = useParams<{ templateId?: string }>();
  const [searchParams] = useSearchParams();
  const fallbackMode = parseMessageTemplateMode(searchParams.get('tab'));
  const template = useMessageStore((state) =>
    state.templates.find(
      (item) => item.channel === channel && item.id === templateId
    )
  );
  const saveTemplate = useMessageStore((state) => state.saveTemplate);
  const [contentForm] = Form.useForm<TemplateContentFormValues>();
  const activeMode = template?.mode ?? fallbackMode;

  const listPath = channel === 'mail' ? '/messages/mail' : '/messages/push';
  const listSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams(location.search);

    if (!nextSearchParams.get('tab')) {
      nextSearchParams.set('tab', activeMode);
    }

    const search = nextSearchParams.toString();
    return search ? `?${search}` : '';
  }, [activeMode, location.search]);

  useEffect(() => {
    contentForm.setFieldsValue({
      bodyHtml: template?.bodyHtml ?? ''
    });
  }, [contentForm, template]);

  const handleBackToList = useCallback(() => {
    navigate(`${listPath}${listSearch}`);
  }, [listPath, listSearch, navigate]);

  const handleSaveTemplateContent = useCallback(async () => {
    if (!template) {
      return;
    }

    const values = (await contentForm.validateFields()) as TemplateContentFormValues;
    const saved = saveTemplate({
      ...template,
      ...values,
      bodyJson: createMessageBodyJson(values.bodyHtml)
    });

    navigate(`${listPath}${listSearch}`, {
      replace: true,
      state: {
        messageTemplateContentSaved: {
          templateId: saved.id,
          mode: saved.mode
        }
      }
    });
  }, [contentForm, listPath, listSearch, navigate, saveTemplate, template]);

  return (
    <div className="message-template-detail-page">
      <PageTitle title={`${meta.title} ?깅줉 상세`} />
      {!template ? (
        <Alert
          type="error"
          showIcon
          message="?깅줉 상세 ??곸쓣 李얠쓣 ???놁뒿?덈떎."
          description="紐⑸줉?쇰줈 ?뚯븘媛 ?쒗뵆由우쓣 ?ㅼ떆 ?좏깮?섏꽭??"
          action={
            <Button type="primary" size="small" onClick={handleBackToList}>
              紐⑸줉?쇰줈
            </Button>
          }
        />
      ) : null}
      <AdminListCard
        className="message-template-detail-card"
        toolbar={
          <div className="message-template-editor-toolbar">
            <Space className="message-template-editor-toolbar-actions" wrap>
            <Button size="large" onClick={handleBackToList}>
              紐⑸줉?쇰줈
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={handleSaveTemplateContent}
              disabled={!template}
            >
              대상            </Button>
            </Space>
          </div>
        }
      >
          {template ? (
            <Form form={contentForm} className="message-template-content-form">
              <Form.Item
                name="bodyHtml"
                rules={[{ required: true, message: '蹂몃Ц???낅젰?섏꽭??' }]}
                style={{ marginBottom: 0 }}
              >
                <MessageHtmlEditor
                  editorId={`${channel}-template-editor-${template.id}`}
                  height="100%"
                />
              </Form.Item>
            </Form>
          ) : null}
      </AdminListCard>
    </div>
  );
}

