import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tabs,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { fetchChannelSnapshotSafe } from '../api/messages-service';
import { useMessageStore } from '../model/message-store';
import type {
  MessageChannel,
  MessageGroup,
  MessageTemplate,
  MessageTemplateStatus
} from '../model/types';
import {
  createEmptyMessageBodyJson,
  createTemplateMetaDefaults,
  MessageTemplateFormFields,
  getMessageChannelMeta,
  parseMessageTemplateMode,
  type TemplateMetaFormValues
} from '../ui/message-template-form-fields';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { markRequiredDescriptionItems } from '../../../shared/ui/descriptions/description-label';
import { HtmlPreviewModal } from '../../../shared/ui/html-preview-modal/html-preview-modal';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { BinaryStatusSwitch } from '../../../shared/ui/table/binary-status-switch';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Text } = Typography;

const messageTemplateStatusFilterValues = ['활성', '비활성, '珥덉븞'] as const;
const DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm';

type MessageChannelPageProps = {
  channel: MessageChannel;
};

type TestSendFormValues = {
  recipient: string;
  reason: string;
};

type LiveSendFormValues = {
  targetGroupIds: string[];
  actionType: '즉시 발송' | '예약 발송';
  scheduledAt?: Dayjs;
  reason: string;
};

type TemplateEditorState =
  | { kind: 'create' }
  | { kind: 'edit'; template: MessageTemplate }
  | null;

type DangerState =
  | { type: 'delete'; template: MessageTemplate }
  | {
    type: 'toggle';
    template: MessageTemplate;
    nextStatus: Extract<MessageTemplateStatus, '활성' | '비활성>;
  }
  | null;

function renderGroupNames(groups: MessageGroup[], groupIds: string[]): string {
  const names = groups
    .filter((group) => groupIds.includes(group.id))
    .map((group) => group.name);
  return names.length > 0 ? names.join(', ') : '-';
}

export function MessageChannelPage({
  channel
}: MessageChannelPageProps): JSX.Element {
  const meta = useMemo(() => getMessageChannelMeta(channel), [channel]);
  const location = useLocation();
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

  const templates = useMessageStore((state) =>
    state.templates.filter((template) => template.channel === channel)
  );
  const groups = useMessageStore((state) =>
    state.groups.filter((group) => group.channels.includes(channel))
  );
  const saveTemplate = useMessageStore((state) => state.saveTemplate);
  const toggleTemplate = useMessageStore((state) => state.toggleTemplate);
  const deleteTemplate = useMessageStore((state) => state.deleteTemplate);
  const sendTemplate = useMessageStore((state) => state.sendTemplate);

  const [loadState, setLoadState] = useState<AsyncState<null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [editorState, setEditorState] = useState<TemplateEditorState>(null);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);
  const [testTemplate, setTestTemplate] = useState<MessageTemplate | null>(null);
  const [liveTemplate, setLiveTemplate] = useState<MessageTemplate | null>(null);
  const [dangerState, setDangerState] = useState<DangerState>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [templateForm] = Form.useForm<TemplateMetaFormValues>();
  const [testForm] = Form.useForm<TestSendFormValues>();
  const [liveSendForm] = Form.useForm<LiveSendFormValues>();

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

  useEffect(() => {
    const state = location.state as
      | {
        messageTemplateContentSaved?: {
          templateId: string;
          mode: 'auto' | 'manual';
        };
      }
      | null;

    if (!state?.messageTemplateContentSaved) {
      return;
    }

    notificationApi.success({
      message: `${meta.title} 蹂몃Ц 대상완료`,
      description: (
        <Space direction="vertical">
          <Text>대상?좏삎: {getTargetTypeLabel('Message')}</Text>
          <Text>대상ID: {state.messageTemplateContentSaved.templateId}</Text>
          <Text>
            議곗튂:{' '}
            {state.messageTemplateContentSaved.mode === 'auto'
              ? '?먮룞 발송 蹂몃Ц ?묒꽦'
              : '?섎룞 발송 蹂몃Ц ?묒꽦'}
          </Text>
          <AuditLogLink
            targetType="Message"
            targetId={state.messageTemplateContentSaved.templateId}
          />
        </Space>
      )
    });

    navigate(
      {
        pathname: location.pathname,
        search: location.search
      },
      {
        replace: true,
        state: null
      }
    );
  }, [location.pathname, location.search, location.state, meta.title, navigate, notificationApi]);

  const openCreateModal = useCallback(() => {
    templateForm.setFieldsValue(createTemplateMetaDefaults(channel, activeMode, groups));
    setEditorState({ kind: 'create' });
  }, [activeMode, channel, groups, templateForm]);

  const openTemplateDetail = useCallback(
    (template: MessageTemplate) => {
      const nextSearchParams = new URLSearchParams(searchParams);

      nextSearchParams.set('tab', template.mode);

      navigate({
        pathname: `/messages/${channel}/create/${template.id}`,
        search: `?${nextSearchParams.toString()}`
      });
    },
    [channel, navigate, searchParams]
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
        triggerLabel: template.triggerLabel
      });
      setEditorState({ kind: 'edit', template });
    },
    [templateForm]
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
    const saved =
      editorState.kind === 'create'
        ? saveTemplate({
          channel,
          mode: activeMode,
          ...values,
          bodyHtml: '',
          bodyJson: createEmptyMessageBodyJson()
        })
        : saveTemplate({
          ...editorState.template,
          ...values
        });

    notificationApi.success({
      message:
        editorState.kind === 'create'
          ? `${meta.title} ?쒗뵆由??깅줉 완료`
          : `${meta.title} ?쒗뵆由??뺣낫 ?섏젙 완료`,
      description: (
        <Space direction="vertical">
          <Text>대상?좏삎: {getTargetTypeLabel('Message')}</Text>
          <Text>대상ID: {saved.id}</Text>
          <Text>
            議곗튂:{' '}
            {editorState.kind === 'create'
              ? activeMode === 'auto'
                ? '?먮룞 발송 ?쒗뵆由??깅줉'
                : '?섎룞 발송 ?쒗뵆由??깅줉'
              : activeMode === 'auto'
                ? '?먮룞 발송 ?쒗뵆由??뺣낫 ?섏젙'
                : '?섎룞 발송 ?쒗뵆由??뺣낫 ?섏젙'}
          </Text>
          {editorState.kind === 'create' ? (
            <Text>?ㅼ쓬 ?④퀎: ?앹꽦???됱쓣 ?대┃???깅줉 상세?먯꽌 蹂몃Ц???묒꽦?섏꽭??</Text>
          ) : null}
          <AuditLogLink targetType="Message" targetId={saved.id} />
        </Space>
      )
    });
    closeEditor();
  }, [
    activeMode,
    channel,
    closeEditor,
    editorState,
    meta.title,
    notificationApi,
    saveTemplate,
    templateForm
  ]);

  const handleDangerConfirm = useCallback(
    async (reason: string) => {
      if (!dangerState) {
        return;
      }

      if (dangerState.type === 'delete') {
        const removed = deleteTemplate(dangerState.template.id);
        if (!removed) {
          return;
        }

        notificationApi.success({
          message: `${meta.title} ?쒗뵆由???젣 완료`,
          description: (
            <Space direction="vertical">
              <Text>대상?좏삎: {getTargetTypeLabel('Message')}</Text>
              <Text>대상ID: {removed.id}</Text>
              <Text>사유/洹쇨굅: {reason}</Text>
              <AuditLogLink targetType="Message" targetId={removed.id} />
            </Space>
          )
        });
      }

      if (dangerState.type === 'toggle') {
        const updated = toggleTemplate({
          templateId: dangerState.template.id,
          nextStatus: dangerState.nextStatus
        });
        if (!updated) {
          return;
        }

        notificationApi.success({
          message: `${meta.title} ?먮룞 발송 ${updated.status === '활성' ? '활성?? : '鍮꾪솢?깊솕'} 완료`,
          description: (
            <Space direction="vertical">
              <Text>대상?좏삎: {getTargetTypeLabel('Message')}</Text>
              <Text>대상ID: {updated.id}</Text>
              <Text>사유/洹쇨굅: {reason}</Text>
              <AuditLogLink targetType="Message" targetId={updated.id} />
            </Space>
          )
        });
      }

      setDangerState(null);
    },
    [dangerState, deleteTemplate, meta.title, notificationApi, toggleTemplate]
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
    if (template.status !== '활성' && template.status !== '비활성) {
      return;
    }

    setDangerState({
      type: 'toggle',
      template,
      nextStatus: template.status === '활성' ? '비활성 : '활성'
    });
  }, []);

  const handleTestSend = useCallback(async () => {
    if (!testTemplate) {
      return;
    }

    const values = await testForm.validateFields();

    notificationApi.success({
      message: `${meta.title} ?섏뿉寃?蹂대궡湲?완료`,
      description: (
        <Space direction="vertical">
          <Text>대상?좏삎: {getTargetTypeLabel('Message')}</Text>
          <Text>대상ID: {testTemplate.id}</Text>
          <Text>?뚯뒪???섏떊?? {values.recipient}</Text>
          <Text>사유/洹쇨굅: {values.reason}</Text>
          <AuditLogLink targetType="Message" targetId={testTemplate.id} />
        </Space>
      )
    });
    setTestTemplate(null);
  }, [meta.title, notificationApi, testForm, testTemplate]);

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
    const result = sendTemplate({
      templateId: liveTemplate.id,
      channel,
      groupIds: values.targetGroupIds,
      actor: 'admin_current',
      actionType: values.actionType,
      scheduledAt:
        values.actionType === '예약 발송'
          ? values.scheduledAt?.format(DATE_TIME_FORMAT)
          : undefined
    });

    if (!result) {
      return;
    }

    notificationApi.success({
      message:
        values.actionType === '예약 발송'
          ? `${meta.title} 예약 발송 ?깅줉 완료`
          : `${meta.title} 발송 완료`,
      description: (
        <Space direction="vertical">
          <Text>대상?좏삎: {getTargetTypeLabel('Message')}</Text>
          <Text>대상ID: {result.id}</Text>
          <Text>사유/洹쇨굅: {values.reason}</Text>
          <AuditLogLink targetType="Message" targetId={result.id} />
        </Space>
      )
    });
    setLiveTemplate(null);
  }, [channel, liveSendForm, liveTemplate, meta.title, notificationApi, sendTemplate]);

  const buildActionItems = useCallback(
    (template: MessageTemplate) => {
      const commonItems = [
        {
          key: `edit-meta-${template.id}`,
          label: '?쒗뵆由??뺣낫 ?섏젙',
          onClick: () => openEditModal(template)
        },
        {
          key: `test-${template.id}`,
          label: '?섏뿉寃?蹂대궡湲?,
          onClick: () => openTestSendModal(template)
        }
      ];

      if (activeMode === 'auto') {
        return [
          ...commonItems,
          {
            key: `send-${template.id}`,
            label: '즉시 ?ㅽ뻾',
            onClick: () => openLiveSendModal(template)
          },
          {
            key: `delete-${template.id}`,
            label: '?쒗뵆由???젣',
            danger: true,
            onClick: () => setDangerState({ type: 'delete', template })
          }
        ];
      }

      return [
        ...commonItems,
        {
          key: `send-${template.id}`,
          label: '즉시/예약 발송',
          onClick: () => openLiveSendModal(template)
        },
        {
          key: `delete-${template.id}`,
          label: '?쒗뵆由???젣',
          danger: true,
          onClick: () => setDangerState({ type: 'delete', template })
        }
      ];
    },
    [activeMode, openEditModal, openLiveSendModal, openTestSendModal]
  );

  const columns = useMemo<TableColumnsType<MessageTemplate>>(
    () => {
      const baseColumns: TableColumnsType<MessageTemplate> = [
        {
          title: '?쒗뵆由?ID',
          dataIndex: 'id',
          width: 150,
          sorter: createTextSorter((record) => record.id)
        },
        {
          title: '移댄뀒怨좊━',
          dataIndex: 'category',
          width: 120,
          ...createDefinedColumnFilterProps(meta.categories, (record) => record.category),
          sorter: createTextSorter((record) => record.category)
        },
        {
          title: '?쒗뵆由용챸',
          dataIndex: 'name',
          width: 220,
          sorter: createTextSorter((record) => record.name)
        },
        {
          title: meta.subjectLabel,
          dataIndex: 'subject',
          width: 260,
          sorter: createTextSorter((record) => record.subject)
        },
        {
          title: '발송 洹몃９',
          dataIndex: 'targetGroupIds',
          width: 220,
          sorter: createTextSorter((record) => renderGroupNames(groups, record.targetGroupIds)),
          render: (targetGroupIds: string[]) => renderGroupNames(groups, targetGroupIds)
        }
      ];

      if (activeMode === 'auto') {
        baseColumns.push(
          {
            title: '?먮룞 議곌굔',
            dataIndex: 'triggerLabel',
            width: 180,
            sorter: createTextSorter((record) => record.triggerLabel ?? ''),
            render: (value?: string) => value ?? '-'
          },
          {
            title: '理쒓렐 발송',
            dataIndex: 'lastSentAt',
            width: 160,
            sorter: createTextSorter((record) => record.lastSentAt ?? ''),
            render: (value?: string) => value ?? '-'
          }
        );
      } else {
        baseColumns.push({
          title: '최근 수정',
          dataIndex: 'updatedAt',
          width: 160,
          sorter: createTextSorter((record) => record.updatedAt)
        });
      }

      baseColumns.push(
        {
          title: createStatusColumnTitle('상태', ['활성', '비활성, '珥덉븞']),
          dataIndex: 'status',
          width: activeMode === 'auto' ? 120 : 100,
          ...createDefinedColumnFilterProps(
            messageTemplateStatusFilterValues,
            (record) => record.status
          ),
          sorter: createTextSorter((record) => record.status),
          render: (status: MessageTemplateStatus, record) =>
            activeMode === 'auto' && (status === '활성' || status === '비활성) ? (
              <BinaryStatusSwitch
                checked={status === '활성'}
                checkedLabel="활성"
                uncheckedLabel="비활성
                onToggle={() => openStatusToggleConfirm(record)}
              />
            ) : (
              <StatusBadge status={status} />
            )
        },
        {
          title: '?≪뀡',
          key: 'actions',
          width: 150,
          onCell: () => ({
            onClick: (event) => {
              event.stopPropagation();
            }
          }),
          render: (_, record) => <TableActionMenu items={buildActionItems(record)} />
        }
      );

      return baseColumns;
    },
    [activeMode, buildActionItems, groups, meta.categories, meta.subjectLabel, openStatusToggleConfirm]
  );

  const tabItems = useMemo(
    () => [
      {
        key: 'auto',
        label: `?먮룞 발송 (${templates.filter((template) => template.mode === 'auto').length})`
      },
      {
        key: 'manual',
        label: `?섎룞 발송 (${templates.filter((template) => template.mode === 'manual').length})`
      }
    ],
    [templates]
  );

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
    ? [
      {
        key: 'templateId',
        label: '?쒗뵆由?ID',
        children: previewTemplate.id
      },
      {
        key: 'templateName',
        label: '?쒗뵆由용챸',
        children: previewTemplate.name
      },
      {
        key: 'targetGroups',
        label: '발송 洹몃９',
        children: renderGroupNames(groups, previewTemplate.targetGroupIds)
      }
    ]
    : [];
  const previewFooterActions = previewTemplate
    ? [
        <Button key="edit" type="primary" onClick={() => openTemplateDetail(previewTemplate)}>
          ?쒗뵆由??섏젙
        </Button>
      ]
    : [];

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title={meta.title} />

      {loadState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message={`${meta.title} ?곗씠??議고쉶??실패?덉뒿?덈떎.`}
          description={
            <Space direction="vertical" size={4}>
              <Text>{loadState.errorMessage ?? '?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'}</Text>
              <Text type="secondary">?ㅻ쪟 肄붾뱶: {loadState.errorCode ?? '-'}</Text>
              <Space>
                <Button onClick={handleRetryLoad}>?ъ떆??/Button>
                <Text type="secondary">留덉?留?성공 상태瑜?湲곗??쇰줈 ?붾㈃??蹂듦뎄?????덉뒿?덈떎.</Text>
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
                { label: '?쒗뵆由?ID', value: 'id' },
                { label: '?쒗뵆由용챸', value: 'name' },
                { label: '제목', value: 'subject' },
                { label: '?붿빟', value: 'summary' }
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
              keywordPlaceholder="寃??.."
              detailTitle="상세 寃??
              detailContent={
                <SearchBarDetailField
                  label={activeMode === 'auto' ? '理쒓렐 발송?? : '최근 수정??}
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
                <Text type="secondary">珥?{visibleTemplates.length.toLocaleString()}嫄?/Text>
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
                    ? '?먮룞 발송 ?쒗뵆由??깅줉'
                    : '?섎룞 발송 ?쒗뵆由??깅줉'}
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
            style={{ marginBottom: 12 }}
            message="?좏깮 媛?ν븳 발송 洹몃９???놁뒿?덈떎."
            description="대상洹몃９??癒쇱? ?앹꽦?????쒗뵆由??깅줉??吏꾪뻾?섏꽭??"
          />
        ) : null}
        {loadState.status !== 'pending' && visibleTemplates.length === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={`${meta.title} ${activeMode === 'auto' ? '?먮룞 발송' : '?섎룞 발송'} ?쒗뵆由우씠 ?놁뒿?덈떎.`}
            description="?꾪꽣 議곌굔??議곗젙?섍굅?????쒗뵆由우쓣 ?깅줉?섏꽭??"
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

      <Modal
        open={Boolean(editorState)}
        title={
          editorState?.kind === 'create'
            ? editorMode === 'auto'
              ? '?먮룞 발송 ?쒗뵆由??깅줉'
              : '?섎룞 발송 ?쒗뵆由??깅줉'
            : editorMode === 'auto'
              ? '?먮룞 발송 ?쒗뵆由??뺣낫 ?섏젙'
              : '?섎룞 발송 ?쒗뵆由??뺣낫 ?섏젙'
        }
        okText={editorState?.kind === 'create' ? '?깅줉' : '대상}
        cancelText="취소"
        width={840}
        onCancel={closeEditor}
        onOk={handleSaveTemplate}
      destroyOnHidden
      >
        <Form form={templateForm}>
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

      <HtmlPreviewModal
        open={Boolean(previewTemplate)}
        title={`${meta.title} ?쒗뵆由?誘몃━蹂닿린`}
        descriptionItems={previewDescriptionItems}
        bodyHtml={previewTemplate?.bodyHtml}
        footerActions={previewFooterActions}
        width={920}
        onClose={closePreview}
        emptyDescription="?됱쓣 ?대┃???깅줉 상세?먯꽌 蹂몃Ц??癒쇱? ??ν븯?몄슂."
      />

      <Modal
        open={Boolean(testTemplate)}
        title={`${meta.title} ?섏뿉寃?蹂대궡湲?}
        okText="발송"
        cancelText="취소"
        onCancel={closeTestModal}
        onOk={handleTestSend}
        destroyOnHidden
      >
        <Form form={testForm}>
          <Descriptions
            bordered
            size="small"
            column={1}
            className="message-template-form-descriptions"
            items={markRequiredDescriptionItems(
              [
                {
                  key: 'recipient',
                  label: meta.recipientLabel,
                  children: (
                    <Form.Item
                      name="recipient"
                      rules={[{ required: true, message: `${meta.recipientLabel}???낅젰?섏꽭??` }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input placeholder={meta.recipientPlaceholder} />
                    </Form.Item>
                  )
                },
                {
                  key: 'reason',
                  label: '사유/洹쇨굅',
                  children: (
                    <Form.Item
                      name="reason"
                      rules={[{ required: true, message: '?뚯뒪??발송 사유를 입력하세요.' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input.TextArea rows={4} placeholder="?? ?쒗뵆由??뚮뜑留곴낵 留곹겕 ?뺤씤" />
                    </Form.Item>
                  )
                }
              ],
              ['recipient', 'reason']
            )}
          />
        </Form>
      </Modal>

      <Modal
        open={Boolean(liveTemplate)}
        title={`${meta.title} ${activeMode === 'auto' ? '즉시 ?ㅽ뻾' : '발송 ?ㅽ뻾'}`}
        okText={liveActionType === '예약 발송' ? '예약 ?깅줉' : '발송 ?ㅽ뻾'}
        cancelText="취소"
        onCancel={closeLiveModal}
        onOk={handleLiveSend}
        destroyOnHidden
      >
        <Form form={liveSendForm}>
          <Descriptions
            bordered
            size="small"
            column={1}
            className="message-template-form-descriptions"
            items={markRequiredDescriptionItems(
              [
                {
                  key: 'targetGroupIds',
                  label: '발송 洹몃９',
                  children: (
                    <Form.Item
                      name="targetGroupIds"
                      rules={[{ required: true, message: '발송 洹몃９???좏깮?섏꽭??' }]}
                      style={{ marginBottom: 0 }}
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
                },
                {
                  key: 'actionType',
                  label: '발송 諛⑹떇',
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
                              format={DATE_TIME_FORMAT}
                              placeholder="예약 시각 ?좏깮"
                              style={{ width: '100%' }}
                            />
                          </Form.Item>
                        )
                      }
                    ]
                  : []),
                {
                  key: 'reason',
                  label: '사유/洹쇨굅',
                  children: (
                    <Form.Item
                      name="reason"
                      rules={[{ required: true, message: '발송 사유를 입력하세요.' }]}
                      style={{ marginBottom: 0 }}
                    >
                      <Input.TextArea
                        rows={4}
                        placeholder="?? ?붽컙 罹좏럹??발송, 결제 실패 대상
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

      {dangerState ? (
        <ConfirmAction
          open
          title={
            dangerState.type === 'delete'
              ? `${meta.title} ?쒗뵆由???젣`
              : `${meta.title} ?먮룞 발송 ${dangerState.nextStatus === '활성' ? '활성?? : '鍮꾪솢?깊솕'}`
          }
          description={
            dangerState.type === 'delete'
              ? '?쒗뵆由우쓣 ??젣?섎㈃ 媛숈? 援ъ꽦?쇰줈 즉시 발송?????놁뒿?덈떎. ??젣 사유를 기록하세요.'
              : '?먮룞 발송 상태瑜?蹂寃쏀븯硫??덉젙??운영 ?먮쫫??諛붾앸땲?? 蹂寃?사유를 기록하세요.'
          }
          targetType="Message"
          targetId={dangerState.template.id}
          confirmText={
            dangerState.type === 'delete'
              ? '삭제 실행'
              : dangerState.nextStatus === '활성'
                ? '활성???ㅽ뻾'
                : '鍮꾪솢?깊솕 ?ㅽ뻾'
          }
          onCancel={closeDanger}
          onConfirm={handleDangerConfirm}
        />
      ) : null}
    </div>
  );
}


