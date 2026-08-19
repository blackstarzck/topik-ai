import { DatePicker, Descriptions, Form, Input, Modal, Select } from 'antd';
import type { DescriptionsProps, FormInstance } from 'antd';

import {
  MESSAGE_SEND_DATE_TIME_FORMAT,
  renderMessageGroupNames
} from '../model/message-channel-page-schema';
import type {
  MessageLiveSendFormValues,
  MessageTemplateEditorState,
  MessageTestSendFormValues
} from '../model/message-channel-page-schema';
import type {
  MessageChannel,
  MessageGroup,
  MessageTemplate,
  MessageTemplateMode
} from '../model/types';
import {
  MessageTemplateFormFields,
  shouldShowNotificationLink,
  type TemplateMetaFormValues
} from './message-template-form-fields';
import { markRequiredDescriptionItems } from '@/shared/ui/descriptions/description-label';

// 채널 공용 템플릿 모달 3종(정보 등록/수정·나에게 보내기·발송 실행)과 미리보기 항목 빌더
// — Phase 4 분해로 페이지 본문에서 이동(동작 동일). 폼 인스턴스·검증·제출·알림은
// 페이지가 소유하고 props 로 받는다(Form.Item 은 전달받은 <Form form> 컨텍스트로 동작).

export function buildMessageTemplatePreviewItems(
  previewTemplate: MessageTemplate,
  groups: MessageGroup[],
  channel: MessageChannel
): DescriptionsProps['items'] {
  return [
    {
      key: 'templateId',
      label: '템플릿 ID',
      children: previewTemplate.id
    },
    {
      key: 'templateName',
      label: '템플릿명',
      children: previewTemplate.name
    },
    {
      key: 'targetGroups',
      label: '발송 그룹',
      children: renderMessageGroupNames(groups, previewTemplate.targetGroupIds)
    },
    ...(shouldShowNotificationLink(channel)
      ? [
          {
            key: 'linkUrl',
            label: channel === 'mail' ? 'CTA 링크' : '이동 경로',
            children:
              previewTemplate.linkUrl && previewTemplate.linkUrl.trim().length > 0
                ? previewTemplate.linkUrl
                : channel === 'mail'
                  ? '미설정 (CTA 버튼 없음)'
                  : '미설정 (앱 기본 화면)'
          }
        ]
      : []),
    // 메일: 발송 시 본문 하단에 자동 삽입되는 CTA 버튼 문구(편집 화면 본문에는 미노출).
    ...(channel === 'mail' &&
    previewTemplate.linkUrl &&
    previewTemplate.linkUrl.trim().length > 0
      ? [
          {
            key: 'ctaLabel',
            label: 'CTA 버튼 문구',
            children:
              previewTemplate.ctaLabel && previewTemplate.ctaLabel.trim().length > 0
                ? previewTemplate.ctaLabel
                : '알림 확인하기 (기본값)'
          }
        ]
      : [])
  ];
}

// 미리보기의 기본 액션은 본문 작성 화면(등록 상세)으로 이동하므로 '본문 수정'으로 라벨링.
// 공용 channel page이므로 채널별로 표기를 맞춘다.
export function getMessageEditBodyActionLabel(channel: MessageChannel): string {
  return channel === 'mail'
    ? '이메일 본문 수정'
    : channel === 'push'
      ? '푸시 본문 수정'
      : '인앱 알림 본문 수정';
}

export type MessageTemplateEditorModalProps = {
  editorState: MessageTemplateEditorState;
  editorMode: MessageTemplateMode;
  channel: MessageChannel;
  groups: MessageGroup[];
  form: FormInstance<TemplateMetaFormValues>;
  onOk: () => void;
  onCancel: () => void;
};

export function MessageTemplateEditorModal({
  editorState,
  editorMode,
  channel,
  groups,
  form,
  onOk,
  onCancel
}: MessageTemplateEditorModalProps): JSX.Element {
  return (
    <Modal
      open={Boolean(editorState)}
      title={
        editorState?.kind === 'create'
          ? editorMode === 'auto'
            ? '자동 발송 템플릿 등록'
            : '수동 발송 템플릿 등록'
          : editorMode === 'auto'
            ? '자동 발송 템플릿 정보 수정'
            : '수동 발송 템플릿 정보 수정'
      }
      okText={editorState?.kind === 'create' ? '등록' : '저장'}
      cancelText="취소"
      width={840}
      onCancel={onCancel}
      onOk={onOk}
      destroyOnHidden
    >
      <Form form={form}>
        <MessageTemplateFormFields
          channel={channel}
          mode={editorMode}
          groups={groups}
          variant="descriptions"
          showBodyHtml={false}
          showJsonBody={false}
        />
      </Form>
    </Modal>
  );
}

