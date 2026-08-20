import {
  Alert,
  Button,
  Form,
  Space,
  Tabs,
  Typography,
  notification
} from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { messageDataSource } from '../api/message-data-source';
import {
  deleteMessageTemplateSafe,
  fetchChannelSnapshotSafe,
  saveMessageTemplateSafe,
  sendMessageTemplateSafe,
  toggleMessageTemplateSafe
} from '../api/messages-service';
import {
  MESSAGE_SEND_DATE_TIME_FORMAT,
  type MessageLiveSendFormValues,
  type MessageTemplateDangerState,
  type MessageTemplateEditorState,
  type MessageTestSendFormValues
} from '../model/message-channel-page-schema';
import type {
  MessageChannel,
  MessageGroup,
  MessageTemplate
} from '../model/types';
import { buildMessageAuditNoticeDescription } from '../ui/message-audit-notice';
import {
  createMessageChannelColumns,
  createMessageChannelTabItems,
  createMessageTemplateActionItems
} from '../ui/message-channel-columns';
import {
  buildMessageTemplatePreviewItems,
  getMessageEditBodyActionLabel,
  MessageLiveSendModal,
  MessageTemplateEditorModal,
  MessageTestSendModal
} from '../ui/message-channel-modals';
import {
  createEmptyMessageBodyJson,
  createTemplateMetaDefaults,
  getMessageChannelMeta,
  parseMessageTemplateMode,
  shouldShowNotificationLink,
  type TemplateMetaFormValues
} from '../ui/message-template-form-fields';
import type { AsyncState } from '@/shared/model/async-state';
import { useRouterStateNotice } from '@/shared/model/use-router-state-notice';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';
import { HtmlPreviewModal } from '@/shared/ui/html-preview-modal/html-preview-modal';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '@/shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '@/shared/ui/search-bar/use-search-bar-date-draft';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '@/shared/ui/search-bar/search-bar-utils';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { SPACE } from '@/shared/styles/design-tokens';
const { Text } = Typography;


type MessageChannelPageProps = {
  channel: MessageChannel;
};

