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
  category: '회원' | '발송' | '시스템;
  label: string;
  token: string;
};

const MESSAGE_TEMPLATE_VARIABLES: readonly MessageTemplateVariable[] = [
  { category: '회원', label: '회원 이름', token: '{{user_name}}' },
  { category: '회원', label: '회원 ID', token: '{{user_id}}' },
  { category: '회원', label: '회원 이메일, token: '{{user_email}}' },
  { category: '발송', label: '대상洹몃９紐?, token: '{{group_name}}' },
  { category: '발송', label: '?쒗뵆由용챸', token: '{{template_name}}' },
  { category: '발송', label: '발송 시각', token: '{{sent_at}}' },
  { category: '시스템, label: '?쒕퉬설명', token: '{{service_name}}' },
  { category: '시스템, label: '??留곹겕', token: '{{app_link}}' },
  { category: '시스템, label: '怨좉컼?쇳꽣 이메일, token: '{{support_email}}' }
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
      text: `${variable.category} 쨌 ${variable.label} ${variable.token}`,
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
          text: '?섍꼍蹂??,
          tooltip: '?섍꼍蹂???쎌엯',
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
      title: '硫붿씪',
      subjectLabel: '硫붿씪 제목',
      recipientLabel: '?뚯뒪??이메일,
      recipientPlaceholder: 'admin@example.com',
      categories: ['?⑤낫??, '결제', '운영', '留덉???, '怨좉컼 ?덈궡']
    };
  }

  return {
    title: '?몄떆',
    subjectLabel: '?몄떆 제목',
    recipientLabel: '?뚯뒪???붾컮?댁뒪 ?좏겙',
    recipientPlaceholder: 'device-token-demo-001',
    categories: ['운영', '결제', '커뮤니티', '留덉???]
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
    status: mode === 'auto' ? '활성' : '珥덉븞',
    triggerLabel: mode === 'auto' ? '?대깽??諛쒖깮 吏곹썑' : undefined
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
        label: '移댄뀒怨좊━',
        children: (
          <Form.Item
            name="category"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '移댄뀒怨좊━瑜??좏깮?섏꽭??' }]}
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
            rules={[{ required: true, message: '상태瑜??좏깮?섏꽭??' }]}
          >
            <Select
              options={[
                { label: '활성', value: '활성' },
                { label: '비활성, value: '비활성 },
                { label: '珥덉븞', value: '珥덉븞' }
              ]}
            />
          </Form.Item>
        )
      },
      {
        key: 'name',
        label: '?쒗뵆由용챸',
        span: 2,
        children: (
          <Form.Item
            name="name"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '?쒗뵆由용챸???낅젰?섏꽭??' }]}
          >
            <Input placeholder={`${meta.title} ?쒗뵆由용챸???낅젰?섏꽭??`} />
          </Form.Item>
        )
      },
      {
        key: 'summary',
        label: '?붿빟',
        span: 2,
        children: (
          <Form.Item
            name="summary"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '운영 ?붿빟???낅젰?섏꽭??' }]}
          >
            <Input placeholder="운영?먭? ?쒕늿???뚯븙?????덈뒗 ?붿빟???낅젰?섏꽭??" />
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
            rules={[{ required: true, message: `${meta.subjectLabel}???낅젰?섏꽭??` }]}
          >
            <Input placeholder={`${meta.subjectLabel}???낅젰?섏꽭??`} />
          </Form.Item>
        )
      },
      {
        key: 'targetGroupIds',
        label: '발송 洹몃９',
        span: 2,
        children: (
          <Form.Item
            name="targetGroupIds"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '발송 洹몃９??1媛??댁긽 ?좏깮?섏꽭??' }]}
          >
            <Select
              mode="multiple"
              options={groups.map((group) => ({
                label: `${group.name} (${group.memberCount.toLocaleString()}紐?`,
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
        label: '?먮룞 議곌굔',
        span: 2,
        children: (
          <Form.Item
            name="triggerLabel"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '?먮룞 議곌굔???낅젰?섏꽭??' }]}
          >
            <Input placeholder="?? 회원 媛??吏곹썑, 결제 실패 수1?쒓컙" />
          </Form.Item>
        )
      });
    }

    if (showBodyHtml) {
      descriptionItems.push({
        key: 'bodyHtml',
        label: '蹂몃Ц',
        span: 2,
        children: (
          <Form.Item
            name="bodyHtml"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: '蹂몃Ц???낅젰?섏꽭??' }]}
          >
            <MessageHtmlEditor editorId={editorId} />
          </Form.Item>
        )
      });
    }

    if (showBodyHtml && showJsonBody) {
      descriptionItems.push({
        key: 'bodyJson',
        label: 'JSON 蹂몃Ц',
        span: 2,
        children: (
          <Form.Item
            name="bodyJson"
            style={{ marginBottom: 0 }}
            rules={[{ required: true, message: 'JSON 蹂몃Ц???낅젰?섏꽭??' }]}
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
        label="移댄뀒怨좊━"
        name="category"
        rules={[{ required: true, message: '移댄뀒怨좊━瑜??좏깮?섏꽭??' }]}
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
        rules={[{ required: true, message: '상태瑜??좏깮?섏꽭??' }]}
      >
        <Select
          options={[
            { label: '활성', value: '활성' },
            { label: '비활성, value: '비활성 },
            { label: '珥덉븞', value: '珥덉븞' }
          ]}
        />
      </Form.Item>

      <Form.Item
        label="?쒗뵆由용챸"
        name="name"
        rules={[{ required: true, message: '?쒗뵆由용챸???낅젰?섏꽭??' }]}
      >
        <Input placeholder={`${meta.title} ?쒗뵆由용챸???낅젰?섏꽭??`} />
      </Form.Item>

      <Form.Item
        label="?붿빟"
        name="summary"
        rules={[{ required: true, message: '운영 ?붿빟???낅젰?섏꽭??' }]}
      >
        <Input placeholder="운영?먭? ?쒕늿???뚯븙?????덈뒗 ?붿빟???낅젰?섏꽭??" />
      </Form.Item>

      <Form.Item
        label={meta.subjectLabel}
        name="subject"
        rules={[{ required: true, message: `${meta.subjectLabel}???낅젰?섏꽭??` }]}
      >
        <Input placeholder={`${meta.subjectLabel}???낅젰?섏꽭??`} />
      </Form.Item>

      <Form.Item
        label="발송 洹몃９"
        name="targetGroupIds"
        rules={[{ required: true, message: '발송 洹몃９??1媛??댁긽 ?좏깮?섏꽭??' }]}
      >
        <Select
          mode="multiple"
          options={groups.map((group) => ({
            label: `${group.name} (${group.memberCount.toLocaleString()}紐?`,
            value: group.id
          }))}
        />
      </Form.Item>

      {mode === 'auto' ? (
        <Form.Item
          label="?먮룞 議곌굔"
          name="triggerLabel"
          rules={[{ required: true, message: '?먮룞 議곌굔???낅젰?섏꽭??' }]}
        >
          <Input placeholder="?? 회원 媛??吏곹썑, 결제 실패 수1?쒓컙" />
        </Form.Item>
      ) : null}

      {showBodyHtml ? (
        <Form.Item
          label="蹂몃Ц"
          name="bodyHtml"
          rules={[{ required: true, message: '蹂몃Ц???낅젰?섏꽭??' }]}
        >
          <MessageHtmlEditor editorId={editorId} />
        </Form.Item>
      ) : null}

      {showBodyHtml && showJsonBody ? (
        <Form.Item
          label="JSON 蹂몃Ц"
          name="bodyJson"
          rules={[{ required: true, message: 'JSON 蹂몃Ц???낅젰?섏꽭??' }]}
          style={{ marginBottom: 0 }}
        >
          <Input.TextArea rows={8} placeholder='{"blocks":[]}' />
        </Form.Item>
      ) : null}
    </>
  );
}


