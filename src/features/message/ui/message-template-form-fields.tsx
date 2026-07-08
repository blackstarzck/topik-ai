import { Descriptions, Form, Input, Modal, Select, Switch, Typography } from 'antd';
import type { DescriptionsProps } from 'antd';
import { useEffect } from 'react';
import type { Editor as TinyMceEditor } from 'tinymce';

import { messageDataSource } from '../api/message-data-source';
import type {
  MessageChannel,
  MessageGroup,
  MessageTemplateMode,
  MessageTemplateStatus,
  NotificationTemplateClass
} from '../model/types';
import {
  DEFAULT_TINYMCE_PLUGINS,
  TinyMceHtmlEditor
} from '../../../shared/ui/html-editor/tiny-mce-html-editor';
import { markRequiredDescriptionItems } from '../../../shared/ui/descriptions/description-label';

export type TemplateFormValues = {
  category: string;
  name: string;
  summary: string;
  subject: string;
  targetGroupIds: string[];
  status: MessageTemplateStatus;
  triggerLabel?: string;
  bodyHtml: string;
  bodyJson: string;
  // notification-contract.md 계약 필드 — supabase 모드 폼에서만 노출.
  templateKey?: string;
  templateClass?: NotificationTemplateClass;
  mandatory?: boolean;
  linkUrl?: string;
  /** 메일 전용: 본문 하단 자동 삽입 CTA 버튼 문구(빈 값=기본 '알림 확인하기'). */
  ctaLabel?: string;
  reason?: string;
};

export type TemplateMetaFormValues = Omit<TemplateFormValues, 'bodyHtml' | 'bodyJson'>;

export type TemplateContentFormValues = Pick<TemplateFormValues, 'bodyHtml'>;

type MessageChannelMeta = {
  title: string;
  basePath: string;
  subjectLabel: string;
  recipientLabel: string;
  recipientPlaceholder: string;
  categories: string[];
};

// notification_templates.category CHECK — supabase 모드 공통 카테고리.
export const notificationCategoryOptions = [
  { label: '학습(study)', value: 'study' },
  { label: '시험 일정(exam_schedule)', value: 'exam_schedule' },
  { label: '공지(notice)', value: 'notice' },
  { label: '이벤트(event)', value: 'event' },
  { label: '마케팅(marketing)', value: 'marketing' }
] as const;

// notification-contract.md §2 — class 4종.
export const notificationClassOptions: Array<{
  label: string;
  value: NotificationTemplateClass;
}> = [
  { label: '필수(transactional)', value: 'transactional' },
  { label: '운영(operational)', value: 'operational' },
  { label: '학습(learning)', value: 'learning' },
  { label: '마케팅(marketing)', value: 'marketing' }
];

type MessageTemplateFormFieldsProps = {
  channel: MessageChannel;
  mode: MessageTemplateMode;
  groups: MessageGroup[];
  editorId?: string;
  variant?: 'form' | 'descriptions';
  showBodyHtml?: boolean;
  showJsonBody?: boolean;
};

type MessageHtmlEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
  editorId?: string;
  height?: number | string;
};

type MessageTemplateVariable = {
  category: '회원' | '발송' | '시스템';
  label: string;
  token: string;
};

const MESSAGE_TEMPLATE_VARIABLES: readonly MessageTemplateVariable[] = [
  { category: '회원', label: '회원 이름', token: '{{user_name}}' },
  { category: '회원', label: '회원 ID', token: '{{user_id}}' },
  { category: '회원', label: '회원 이메일', token: '{{user_email}}' },
  { category: '발송', label: '대상 그룹명', token: '{{group_name}}' },
  { category: '발송', label: '템플릿명', token: '{{template_name}}' },
  { category: '발송', label: '발송 시각', token: '{{sent_at}}' },
  { category: '시스템', label: '서비스명', token: '{{service_name}}' },
  { category: '시스템', label: '앱 링크', token: '{{app_link}}' },
  { category: '시스템', label: '고객센터 이메일', token: '{{support_email}}' },
  // 메일 전용: 본문에 이 변수가 있으면 발송 워커가 CTA 링크로 치환하고 하단 자동 버튼은 생략
  // — 편집기에서 버튼을 직접 만들어 스타일까지 제어할 수 있다.
  { category: '시스템', label: 'CTA 링크(메일 버튼 href)', token: '{{cta_url}}' }
] as const;

const MESSAGE_TINYMCE_TOOLBAR =
  'undo redo | styles | templateVariables | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image';

