import { Descriptions, Form, Input, Select } from 'antd';
import type { DescriptionsProps } from 'antd';
import type { Editor as TinyMceEditor } from 'tinymce';

import type {
  MessageChannel,
  MessageGroup,
  MessageTemplateMode,
  MessageTemplateStatus
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
};

export type TemplateMetaFormValues = Omit<TemplateFormValues, 'bodyHtml' | 'bodyJson'>;

export type TemplateContentFormValues = Pick<TemplateFormValues, 'bodyHtml'>;

type MessageChannelMeta = {
  title: string;
  subjectLabel: string;
  recipientLabel: string;
  recipientPlaceholder: string;
  categories: string[];
};

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
  { category: '시스템', label: '고객센터 이메일', token: '{{support_email}}' }
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

export function getMessageChannelMeta(channel: MessageChannel): MessageChannelMeta {
  if (channel === 'mail') {
    return {
      title: '메일',
      subjectLabel: '메일 제목',
      recipientLabel: '테스트 이메일',
      recipientPlaceholder: 'admin@example.com',
      categories: ['온보딩', '결제', '운영', '마케팅', '고객 안내']
    };
  }

  return {
    title: '푸시',
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
  return {
    category: getMessageChannelMeta(channel).categories[0],
    name: '',
    summary: '',
    subject: '',
    targetGroupIds: groups.slice(0, 1).map((group) => group.id),
    status: mode === 'auto' ? '활성' : '초안',
    triggerLabel: mode === 'auto' ? '이벤트 발생 직후' : undefined
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

  if (isDescriptions) {
    const descriptionItems: DescriptionsProps['items'] = [
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
              options={meta.categories.map((category) => ({
                label: category,
                value: category
              }))}
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
          <Form.Item
            name="summary"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '운영 요약을 입력하세요.' }]}
          >
            <Input placeholder="운영자가 한눈에 파악할 수 있는 요약을 입력하세요." />
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
            rules={[{ required: true, message: '발송 그룹을 1개 이상 선택하세요.' }]}
          >
            <Select
              mode="multiple"
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

    return (
      <Descriptions
        bordered
        size="small"
        column={2}
        items={markRequiredDescriptionItems(descriptionItems, [
          'category',
          'status',
          'name',
          'summary',
          'subject',
          'targetGroupIds',
          ...(mode === 'auto' ? ['triggerLabel'] : []),
          ...(showBodyHtml ? ['bodyHtml'] : []),
          ...(showBodyHtml && showJsonBody ? ['bodyJson'] : [])
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

      <Form.Item
        label="요약"
        name="summary"
        rules={[{ required: true, message: '운영 요약을 입력하세요.' }]}
      >
        <Input placeholder="운영자가 한눈에 파악할 수 있는 요약을 입력하세요." />
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
        rules={[{ required: true, message: '발송 그룹을 1개 이상 선택하세요.' }]}
      >
        <Select
          mode="multiple"
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