export type MessageTestSendModalProps = {
  template: MessageTemplate | null;
  metaTitle: string;
  recipientLabel: string;
  recipientPlaceholder: string;
  form: FormInstance<MessageTestSendFormValues>;
  onOk: () => void;
  onCancel: () => void;
};

export function MessageTestSendModal({
  template,
  metaTitle,
  recipientLabel,
  recipientPlaceholder,
  form,
  onOk,
  onCancel
}: MessageTestSendModalProps): JSX.Element {
  return (
    <Modal
      open={Boolean(template)}
      title={`${metaTitle} 나에게 보내기`}
      okText="발송"
      cancelText="취소"
      onCancel={onCancel}
      onOk={onOk}
      destroyOnHidden
    >
      <Form form={form}>
        <Descriptions
          bordered
          size="small"
          column={1}
          className="message-template-form-descriptions"
          items={markRequiredDescriptionItems(
            [
              {
                key: 'recipient',
                label: recipientLabel,
                children: (
                  <Form.Item
                    name="recipient"
                    rules={[{ required: true, message: `${recipientLabel}을 입력하세요.` }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input placeholder={recipientPlaceholder} />
                  </Form.Item>
                )
              },
              {
                key: 'reason',
                label: '사유/근거',
                children: (
                  <Form.Item
                    name="reason"
                    rules={[{ required: true, message: '테스트 발송 사유를 입력하세요.' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea rows={4} placeholder="예: 템플릿 렌더링과 링크 확인" />
                  </Form.Item>
                )
              }
            ],
            ['recipient', 'reason']
          )}
        />
      </Form>
    </Modal>
  );
}

export type MessageLiveSendModalProps = {
  template: MessageTemplate | null;
  metaTitle: string;
  activeMode: MessageTemplateMode;
  groups: MessageGroup[];
  liveActionType: MessageLiveSendFormValues['actionType'] | undefined;
  form: FormInstance<MessageLiveSendFormValues>;
  onOk: () => void;
  onCancel: () => void;
};

export function MessageLiveSendModal({
  template,
  metaTitle,
  activeMode,
  groups,
  liveActionType,
  form,
  onOk,
  onCancel
}: MessageLiveSendModalProps): JSX.Element {
  return (
    <Modal
      open={Boolean(template)}
      title={`${metaTitle} ${activeMode === 'auto' ? '즉시 실행' : '발송 실행'}`}
      okText={liveActionType === '예약 발송' ? '예약 등록' : '발송 실행'}
      cancelText="취소"
      onCancel={onCancel}
      onOk={onOk}
      destroyOnHidden
    >
      <Form form={form}>
        <Descriptions
          bordered
          size="small"
          column={1}
          className="message-template-form-descriptions"
          items={markRequiredDescriptionItems(
            [
              {
                key: 'targetGroupIds',
                label: '발송 그룹',
                children: (
                  <Form.Item
                    name="targetGroupIds"
                    rules={[{ required: true, message: '발송 그룹을 선택하세요.' }]}
                    style={{ marginBottom: 0 }}
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
              },
              {
                key: 'actionType',
                label: '발송 방식',
                children: (
                  <Form.Item
                    name="actionType"
                    rules={[{ required: true, message: '발송 방식을 선택하세요.' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      options={[
                        { label: '즉시 발송', value: '즉시 발송' },
                        { label: '예약 발송', value: '예약 발송' }
                      ]}
                    />
                  </Form.Item>
                )
              },
              ...(liveActionType === '예약 발송'
                ? [
                    {
                      key: 'scheduledAt',
                      label: '예약 시각',
                      children: (
                        <Form.Item
                          name="scheduledAt"
                          rules={[{ required: true, message: '예약 시각을 선택하세요.' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <DatePicker
                            showTime
                            format={MESSAGE_SEND_DATE_TIME_FORMAT}
                            placeholder="예약 시각 선택"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      )
                    }
                  ]
                : []),
              {
                key: 'reason',
                label: '사유/근거',
                children: (
                  <Form.Item
                    name="reason"
                    rules={[{ required: true, message: '발송 사유를 입력하세요.' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea
                      rows={4}
                      placeholder="예: 월간 캠페인 발송, 결제 실패 대응"
                    />
                  </Form.Item>
                )
              }
            ],
            [
              'targetGroupIds',
              'actionType',
              'reason',
              ...(liveActionType === '예약 발송' ? ['scheduledAt'] : [])
            ]
          )}
        />
      </Form>
    </Modal>
  );
}