export function MessageChannelPage({
  channel
}: MessageChannelPageProps): JSX.Element {
  const meta = useMemo(() => getMessageChannelMeta(channel), [channel]);
  const isSupabaseSource = messageDataSource === 'supabase';
  // 푸시 provider 미연동(contract §1) — supabase 모드에서 발송 액션만 봉인.
  const isSendBlocked = isSupabaseSource && channel === 'push';
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeMode = parseMessageTemplateMode(searchParams.get('tab'));
  const searchField = searchParams.get('searchField') ?? 'all';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const keyword = searchParams.get('keyword') ?? '';
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [groups, setGroups] = useState<MessageGroup[]>([]);
  const [loadState, setLoadState] = useState<AsyncState<null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [editorState, setEditorState] = useState<MessageTemplateEditorState>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [testTemplate, setTestTemplate] = useState<MessageTemplate | null>(null);
  const [liveTemplate, setLiveTemplate] = useState<MessageTemplate | null>(null);
  const [dangerState, setDangerState] = useState<MessageTemplateDangerState>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [templateForm] = Form.useForm<TemplateMetaFormValues>();
  const [testForm] = Form.useForm<MessageTestSendFormValues>();
  const [liveSendForm] = Form.useForm<MessageLiveSendFormValues>();

  const liveActionType = Form.useWatch('actionType', liveSendForm);
  useEffect(() => {
    const controller = new AbortController();

    setLoadState({
      status: 'pending',
      data: null,
      errorMessage: null,
      errorCode: null
    });

    void fetchChannelSnapshotSafe(channel, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setTemplates(result.data.templates);
        setGroups(result.data.groups);
        setLoadState({
          status: result.data.templates.length === 0 ? 'empty' : 'success',
          data: null,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setLoadState({
        status: 'error',
        data: null,
        errorMessage: result.error.message,
        errorCode: result.error.code
      });
    });

    return () => {
      controller.abort();
    };
  }, [channel, reloadKey]);

  const visibleTemplates = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return templates
      .filter((template) => template.mode === activeMode)
      .filter((template) => {
        const targetDate =
          activeMode === 'auto' ? template.lastSentAt ?? '' : template.updatedAt;
        if (!matchesSearchDateRange(targetDate, startDate, endDate)) {
          return false;
        }

        if (!normalizedKeyword) {
          return true;
        }

        return matchesSearchField(normalizedKeyword, searchField, {
          id: template.id,
          name: template.name,
          subject: template.subject,
          summary: template.summary
        });
      });
  }, [activeMode, endDate, keyword, searchField, startDate, templates]);

  const commitParams = useCallback(
    (
      next: Partial<
        Record<'tab' | 'searchField' | 'startDate' | 'endDate' | 'keyword', string>
      >
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete('status');

      Object.entries(next).forEach(([key, value]) => {
        if (!value || value === 'all') {
          merged.delete(key);
          return;
        }
        merged.set(key, value);
      });

      if (!merged.get('tab')) {
        merged.set('tab', activeMode);
      }

      setSearchParams(merged, { replace: true });
    },
    [activeMode, searchParams, setSearchParams]
  );

  const handleApplyDateRange = useCallback(() => {
    commitParams({
      startDate: draftStartDate,
      endDate: draftEndDate,
      keyword,
      searchField,
      tab: activeMode
    });
  }, [
    activeMode,
    commitParams,
    draftEndDate,
    draftStartDate,
    keyword,
    searchField
  ]);

  useRouterStateNotice(
    'messageTemplateContentSaved',
    (saved) => `${saved.templateId}:${saved.mode}`,
    (saved) => {
      notificationApi.success({
        message: `${meta.title} 본문 저장 완료`,
        description: buildMessageAuditNoticeDescription(saved.templateId, [
          `조치: ${saved.mode === 'auto' ? '자동 발송 본문 작성' : '수동 발송 본문 작성'}`
        ])
      });
    }
  );

  const openCreateModal = useCallback(() => {
    templateForm.setFieldsValue(createTemplateMetaDefaults(channel, activeMode, groups));
    setEditorState({ kind: 'create' });
  }, [activeMode, channel, groups, templateForm]);

  const openTemplateDetail = useCallback(
    (template: MessageTemplate) => {
      const nextSearchParams = new URLSearchParams(searchParams);

      nextSearchParams.set('tab', template.mode);

      navigate({
        pathname: `${meta.basePath}/create/${template.id}`,
        search: `?${nextSearchParams.toString()}`
      });
    },
    [meta.basePath, navigate, searchParams]
  );

  const openEditModal = useCallback(
    (template: MessageTemplate) => {
      templateForm.setFieldsValue({
        category: template.category,
        name: template.name,
        summary: template.summary,
        subject: template.subject,
        targetGroupIds: template.targetGroupIds,
        status: template.status,
        triggerLabel: template.triggerLabel,
        // 이동 경로(link_url)는 인앱/푸시(supabase는 전 채널)에서 노출되므로 함께 채운다.
        ...(shouldShowNotificationLink(channel)
          ? { linkUrl: template.linkUrl ?? '' }
          : {}),
        // 메일 전용: 본문 하단 자동 삽입 CTA 버튼 문구.
        ...(channel === 'mail' && isSupabaseSource
          ? { ctaLabel: template.ctaLabel ?? '' }
          : {}),
        ...(isSupabaseSource
          ? {
              templateKey: template.templateKey,
              templateClass: template.templateClass,
              mandatory: template.mandatory ?? false,
              reason: ''
            }
          : {})
      });
      setEditorState({ kind: 'edit', template });
    },
    [channel, isSupabaseSource, templateForm]
  );
  const openPreviewModal = useCallback((template: MessageTemplate) => {
    setPreviewTemplate(template);
  }, []);

  const closeEditor = useCallback(() => {
    templateForm.resetFields();
    setEditorState(null);
  }, [templateForm]);
  const closeDanger = useCallback(() => setDangerState(null), []);
  const closePreview = useCallback(() => setPreviewTemplate(null), []);
  const closeTestModal = useCallback(() => setTestTemplate(null), []);
  const closeLiveModal = useCallback(() => setLiveTemplate(null), []);

  const handleSaveTemplate = useCallback(async () => {
    if (!editorState) {
      return;
    }

    const values = (await templateForm.validateFields()) as TemplateMetaFormValues;
    const result =
      editorState.kind === 'create'
        ? await saveMessageTemplateSafe({
            channel,
            mode: activeMode,
            ...values,
            bodyHtml: '',
            bodyJson: createEmptyMessageBodyJson()
          })
        : await saveMessageTemplateSafe({
            ...editorState.template,
            ...values
          });

    if (!result.ok) {
      notificationApi.error({
        message: `${meta.title} 템플릿 저장 실패`,
        description: result.error.message
      });
      return;
    }

    const saved = result.data;
    setTemplates((prev) => {
      const exists = prev.some((template) => template.id === saved.id);
      return exists
        ? prev.map((template) => (template.id === saved.id ? saved : template))
        : [saved, ...prev];
    });

    notificationApi.success({
      message:
        editorState.kind === 'create'
          ? `${meta.title} 템플릿 등록 완료`
          : `${meta.title} 템플릿 정보 수정 완료`,
      description: buildMessageAuditNoticeDescription(saved.id, [
        `조치: ${
          editorState.kind === 'create'
            ? activeMode === 'auto'
              ? '자동 발송 템플릿 등록'
              : '수동 발송 템플릿 등록'
            : activeMode === 'auto'
              ? '자동 발송 템플릿 정보 수정'
              : '수동 발송 템플릿 정보 수정'
        }`,
        editorState.kind === 'create' &&
          '다음 단계: 생성된 행을 클릭해 등록 상세에서 본문을 작성하세요.'
      ])
    });
    closeEditor();
  }, [
    activeMode,
    channel,
    closeEditor,
    editorState,
    meta.title,
    notificationApi,
    templateForm
  ]);

  const handleDangerConfirm = useCallback(
    async (reason: string) => {
      if (!dangerState) {
        return;
      }

      if (dangerState.type === 'delete') {
        const result = await deleteMessageTemplateSafe(dangerState.template.id, reason);

        if (!result.ok || !result.data) {
          if (!result.ok) {
            notificationApi.error({
              message: meta.title + ' \uD15C\uD50C\uB9BF \uC0AD\uC81C \uC2E4\uD328',
              description: result.error.message
            });
          }
          return;
        }

        const removed = result.data;
        setTemplates((prev) =>
          prev.filter((template) => template.id !== removed.id)
        );
        notificationApi.success({
          message: meta.title + ' \uD15C\uD50C\uB9BF \uC0AD\uC81C \uC644\uB8CC',
          description: buildMessageAuditNoticeDescription(removed.id, [
            `사유/근거: ${reason}`
          ])
        });
      }

      if (dangerState.type === 'toggle') {
        const result = await toggleMessageTemplateSafe({
          templateId: dangerState.template.id,
          nextStatus: dangerState.nextStatus,
          reason
        });

        if (!result.ok || !result.data) {
          if (!result.ok) {
            notificationApi.error({
              message: meta.title + ' \uD15C\uD50C\uB9BF \uC0C1\uD0DC \uBCC0\uACBD \uC2E4\uD328',
              description: result.error.message
            });
          }
          return;
        }

        const updated = result.data;
        setTemplates((prev) =>
          prev.map((template) => (template.id === updated.id ? updated : template))
        );
        notificationApi.success({
          message: meta.title + ' \uD15C\uD50C\uB9BF \uC0C1\uD0DC \uBCC0\uACBD \uC644\uB8CC',
          description: buildMessageAuditNoticeDescription(updated.id, [
            `사유/근거: ${reason}`
          ])
        });
      }

      setDangerState(null);
    },
    [dangerState, meta.title, notificationApi]
  );

  const openTestSendModal = useCallback(
    (template: MessageTemplate) => {
      testForm.setFieldsValue({
        recipient: meta.recipientPlaceholder,
        reason: ''
      });
      setTestTemplate(template);
    },
    [meta.recipientPlaceholder, testForm]
  );

  const openStatusToggleConfirm = useCallback((template: MessageTemplate) => {
    if (template.status !== '활성' && template.status !== '비활성') {
      return;
    }

    setDangerState({
      type: 'toggle',
      template,
      nextStatus: template.status === '활성' ? '비활성' : '활성'
    });
  }, []);

  const handleTestSend = useCallback(async () => {
    if (!testTemplate) {
      return;
    }

    const values = await testForm.validateFields();

    if (isSupabaseSource) {
      // admin_send_notification p_target_type='test' — 그룹 없이 본인 대상 실행 생성.
      const result = await sendMessageTemplateSafe({
        templateId: testTemplate.id,
        channel,
        groupIds: [],
        actor: 'admin_current',
        actionType: '즉시 발송',
        reason: values.reason,
        targetType: 'test'
      });

      if (!result.ok || !result.data) {
        if (!result.ok) {
          notificationApi.error({
            message: `${meta.title} 나에게 보내기 실패`,
            description: result.error.message
          });
        }
        return;
      }

      notificationApi.success({
        message: `${meta.title} 나에게 보내기 실행 생성 완료`,
        description: buildMessageAuditNoticeDescription(result.data.id, [
          `사유/근거: ${values.reason}`,
          '전달은 발송 파이프라인이 처리합니다. 발송 이력에서 상태를 확인하세요.'
        ])
      });
      setTestTemplate(null);
      return;
    }

    notificationApi.success({
      message: `${meta.title} 나에게 보내기 완료`,
      description: buildMessageAuditNoticeDescription(testTemplate.id, [
        `테스트 수신자: ${values.recipient}`,
        `사유/근거: ${values.reason}`
      ])
    });
    setTestTemplate(null);
  }, [channel, isSupabaseSource, meta.title, notificationApi, testForm, testTemplate]);

  const openLiveSendModal = useCallback(
    (template: MessageTemplate) => {
      liveSendForm.setFieldsValue({
        targetGroupIds: template.targetGroupIds,
        actionType: '즉시 발송',
        scheduledAt: undefined,
        reason: ''
      });
      setLiveTemplate(template);
    },
    [liveSendForm]
  );

  const handleLiveSend = useCallback(async () => {
    if (!liveTemplate) {
      return;
    }

    const values = await liveSendForm.validateFields();

    // 0명 그룹만 선택하면 빈 발송이 '완료 0건'으로 조용히 성공한다(QA N-ADM-07).
    // 나에게 보내기(test)는 본인 대상이라 예외 — 여기서는 group 발송만 차단한다.
    const selectedMemberTotal = groups
      .filter((group) => values.targetGroupIds.includes(group.id))
      .reduce((total, group) => total + group.memberCount, 0);
    if (selectedMemberTotal <= 0) {
      notificationApi.warning({
        message: `${meta.title} 발송 대상 없음`,
        description:
          '선택한 그룹에 수신 대상이 없습니다. 대상이 있는 그룹을 선택하세요.'
      });
      return;
    }

    const result = await sendMessageTemplateSafe({
      templateId: liveTemplate.id,
      channel,
      groupIds: values.targetGroupIds,
      actor: 'admin_current',
      actionType: values.actionType,
      scheduledAt:
        values.actionType === '예약 발송'
          ? values.scheduledAt?.format(MESSAGE_SEND_DATE_TIME_FORMAT)
          : undefined,
      reason: values.reason,
      targetType: 'group'
    });

    if (!result.ok || !result.data) {
      if (!result.ok) {
        notificationApi.error({
          message: `${meta.title} 발송 실패`,
          description: result.error.message
        });
      }
      return;
    }

    notificationApi.success({
      message:
        values.actionType === '예약 발송'
          ? `${meta.title} 예약 발송 등록 완료`
          : `${meta.title} 발송 완료`,
      description: buildMessageAuditNoticeDescription(result.data.id, [
        `사유/근거: ${values.reason}`
      ])
    });
    setLiveTemplate(null);
    setReloadKey((prev) => prev + 1);
  }, [channel, groups, liveSendForm, liveTemplate, meta.title, notificationApi]);

  const buildActionItems = useCallback(
    (template: MessageTemplate) =>
      createMessageTemplateActionItems(template, {
        activeMode,
        isSendBlocked,
        onEditMeta: openEditModal,
        onTestSend: openTestSendModal,
        onLiveSend: openLiveSendModal,
        onDelete: (target) => setDangerState({ type: 'delete', template: target })
      }),
    [activeMode, isSendBlocked, openEditModal, openLiveSendModal, openTestSendModal]
  );

  const columns = useMemo(
    () =>
      createMessageChannelColumns({
        activeMode,
        groups,
        categories: meta.categories,
        subjectLabel: meta.subjectLabel,
        buildActionItems,
        onStatusToggle: openStatusToggleConfirm
      }),
    [activeMode, buildActionItems, groups, meta.categories, meta.subjectLabel, openStatusToggleConfirm]
  );

  const tabItems = useMemo(() => createMessageChannelTabItems(templates), [templates]);

  const handleRetryLoad = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleRowClick = useCallback(
    (record: MessageTemplate) => ({
      onClick: () => openPreviewModal(record),
      style: { cursor: 'pointer' }
    }),
    [openPreviewModal]
  );

  const editorMode =
    editorState?.kind === 'edit' ? editorState.template.mode : activeMode;
  const previewDescriptionItems = previewTemplate
    ? buildMessageTemplatePreviewItems(previewTemplate, groups, channel)
    : [];
  const previewFooterActions = previewTemplate
    ? [
        <Button key="edit" type="primary" onClick={() => openTemplateDetail(previewTemplate)}>
          {getMessageEditBodyActionLabel(channel)}
        </Button>
      ]
    : [];

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title={meta.title} />

      {isSendBlocked ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: SPACE.sm }}
          message="푸시 발송 준비 중"
          description="푸시 provider 미연동으로 발송 실행과 나에게 보내기가 비활성화되어 있습니다. 템플릿 등록/수정/삭제는 가능합니다."
        />
      ) : null}

      {loadState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: SPACE.sm }}
          message={`${meta.title} 데이터 조회에 실패했습니다.`}
          description={
            <Space direction="vertical" size={4}>
              <Text>{loadState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
              <Text type="secondary">오류 코드: {loadState.errorCode ?? '-'}</Text>
              <Space>
                <Button onClick={handleRetryLoad}>재시도</Button>
                <Text type="secondary">마지막 성공 상태를 기준으로 화면을 복구할 수 있습니다.</Text>
              </Space>
            </Space>
          }
        />
      ) : null}

      <AdminListCard
        toolbar={
          <div className="message-channel-card-toolbar">
            <Tabs
              activeKey={activeMode}
              items={tabItems}
              onChange={(nextTab) => commitParams({ tab: nextTab, keyword })}
              className="message-channel-card-tabs"
            />
            <SearchBar
              searchField={searchField}
              searchFieldOptions={[
                { label: '전체', value: 'all' },
                { label: '템플릿 ID', value: 'id' },
                { label: '템플릿명', value: 'name' },
                { label: '제목', value: 'subject' },
                { label: '요약', value: 'summary' }
              ]}
              keyword={keyword}
              onSearchFieldChange={(value) =>
                commitParams({ searchField: value, tab: activeMode })
              }
              onKeywordChange={(event) =>
                commitParams({
                  keyword: event.target.value,
                  searchField,
                  tab: activeMode
                })
              }
              keywordPlaceholder="검색..."
              detailTitle="상세 검색"
              detailContent={
                <SearchBarDetailField
                  label={activeMode === 'auto' ? '최근 발송일' : '최근 수정일'}
                >
                  <SearchBarDateRange
                    startDate={draftStartDate}
                    endDate={draftEndDate}
                    onChange={handleDraftDateChange}
                  />
                </SearchBarDetailField>
              }
              onApply={handleApplyDateRange}
              onDetailOpenChange={handleDetailOpenChange}
              onReset={handleDraftReset}
              summary={
                <Text type="secondary">총 {visibleTemplates.length.toLocaleString()}건</Text>
              }
              actions={
                <Button
                  type="primary"
                  size="large"
                  onClick={openCreateModal}
                  disabled={groups.length === 0}
                  data-testid={channel === 'mail' ? 'message-mail-create-button' : undefined}
                >
                  {activeMode === 'auto'
                    ? '자동 발송 템플릿 등록'
                    : '수동 발송 템플릿 등록'}
                </Button>
              }
            />
          </div>
        }
      >
        {groups.length === 0 ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: SPACE.sm }}
            message="선택 가능한 발송 그룹이 없습니다."
            description="대상 그룹을 먼저 생성한 뒤 템플릿 등록을 진행하세요."
          />
        ) : null}
        {loadState.status !== 'pending' && visibleTemplates.length === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: SPACE.sm }}
            message={`${meta.title} ${activeMode === 'auto' ? '자동 발송' : '수동 발송'} 템플릿이 없습니다.`}
            description="필터 조건을 조정하거나 새 템플릿을 등록하세요."
          />
        ) : null}
        <AdminDataTable<MessageTemplate>
          rowKey="id"
          columns={columns}
          dataSource={visibleTemplates}
          onRow={handleRowClick}
          loading={loadState.status === 'pending'}
          pagination={false}
          scroll={{ x: 1600 }}
        />
      </AdminListCard>

      <MessageTemplateEditorModal
        editorState={editorState}
        editorMode={editorMode}
        channel={channel}
        groups={groups}
        form={templateForm}
        onOk={handleSaveTemplate}
        onCancel={closeEditor}
      />

      <HtmlPreviewModal
        open={Boolean(previewTemplate)}
        title={`${meta.title} 템플릿 미리보기`}
        descriptionItems={previewDescriptionItems}
        bodyHtml={previewTemplate?.bodyHtml}
        footerActions={previewFooterActions}
        width={920}
        onClose={closePreview}
        emptyDescription="행을 클릭해 등록 상세에서 본문을 먼저 저장하세요."
      />

      <MessageTestSendModal
        template={testTemplate}
        metaTitle={meta.title}
        recipientLabel={meta.recipientLabel}
        recipientPlaceholder={meta.recipientPlaceholder}
        form={testForm}
        onOk={handleTestSend}
        onCancel={closeTestModal}
      />

      <MessageLiveSendModal
        template={liveTemplate}
        metaTitle={meta.title}
        activeMode={activeMode}
        groups={groups}
        liveActionType={liveActionType}
        form={liveSendForm}
        onOk={handleLiveSend}
        onCancel={closeLiveModal}
      />

      {dangerState ? (
        <ConfirmAction
          open
          title={
            dangerState.type === 'delete'
              ? `${meta.title} 템플릿 삭제`
              : `${meta.title} 자동 발송 ${dangerState.nextStatus === '활성' ? '활성화' : '비활성화'}`
          }
          description={
            dangerState.type === 'delete'
              ? '템플릿을 삭제하면 같은 구성으로 즉시 발송할 수 없습니다. 삭제 사유를 기록하세요.'
              : '자동 발송 상태를 변경하면 예정된 운영 흐름이 바뀝니다. 변경 사유를 기록하세요.'
          }
          targetType="Message"
          targetId={dangerState.template.id}
          confirmText={
            dangerState.type === 'delete'
              ? '삭제 실행'
              : dangerState.nextStatus === '활성'
                ? '활성화 실행'
                : '비활성화 실행'
          }
          onCancel={closeDanger}
          onConfirm={handleDangerConfirm}
        />
      ) : null}
    </div>
  );
}