function buildMessageTemplateVariableMenuItems(
  insertVariable: (token: string) => void
): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = [];
  let previousCategory: MessageTemplateVariable['category'] | null = null;

  for (const variable of MESSAGE_TEMPLATE_VARIABLES) {
    if (previousCategory && previousCategory !== variable.category) {
      items.push({ type: 'separator' });
    }

    previousCategory = variable.category;
    items.push({
      type: 'menuitem',
      text: `${variable.category} · ${variable.label} ${variable.token}`,
      onAction: () => insertVariable(variable.token)
    });
  }

  return items;
}

export function MessageHtmlEditor({
  value,
  onChange,
  editorId = 'default-editor',
  height
}: MessageHtmlEditorProps): JSX.Element {
  return (
    <TinyMceHtmlEditor
      value={value}
      onChange={onChange}
      editorId={editorId}
      height={height}
      className="message-template-html-editor"
      plugins={DEFAULT_TINYMCE_PLUGINS}
      toolbar={MESSAGE_TINYMCE_TOOLBAR}
      setup={(editor: TinyMceEditor) => {
        editor.ui.registry.addMenuButton('templateVariables', {
          text: '환경변수',
          tooltip: '환경변수 삽입',
          fetch: (callback) => {
            callback(
              buildMessageTemplateVariableMenuItems((token) => {
                editor.insertContent(token);
              })
            );
          }
        });
      }}
    />
  );
}

export function parseMessageTemplateMode(value: string | null): MessageTemplateMode {
  return value === 'manual' ? 'manual' : 'auto';
}

// 인앱/푸시 알림은 클릭 시 앱 내부 경로로 이동하므로 이동 경로(link_url)를
// 설정할 수 있어야 한다. supabase 모드는 계약상 전 채널에서 노출(기존 동작 유지).
// 메일은 본문 링크를 쓰므로 mock 모드에서는 노출하지 않는다.
export function shouldShowNotificationLink(channel: MessageChannel): boolean {
  return (
    messageDataSource === 'supabase' || channel === 'in_app' || channel === 'push'
  );
}

export function getMessageChannelMeta(channel: MessageChannel): MessageChannelMeta {
  if (channel === 'mail') {
    return {
      title: '메일',
      basePath: '/messages/mail',
      subjectLabel: '메일 제목',
      recipientLabel: '테스트 이메일',
      recipientPlaceholder: 'admin@example.com',
      categories: ['온보딩', '결제', '운영', '마케팅', '고객 안내']
    };
  }

  if (channel === 'in_app') {
    return {
      title: '인앱 알림',
      basePath: '/messages/in-app',
      subjectLabel: '알림 제목',
      recipientLabel: '수신 사용자 ID',
      recipientPlaceholder: 'user-uuid-0000',
      categories: ['운영', '결제', '커뮤니티', '마케팅']
    };
  }

  return {
    title: '푸시',
    basePath: '/messages/push',
    subjectLabel: '푸시 제목',
    recipientLabel: '테스트 디바이스 토큰',
    recipientPlaceholder: 'device-token-demo-001',
    categories: ['운영', '결제', '커뮤니티', '마케팅']
  };
}

export function createTemplateMetaDefaults(
  channel: MessageChannel,
  mode: MessageTemplateMode,
  groups: MessageGroup[]
): TemplateMetaFormValues {
  const baseDefaults: TemplateMetaFormValues = {
    category: getMessageChannelMeta(channel).categories[0],
    name: '',
    summary: '',
    subject: '',
    targetGroupIds: groups.slice(0, 1).map((group) => group.id),
    status: mode === 'auto' ? '활성' : '초안',
    triggerLabel: mode === 'auto' ? '이벤트 발생 직후' : undefined,
    // 인앱/푸시는 mock 모드에서도 이동 경로 입력칸을 노출하므로 기본값을 둔다.
    ...(shouldShowNotificationLink(channel) ? { linkUrl: '' } : {})
  };

  if (messageDataSource !== 'supabase') {
    return baseDefaults;
  }

  return {
    ...baseDefaults,
    category: notificationCategoryOptions[0].value,
    templateKey: '',
    templateClass: 'operational',
    mandatory: false,
    linkUrl: '',
    ...(channel === 'mail' ? { ctaLabel: '' } : {}),
    reason: ''
  };
}

export function createEmptyMessageBodyJson(): string {
  return JSON.stringify(
    {
      blocks: []
    },
    null,
    2
  );
}

