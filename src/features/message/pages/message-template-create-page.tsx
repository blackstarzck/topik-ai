import { Alert, Button, Form, Input, Space } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams
} from 'react-router-dom';

import { messageDataSource } from '../api/message-data-source';
import {
  getMessageTemplateSafe,
  saveMessageTemplateSafe
} from '../api/messages-service';
import type { MessageChannel, MessageTemplate } from '../model/types';
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
  const [template, setTemplate] = useState<MessageTemplate | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(Boolean(templateId));
  const [loadErrorMessage, setLoadErrorMessage] = useState('');
  const [contentForm] = Form.useForm<TemplateContentFormValues & { reason?: string }>();
  const activeMode = template?.mode ?? fallbackMode;
  const isSupabaseSource = messageDataSource === 'supabase';

  const listPath = meta.basePath;
  const listSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams(location.search);

    if (!nextSearchParams.get('tab')) {
      nextSearchParams.set('tab', activeMode);
    }

    const search = nextSearchParams.toString();
    return search ? `?${search}` : '';
  }, [activeMode, location.search]);

  useEffect(() => {
    let mounted = true;

    if (!templateId) {
      setTemplate(null);
      setIsLoadingTemplate(false);
      return () => {
        mounted = false;
      };
    }

    setIsLoadingTemplate(true);
    setLoadErrorMessage('');
    void getMessageTemplateSafe(templateId).then((result) => {
      if (!mounted) {
        return;
      }

      if (result.ok && result.data?.channel === channel) {
        setTemplate(result.data);
        setIsLoadingTemplate(false);
        return;
      }

      setTemplate(null);
      setLoadErrorMessage(result.ok ? '' : result.error.message);
      setIsLoadingTemplate(false);
    });

    return () => {
      mounted = false;
    };
  }, [channel, templateId]);

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

    const values = (await contentForm.validateFields()) as TemplateContentFormValues & {
      reason?: string;
    };
    const result = await saveMessageTemplateSafe({
      ...template,
      ...values,
      bodyJson: createMessageBodyJson(values.bodyHtml)
    });

    if (!result.ok) {
      setLoadErrorMessage(result.error.message);
      return;
    }

    navigate(`${listPath}${listSearch}`, {
      replace: true,
      state: {
        messageTemplateContentSaved: {
          templateId: result.data.id,
          mode: result.data.mode
        }
      }
    });
  }, [contentForm, listPath, listSearch, navigate, template]);

  return (
    <div className="message-template-detail-page">
      <PageTitle title={`${meta.title} 등록 상세`} />
      {!isLoadingTemplate && !template ? (
        <Alert
          type="error"
          showIcon
          message="등록 상세 대상을 찾을 수 없습니다."
          description={loadErrorMessage || '???? ?? ??? ???.'}
          action={
            <Button type="primary" size="small" onClick={handleBackToList}>
              목록으로
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
              목록으로
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={handleSaveTemplateContent}
              disabled={!template}
            >
              저장
            </Button>
            </Space>
          </div>
        }
      >
          {template ? (
            <Form form={contentForm} className="message-template-content-form">
              {isSupabaseSource ? (
                <Form.Item
                  label="사유/근거"
                  name="reason"
                  rules={[{ required: true, message: '본문 저장 사유를 입력하세요.' }]}
                >
                  <Input.TextArea rows={2} placeholder="예: 공지 본문 문구 갱신" />
                </Form.Item>
              ) : null}
              <Form.Item
                name="bodyHtml"
                rules={[{ required: true, message: '본문을 입력하세요.' }]}
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
