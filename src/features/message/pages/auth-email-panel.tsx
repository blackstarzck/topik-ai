import {
  Alert,
  Button,
  Collapse,
  Drawer,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import type { Editor as TinyMceEditor } from 'tinymce';

import { isSupabaseConfigured } from '../../../shared/api/supabase-client';
import {
  DEFAULT_TINYMCE_PLUGINS,
  TinyMceHtmlEditor
} from '../../../shared/ui/html-editor/tiny-mce-html-editor';
import {
  fetchAuthEmailTemplatesSafe,
  saveAuthEmailTemplateSafe,
  syncAuthEmailTemplateSafe
} from '../api/auth-email-service';
import {
  AUTH_EMAIL_STATUS_LABELS,
  AUTH_EMAIL_SYNC_STATUS_COLORS,
  AUTH_EMAIL_SYNC_STATUS_LABELS,
  AUTH_EMAIL_TYPE_DESCRIPTIONS,
  AUTH_EMAIL_TYPE_LABELS,
  AUTH_EMAIL_VARIABLES,
  validateAuthEmailTemplate
} from '../model/auth-email-types';
import type { AuthEmailTemplate, AuthEmailType } from '../model/auth-email-types';

const { Text, Title } = Typography;

const AUTH_EMAIL_TINYMCE_TOOLBAR =
  'undo redo | styles | authVariables | bold italic underline strikethrough | alignleft aligncenter alignright | bullist numlist | link | code preview';

type AuthEmailHtmlEditorProps = {
  authType: AuthEmailType;
  value?: string;
  onChange?: (value: string) => void;
  editorId?: string;
};

function AuthEmailHtmlEditor({ authType, value, onChange, editorId }: AuthEmailHtmlEditorProps): JSX.Element {
  const variables = AUTH_EMAIL_VARIABLES[authType];
  return (
    <TinyMceHtmlEditor
      value={value}
      onChange={onChange}
      editorId={editorId}
      height={360}
      className="auth-email-html-editor"
      plugins={DEFAULT_TINYMCE_PLUGINS}
      toolbar={AUTH_EMAIL_TINYMCE_TOOLBAR}
      setup={(editor: TinyMceEditor) => {
        editor.ui.registry.addMenuButton('authVariables', {
          text: '인증 변수',
          tooltip: '인증 메일 변수 삽입',
          fetch: (callback) => {
            callback(
              variables.map((variable) => ({
                type: 'menuitem',
                text: `${variable.label} ${variable.token}`,
                onAction: () => editor.insertContent(variable.token)
              }))
            );
          }
        });
      }}
    />
  );
}

type EditFormValues = { subject: string; bodyHtml: string; reason: string };

export function AuthEmailPanel(): JSX.Element {
  const [templates, setTemplates] = useState<AuthEmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AuthEmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncTarget, setSyncTarget] = useState<AuthEmailTemplate | null>(null);
  const [syncReason, setSyncReason] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [form] = Form.useForm<EditFormValues>();
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  const watchedSubject = Form.useWatch('subject', form) ?? '';
  const watchedBody = Form.useWatch('bodyHtml', form) ?? '';

  const reload = useCallback(async () => {
    setLoading(true);
    const result = await fetchAuthEmailTemplatesSafe();
    if (result.ok) {
      setTemplates(result.data);
    } else {
      notificationApi.error({
        message: '인증 메일 템플릿을 불러오지 못했습니다.',
        description: result.error.message
      });
    }
    setLoading(false);
  }, [notificationApi]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openEdit = (template: AuthEmailTemplate): void => {
    setEditing(template);
    form.setFieldsValue({ subject: template.subject, bodyHtml: template.bodyHtml, reason: '' });
  };

  const closeEdit = (): void => {
    setEditing(null);
    form.resetFields();
  };

  const editIssues = editing
    ? validateAuthEmailTemplate(editing.authType, watchedSubject, watchedBody)
    : [];

  const handleSave = async (alsoSync: boolean): Promise<void> => {
    if (!editing) {
      return;
    }
    let values: EditFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const issues = validateAuthEmailTemplate(editing.authType, values.subject, values.bodyHtml);
    if (alsoSync && issues.length > 0) {
      notificationApi.error({ message: '동기화 전 검증 실패', description: issues.join(' ') });
      return;
    }

    setSaving(true);
    const saveResult = await saveAuthEmailTemplateSafe({
      authType: editing.authType,
      subject: values.subject,
      bodyHtml: values.bodyHtml,
      status: alsoSync ? 'ready' : undefined,
      reason: values.reason
    });
    if (!saveResult.ok) {
      notificationApi.error({ message: '저장 실패', description: saveResult.error.message });
      setSaving(false);
      return;
    }

    if (alsoSync) {
      const syncResult = await syncAuthEmailTemplateSafe(editing.authType, values.reason);
      if (!syncResult.ok) {
        notificationApi.warning({ message: '저장됨 · 동기화 실패', description: syncResult.error.message });
      } else {
        notificationApi.success({ message: '저장 후 Supabase Auth에 동기화했습니다.' });
      }
    } else {
      notificationApi.success({
        message: '인증 메일 템플릿을 저장했습니다.',
        description: '동기화 전까지는 실제 발송에 반영되지 않습니다.'
      });
    }

    setSaving(false);
    closeEdit();
    await reload();
  };

  const handleSync = async (): Promise<void> => {
    if (!syncTarget) {
      return;
    }
    if (!syncReason.trim()) {
      notificationApi.error({ message: '동기화 사유를 입력하세요.' });
      return;
    }
    const issues = validateAuthEmailTemplate(syncTarget.authType, syncTarget.subject, syncTarget.bodyHtml);
    if (issues.length > 0) {
      notificationApi.error({ message: '동기화 전 검증 실패', description: issues.join(' ') });
      return;
    }

    setSyncing(true);
    const result = await syncAuthEmailTemplateSafe(syncTarget.authType, syncReason.trim());
    if (!result.ok) {
      notificationApi.error({ message: '동기화 실패', description: result.error.message });
    } else {
      notificationApi.success({
        message: `${AUTH_EMAIL_TYPE_LABELS[syncTarget.authType]} 템플릿을 Supabase Auth에 동기화했습니다.`
      });
    }
    setSyncing(false);
    setSyncTarget(null);
    setSyncReason('');
    await reload();
  };

  const hasDrift = templates.some(
    (template) => template.syncStatus === 'drift' || template.syncStatus === 'conflict'
  );

  const columns: TableColumnsType<AuthEmailTemplate> = [
    {
      title: '유형',
      dataIndex: 'authType',
      width: 220,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{AUTH_EMAIL_TYPE_LABELS[record.authType]}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {AUTH_EMAIL_TYPE_DESCRIPTIONS[record.authType]}
          </Text>
        </Space>
      )
    },
    {
      title: '메일 제목',
      dataIndex: 'subject',
      render: (subject: string) =>
        subject ? <Text>{subject}</Text> : <Text type="secondary">미작성</Text>
    },
    {
      title: '상태',
      dataIndex: 'status',
      width: 90,
      render: (_, record) => <Tag>{AUTH_EMAIL_STATUS_LABELS[record.status]}</Tag>
    },
    {
      title: '동기화',
      dataIndex: 'syncStatus',
      width: 110,
      render: (_, record) => {
        const tag = (
          <Tag color={AUTH_EMAIL_SYNC_STATUS_COLORS[record.syncStatus]}>
            {AUTH_EMAIL_SYNC_STATUS_LABELS[record.syncStatus]}
          </Tag>
        );
        return record.syncStatus === 'error' && record.syncError ? (
          <Tooltip title={record.syncError}>{tag}</Tooltip>
        ) : (
          tag
        );
      }
    },
    {
      title: '최근 동기화',
      dataIndex: 'syncedAt',
      width: 150,
      render: (syncedAt?: string) => <Text type="secondary">{syncedAt ?? '—'}</Text>
    },
    {
      title: '작업',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>
            편집
          </Button>
          <Button
            size="small"
            type="link"
            disabled={!record.subject || !record.bodyHtml}
            onClick={() => {
              setSyncTarget(record);
              setSyncReason('');
            }}
          >
            동기화
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      {notificationContextHolder}
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>
            인증 메일 템플릿
          </Title>
          <Text type="secondary">
            v13 회원가입·비밀번호 재설정 등 Supabase Auth 메일을 편집하고 ‘Supabase Auth에 동기화’로 반영합니다.
            발송은 GoTrue가 수행하며, 발송 그룹/자동 조건은 없습니다.
          </Text>
        </div>

        {!isSupabaseConfigured ? (
          <Alert
            type="warning"
            showIcon
            message="모크 모드로 동작 중입니다."
            description="실제 Supabase Auth 동기화 없이 미리보기만 동작합니다."
          />
        ) : null}

        {hasDrift ? (
          <Alert
            type="warning"
            showIcon
            message="드리프트 감지"
            description="일부 템플릿이 Supabase 대시보드에서 직접 변경된 것으로 보입니다. 검토 후 다시 동기화하세요."
          />
        ) : null}

        <Table
          rowKey="authType"
          loading={loading}
          columns={columns}
          dataSource={templates}
          pagination={false}
        />
      </Space>

      <Drawer
        title={editing ? `인증 메일 편집 · ${AUTH_EMAIL_TYPE_LABELS[editing.authType]}` : '인증 메일 편집'}
        width={760}
        open={Boolean(editing)}
        onClose={closeEdit}
        destroyOnClose
        footer={
          <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={closeEdit}>취소</Button>
            <Button loading={saving} onClick={() => void handleSave(false)}>
              저장
            </Button>
            <Button
              type="primary"
              loading={saving}
              disabled={editIssues.length > 0}
              onClick={() => void handleSave(true)}
            >
              저장 후 동기화
            </Button>
          </Space>
        }
      >
        {editing ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message={AUTH_EMAIL_TYPE_DESCRIPTIONS[editing.authType]}
              description="‘인증 변수’ 메뉴로 GoTrue 변수를 삽입하세요. 확인 링크는 메일 스캐너 prefetch로 토큰이 소모될 수 있어 OTP 토큰 사용도 고려하세요."
            />
            <Form form={form} layout="vertical" requiredMark>
              <Form.Item
                label="메일 제목"
                name="subject"
                rules={[{ required: true, message: '메일 제목을 입력하세요.' }]}
              >
                <Input placeholder="예: [토픽] 이메일 인증을 완료해 주세요" />
              </Form.Item>
              <Form.Item
                label="본문"
                name="bodyHtml"
                rules={[{ required: true, message: '본문을 입력하세요.' }]}
              >
                <AuthEmailHtmlEditor
                  authType={editing.authType}
                  editorId={`auth-email-editor-${editing.authType}`}
                />
              </Form.Item>
              <Form.Item
                label="사유/근거"
                name="reason"
                rules={[{ required: true, message: '저장 사유를 입력하세요.' }]}
              >
                <Input.TextArea rows={3} placeholder="예: 가입 인증 메일 문구 개편" />
              </Form.Item>
            </Form>

            {editIssues.length > 0 ? (
              <Alert
                type="warning"
                showIcon
                message="검증 경고 (동기화 전 해결 필요)"
                description={
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {editIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                }
              />
            ) : null}

            <Collapse
              items={[
                {
                  key: 'preview',
                  label: '미리보기',
                  children: (
                    <div
                      style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 16 }}
                      // 미리보기 전용 — 관리자만 접근하는 화면이며 본문은 관리자 입력값이다.
                      dangerouslySetInnerHTML={{
                        __html: watchedBody || '<p style="color:#999">본문이 비어 있습니다.</p>'
                      }}
                    />
                  )
                }
              ]}
            />
          </Space>
        ) : null}
      </Drawer>

      <Modal
        title="Supabase Auth에 동기화"
        open={Boolean(syncTarget)}
        onCancel={() => {
          setSyncTarget(null);
          setSyncReason('');
        }}
        onOk={() => void handleSync()}
        okText="동기화"
        cancelText="취소"
        confirmLoading={syncing}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text>
            {syncTarget ? AUTH_EMAIL_TYPE_LABELS[syncTarget.authType] : ''} 템플릿을 Supabase Auth 내장
            템플릿에 반영합니다. v13 사용자 메일에 즉시 영향이 갑니다.
          </Text>
          <Input.TextArea
            rows={3}
            placeholder="동기화 사유/근거"
            value={syncReason}
            onChange={(event) => setSyncReason(event.target.value)}
          />
        </Space>
      </Modal>
    </div>
  );
}