export function createTemplateDefaults(
  channel: MessageChannel,
  mode: MessageTemplateMode,
  groups: MessageGroup[]
): TemplateFormValues {
  const bodyHtml = '';

  return {
    ...createTemplateMetaDefaults(channel, mode, groups),
    bodyHtml,
    bodyJson: createEmptyMessageBodyJson()
  };
}

export function createMessageBodyJson(bodyHtml: string): string {
  const plainText =
    bodyHtml
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  if (!plainText) {
    return createEmptyMessageBodyJson();
  }

  return JSON.stringify(
    {
      blocks: [{ type: 'paragraph', data: { text: plainText } }]
    },
    null,
    2
  );
}

type MandatoryToggleProps = {
  value?: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
};

// mandatory ON = 수신 선호(pref) 우회 발송 — 확인 단계 + 감사 기록 고지(contract §2).
function MandatoryToggle({ value, onChange, disabled }: MandatoryToggleProps): JSX.Element {
  const handleChange = (next: boolean): void => {
    if (!next) {
      onChange?.(false);
      return;
    }

    Modal.confirm({
      title: '강제 발송(mandatory) 설정',
      content:
        '수신 선호(알림 설정) 우회가 발생합니다. 우회 발송 사유는 감사 로그에 기록됩니다. 계속하시겠습니까?',
      okText: '설정',
      cancelText: '취소',
      onOk: () => onChange?.(true)
    });
  };

  return (
    <div>
      <Switch checked={Boolean(value)} disabled={disabled} onChange={handleChange} />
      {disabled ? (
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
          마케팅(marketing) 분류는 강제 발송을 설정할 수 없습니다.
        </Typography.Text>
      ) : null}
    </div>
  );
}

export function MessageTemplateFormFields({
  channel,
  mode,
  groups,
  editorId,
  variant = 'form',
  showBodyHtml = true,
  showJsonBody = true
}: MessageTemplateFormFieldsProps): JSX.Element {
  const meta = getMessageChannelMeta(channel);
  const isDescriptions = variant === 'descriptions';
  const isSupabaseSource = messageDataSource === 'supabase';
  const form = Form.useFormInstance();
  const watchedTemplateClass = Form.useWatch<NotificationTemplateClass | undefined>(
    'templateClass',
    form
  );
  const isMarketingClass = watchedTemplateClass === 'marketing';
  const showLinkUrl = shouldShowNotificationLink(channel);

  // marketing 전환 시 mandatory 강제 해제 — DB CHECK(marketing+mandatory 차단) 선반영.
  useEffect(() => {
    if (isSupabaseSource && isMarketingClass && form?.getFieldValue('mandatory')) {
      form.setFieldValue('mandatory', false);
    }
  }, [form, isMarketingClass, isSupabaseSource]);

  if (isDescriptions) {
    const descriptionItems: DescriptionsProps['items'] = [
      ...(isSupabaseSource
        ? ([
            {
              key: 'templateKey',
              label: '템플릿 키',
              children: (
                <Form.Item
                  name="templateKey"
                  style={{ marginBottom: 0 }}
                  rules={[{ required: true, message: '템플릿 키를 입력하세요.' }]}
                >
                  <Input placeholder="예: notice, exam_schedule" />
                </Form.Item>
              )
            },
            {
              key: 'templateClass',
              label: '분류(class)',
              children: (
                <Form.Item
                  name="templateClass"
                  style={{ marginBottom: 0 }}
                  rules={[{ required: true, message: '분류를 선택하세요.' }]}
                >
                  <Select options={notificationClassOptions} />
                </Form.Item>
              )
            },
            {
              key: 'mandatory',
              label: '강제 발송',
              children: (
                <Form.Item name="mandatory" style={{ marginBottom: 0 }} valuePropName="value">
                  <MandatoryToggle disabled={isMarketingClass} />
                </Form.Item>
              )
            }
          ] satisfies DescriptionsProps['items'])
        : []),
      // 알림 클릭 시 이동 경로(link_url) — 인앱/푸시는 모든 모드에서 노출.
      // 메일은 이 경로가 본문 하단 CTA 버튼(발송 워커가 자동 삽입)의 링크가 된다.
      ...(showLinkUrl
        ? ([
            {
              key: 'linkUrl',
              label: channel === 'mail' ? 'CTA 링크' : '이동 경로',
              span: 2,
              children: (
                <Form.Item
                  name="linkUrl"
                  style={{ marginBottom: 0 }}
                  extra={
                    channel === 'mail'
                      ? '본문에 {{cta_url}} 변수가 있으면 그 위치에 이 링크가 치환되어 직접 만든 버튼을 쓸 수 있고, 없으면 본문 하단에 기본 CTA 버튼이 자동 삽입됩니다. 비워두면 자동 버튼이 붙지 않습니다.'
                      : '알림을 클릭하면 앱 내부의 이 경로로 이동합니다. 비워두면 앱 기본 화면으로 이동합니다.'
                  }
                >
                  <Input placeholder="예: /dashboard, /notice/123, /community/posts/45" />
                </Form.Item>
              )
            }
          ] satisfies DescriptionsProps['items'])
        : []),
      // 메일 전용: 자동 삽입 CTA 버튼의 문구 — 편집 화면 본문에는 보이지 않고 발송 시 삽입되므로
      // 여기서 관리한다(빈 값이면 기본 '알림 확인하기').
      ...(showLinkUrl && channel === 'mail' && isSupabaseSource
        ? ([
            {
              key: 'ctaLabel',
              label: 'CTA 버튼 문구',
              span: 2,
              children: (
                <Form.Item
                  name="ctaLabel"
                  style={{ marginBottom: 0 }}
                  extra="자동 삽입 CTA 버튼의 문구입니다. 비워두면 '알림 확인하기'로 발송되며, 본문에 {{cta_url}} 변수를 사용해 버튼을 직접 만든 경우에는 사용되지 않습니다."
                >
                  <Input placeholder="알림 확인하기" maxLength={40} />
                </Form.Item>
              )
            }
          ] satisfies DescriptionsProps['items'])
        : []),
      {
        key: 'category',
        label: '카테고리',
        children: (
          <Form.Item
            name="category"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '카테고리를 선택하세요.' }]}
          >
            <Select
              options={
                isSupabaseSource
                  ? [...notificationCategoryOptions]
                  : meta.categories.map((category) => ({
                      label: category,
                      value: category
                    }))
              }
            />
          </Form.Item>
        )
      },
      {
        key: 'status',
        label: '상태',
        children: (
          <Form.Item
            name="status"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '상태를 선택하세요.' }]}
          >
            <Select
              options={[
                { label: '활성', value: '활성' },
                { label: '비활성', value: '비활성' },
                { label: '초안', value: '초안' }
              ]}
            />
          </Form.Item>
        )
      },
      {
        key: 'name',
        label: '템플릿명',
        span: 2,
        children: (
          <Form.Item
            name="name"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '템플릿명을 입력하세요.' }]}
          >
            <Input placeholder={`${meta.title} 템플릿명을 입력하세요.`} />
          </Form.Item>
        )
      },
      {
        key: 'summary',
        label: '요약',
        span: 2,
        children: (
          <Form.Item name="summary" style={{ marginBottom: 0 }}>
            <Input placeholder="(선택) 운영자가 한눈에 파악할 수 있는 요약을 입력하세요." />
          </Form.Item>
        )
      },
      {
        key: 'subject',
        label: meta.subjectLabel,
        span: 2,
        children: (
          <Form.Item
            name="subject"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: `${meta.subjectLabel}을 입력하세요.` }]}
          >
            <Input placeholder={`${meta.subjectLabel}을 입력하세요.`} />
          </Form.Item>
        )
      },
      {
        key: 'targetGroupIds',
        label: '발송 그룹',
        span: 2,
        children: (
          <Form.Item
            name="targetGroupIds"
            style={{ marginBottom: 0 }}
            extra="(선택) 비워두면 실제 발송 단계에서 그룹을 선택합니다."
          >
            <Select
              mode="multiple"
              allowClear
              options={groups.map((group) => ({
                label: `${group.name} (${group.memberCount.toLocaleString()}명)`,
                value: group.id
              }))}
            />
          </Form.Item>
        )
      }
    ];

    if (mode === 'auto') {
      descriptionItems.push({
        key: 'triggerLabel',
        label: '자동 조건',
        span: 2,
        children: (
          <Form.Item
            name="triggerLabel"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '자동 조건을 입력하세요.' }]}
          >
            <Input placeholder="예: 회원 가입 직후, 결제 실패 후 1시간" />
          </Form.Item>
        )
      });
    }

    if (showBodyHtml) {
      descriptionItems.push({
        key: 'bodyHtml',
        label: '본문',
        span: 2,
        children: (
          <Form.Item
            name="bodyHtml"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '본문을 입력하세요.' }]}
          >
            <MessageHtmlEditor editorId={editorId} />
          </Form.Item>
        )
      });
    }

    if (showBodyHtml && showJsonBody) {
      descriptionItems.push({
        key: 'bodyJson',
        label: 'JSON 본문',
        span: 2,
        children: (
          <Form.Item
            name="bodyJson"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: 'JSON 본문을 입력하세요.' }]}
          >
            <Input.TextArea rows={8} placeholder='{"blocks":[]}' />
          </Form.Item>
        )
      });
    }

    if (isSupabaseSource) {
      // 모든 템플릿 쓰기 RPC는 p_reason 필수 — 저장 모달에 사유를 함께 받는다.
      descriptionItems.push({
        key: 'reason',
        label: '사유/근거',
        span: 2,
        children: (
          <Form.Item
            name="reason"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '저장 사유를 입력하세요.' }]}
          >
            <Input.TextArea rows={3} placeholder="예: 신규 공지 템플릿 등록" />
          </Form.Item>
        )
      });
    }

    return (
      <Descriptions
        bordered
        size="small"
        column={2}
        items={markRequiredDescriptionItems(descriptionItems, [
          'category',
          'status',
          'name',
          'subject',
          ...(mode === 'auto' ? ['triggerLabel'] : []),
          ...(showBodyHtml ? ['bodyHtml'] : []),
          ...(showBodyHtml && showJsonBody ? ['bodyJson'] : []),
          ...(isSupabaseSource ? ['templateKey', 'templateClass', 'reason'] : [])
        ])}
        className="message-template-form-descriptions"
      />
    );
  }

  return (
    <>
      <Form.Item
        label="카테고리"
        name="category"
        rules={[{ required: true, message: '카테고리를 선택하세요.' }]}
      >
        <Select
          options={meta.categories.map((category) => ({
            label: category,
            value: category
          }))}
        />
      </Form.Item>

      <Form.Item
        label="상태"
        name="status"
        rules={[{ required: true, message: '상태를 선택하세요.' }]}
      >
        <Select
          options={[
            { label: '활성', value: '활성' },
            { label: '비활성', value: '비활성' },
            { label: '초안', value: '초안' }
          ]}
        />
      </Form.Item>

      <Form.Item
        label="템플릿명"
        name="name"
        rules={[{ required: true, message: '템플릿명을 입력하세요.' }]}
      >
        <Input placeholder={`${meta.title} 템플릿명을 입력하세요.`} />
      </Form.Item>

      <Form.Item label="요약" name="summary">
        <Input placeholder="(선택) 운영자가 한눈에 파악할 수 있는 요약을 입력하세요." />
      </Form.Item>

      <Form.Item
        label={meta.subjectLabel}
        name="subject"
        rules={[{ required: true, message: `${meta.subjectLabel}을 입력하세요.` }]}
      >
        <Input placeholder={`${meta.subjectLabel}을 입력하세요.`} />
      </Form.Item>

      <Form.Item
        label="발송 그룹"
        name="targetGroupIds"
        extra="(선택) 비워두면 실제 발송 단계에서 그룹을 선택합니다."
      >
        <Select
          mode="multiple"
          allowClear
          options={groups.map((group) => ({
            label: `${group.name} (${group.memberCount.toLocaleString()}명)`,
            value: group.id
          }))}
        />
      </Form.Item>

      {mode === 'auto' ? (
        <Form.Item
          label="자동 조건"
          name="triggerLabel"
          rules={[{ required: true, message: '자동 조건을 입력하세요.' }]}
        >
          <Input placeholder="예: 회원 가입 직후, 결제 실패 후 1시간" />
        </Form.Item>
      ) : null}

      {showBodyHtml ? (
        <Form.Item
          label="본문"
          name="bodyHtml"
          rules={[{ required: true, message: '본문을 입력하세요.' }]}
        >
          <MessageHtmlEditor editorId={editorId} />
        </Form.Item>
      ) : null}

      {showBodyHtml && showJsonBody ? (
        <Form.Item
          label="JSON 본문"
          name="bodyJson"
          rules={[{ required: true, message: 'JSON 본문을 입력하세요.' }]}
          style={{ marginBottom: 0 }}
        >
          <Input.TextArea rows={8} placeholder='{"blocks":[]}' />
        </Form.Item>
      ) : null}
    </>
  );
}
