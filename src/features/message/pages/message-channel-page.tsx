import {
  Alert,
  Button,
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchChannelSnapshotSafe } from '../api/messages-service';
import { useMessageStore } from '../model/message-store';
import type {
  MessageChannel,
  MessageGroup,
  MessageTemplate,
  MessageTemplateMode,
  MessageTemplateStatus
} from '../model/types';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { FilterBar } from '../../../shared/ui/filter-bar/filter-bar';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import {
  createColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

type MessageChannelPageProps = {
  channel: MessageChannel;
};

type TemplateStatusFilter = MessageTemplateStatus | 'all';

type TemplateFormValues = {
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

type TestSendFormValues = {
  recipient: string;
  reason: string;
};

type LiveSendFormValues = {
  targetGroupIds: string[];
  actionType: '즉시 발송' | '예약 발송';
  scheduledAt?: string;
  reason: string;
};

type TemplateEditorState =
  | { type: 'create' }
  | { type: 'edit'; template: MessageTemplate }
  | null;

type DangerState =
  | { type: 'delete'; template: MessageTemplate }
  | {
      type: 'toggle';
      template: MessageTemplate;
      nextStatus: Extract<MessageTemplateStatus, '활성' | '비활성'>;
    }
  | null;

function parseMode(value: string | null): MessageTemplateMode {
  return value === 'manual' ? 'manual' : 'auto';
}

function parseStatus(value: string | null): TemplateStatusFilter {
  if (value === '활성' || value === '비활성' || value === '초안') {
    return value;
  }
  return 'all';
}

function getChannelMeta(channel: MessageChannel) {
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

function renderGroupNames(groups: MessageGroup[], groupIds: string[]): string {
  const names = groups
    .filter((group) => groupIds.includes(group.id))
    .map((group) => group.name);
  return names.length > 0 ? names.join(', ') : '-';
}

function createTemplateDefaults(
  channel: MessageChannel,
  mode: MessageTemplateMode,
  groups: MessageGroup[]
): TemplateFormValues {
  return {
    category: getChannelMeta(channel).categories[0],
    name: '',
    summary: '',
    subject: '',
    targetGroupIds: groups.slice(0, 1).map((group) => group.id),
    status: mode === 'auto' ? '활성' : '초안',
    triggerLabel: mode === 'auto' ? '이벤트 발생 직후' : undefined,
    bodyHtml: '<p>메시지 내용을 입력하세요.</p>',
    bodyJson: JSON.stringify(
      {
        blocks: [{ type: 'paragraph', data: { text: '메시지 내용을 입력하세요.' } }]
      },
      null,
      2
    )
  };
}

export function MessageChannelPage({
  channel
}: MessageChannelPageProps): JSX.Element {
  const meta = useMemo(() => getChannelMeta(channel), [channel]);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeMode = parseMode(searchParams.get('tab'));
  const statusFilter = parseStatus(searchParams.get('status'));
  const keyword = searchParams.get('keyword') ?? '';

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
  const [templateForm] = Form.useForm<TemplateFormValues>();
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
        if (statusFilter !== 'all' && template.status !== statusFilter) {
          return false;
        }

        if (!normalizedKeyword) {
          return true;
        }

        return (
          template.id.toLowerCase().includes(normalizedKeyword) ||
          template.name.toLowerCase().includes(normalizedKeyword) ||
          template.subject.toLowerCase().includes(normalizedKeyword) ||
          template.summary.toLowerCase().includes(normalizedKeyword)
        );
      });
  }, [activeMode, keyword, statusFilter, templates]);

  const commitParams = useCallback(
    (next: Partial<Record<'tab' | 'status' | 'keyword', string>>) => {
      const merged = new URLSearchParams(searchParams);

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

  const openCreateModal = useCallback(() => {
    templateForm.setFieldsValue(createTemplateDefaults(channel, activeMode, groups));
    setEditorState({ type: 'create' });
  }, [activeMode, channel, groups, templateForm]);

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
        bodyHtml: template.bodyHtml,
        bodyJson: template.bodyJson
      });
      setEditorState({ type: 'edit', template });
    },
    [templateForm]
  );

  const closeEditor = useCallback(() => setEditorState(null), []);
  const closeDanger = useCallback(() => setDangerState(null), []);
  const closePreview = useCallback(() => setPreviewTemplate(null), []);
  const closeTestModal = useCallback(() => setTestTemplate(null), []);
  const closeLiveModal = useCallback(() => setLiveTemplate(null), []);

  const handleSaveTemplate = useCallback(async () => {
    const values = await templateForm.validateFields();
    const saved = saveTemplate({
      id: editorState?.type === 'edit' ? editorState.template.id : undefined,
      channel,
      mode: activeMode,
      ...values
    });

    notificationApi.success({
      message: `${meta.title} 템플릿 ${editorState?.type === 'edit' ? '수정' : '등록'} 완료`,
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
          <Text>대상 ID: {saved.id}</Text>
          <Text>조치: {activeMode === 'auto' ? '자동 발송 템플릿 관리' : '수동 발송 템플릿 관리'}</Text>
          <AuditLogLink targetType="Message" targetId={saved.id} />
        </Space>
      )
    });
    setEditorState(null);
  }, [activeMode, channel, editorState, meta.title, notificationApi, saveTemplate, templateForm]);

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
          message: `${meta.title} 템플릿 삭제 완료`,
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
              <Text>대상 ID: {removed.id}</Text>
              <Text>사유/근거: {reason}</Text>
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
          message: `${meta.title} 자동 발송 ${updated.status === '활성' ? '활성화' : '비활성화'} 완료`,
          description: (
            <Space direction="vertical">
              <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
              <Text>대상 ID: {updated.id}</Text>
              <Text>사유/근거: {reason}</Text>
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

  const handleTestSend = useCallback(async () => {
    if (!testTemplate) {
      return;
    }

    const values = await testForm.validateFields();

    notificationApi.success({
      message: `${meta.title} 나에게 보내기 완료`,
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
          <Text>대상 ID: {testTemplate.id}</Text>
          <Text>테스트 수신자: {values.recipient}</Text>
          <Text>사유/근거: {values.reason}</Text>
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
      scheduledAt: values.actionType === '예약 발송' ? values.scheduledAt : undefined
    });

    if (!result) {
      return;
    }

    notificationApi.success({
      message:
        values.actionType === '예약 발송'
          ? `${meta.title} 예약 발송 등록 완료`
          : `${meta.title} 발송 완료`,
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
          <Text>대상 ID: {result.id}</Text>
          <Text>사유/근거: {values.reason}</Text>
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
          key: `edit-${template.id}`,
          label: activeMode === 'auto' ? '자동 발송 수정' : '수동 발송 수정',
          onClick: () => openEditModal(template)
        },
        {
          key: `preview-${template.id}`,
          label: '미리보기',
          onClick: () => setPreviewTemplate(template)
        },
        {
          key: `test-${template.id}`,
          label: '나에게 보내기',
          onClick: () => openTestSendModal(template)
        }
      ];

      if (activeMode === 'auto') {
        return [
          ...commonItems,
          {
            key: `send-${template.id}`,
            label: '즉시 실행',
            onClick: () => openLiveSendModal(template)
          },
          {
            key: `toggle-${template.id}`,
            label: template.status === '활성' ? '자동 발송 비활성화' : '자동 발송 활성화',
            danger: template.status === '활성',
            onClick: () =>
              setDangerState({
                type: 'toggle',
                template,
                nextStatus: template.status === '활성' ? '비활성' : '활성'
              })
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
          label: '템플릿 삭제',
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
          title: '템플릿 ID',
          dataIndex: 'id',
          width: 150,
          ...createColumnFilterProps(visibleTemplates, (record) => record.id),
          sorter: createTextSorter((record) => record.id)
        },
        {
          title: '카테고리',
          dataIndex: 'category',
          width: 120,
          ...createColumnFilterProps(visibleTemplates, (record) => record.category),
          sorter: createTextSorter((record) => record.category)
        },
        {
          title: '템플릿명',
          dataIndex: 'name',
          width: 220,
          ...createColumnFilterProps(visibleTemplates, (record) => record.name),
          sorter: createTextSorter((record) => record.name)
        },
        {
          title: meta.subjectLabel,
          dataIndex: 'subject',
          width: 260,
          ...createColumnFilterProps(visibleTemplates, (record) => record.subject),
          sorter: createTextSorter((record) => record.subject)
        },
        {
          title: '발송 그룹',
          dataIndex: 'targetGroupIds',
          width: 220,
          ...createColumnFilterProps(visibleTemplates, (record) =>
            renderGroupNames(groups, record.targetGroupIds)
          ),
          sorter: createTextSorter((record) => renderGroupNames(groups, record.targetGroupIds)),
          render: (targetGroupIds: string[]) => renderGroupNames(groups, targetGroupIds)
        }
      ];

      if (activeMode === 'auto') {
        baseColumns.push(
          {
            title: '자동 조건',
            dataIndex: 'triggerLabel',
            width: 180,
            ...createColumnFilterProps(visibleTemplates, (record) => record.triggerLabel ?? ''),
            sorter: createTextSorter((record) => record.triggerLabel ?? ''),
            render: (value?: string) => value ?? '-'
          },
          {
            title: '최근 발송',
            dataIndex: 'lastSentAt',
            width: 160,
            ...createColumnFilterProps(visibleTemplates, (record) => record.lastSentAt ?? ''),
            sorter: createTextSorter((record) => record.lastSentAt ?? ''),
            render: (value?: string) => value ?? '-'
          }
        );
      } else {
        baseColumns.push({
          title: '최근 수정',
          dataIndex: 'updatedAt',
          width: 160,
          ...createColumnFilterProps(visibleTemplates, (record) => record.updatedAt),
          sorter: createTextSorter((record) => record.updatedAt)
        });
      }

      baseColumns.push(
        {
          title: '상태',
          dataIndex: 'status',
          width: 100,
          ...createColumnFilterProps(visibleTemplates, (record) => record.status),
          sorter: createTextSorter((record) => record.status),
          render: (status: MessageTemplateStatus) => <StatusBadge status={status} />
        },
        {
          title: '액션',
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
    [activeMode, buildActionItems, groups, meta.subjectLabel, visibleTemplates]
  );

  const tabItems = useMemo(
    () => [
      {
        key: 'auto',
        label: `자동 발송 (${templates.filter((template) => template.mode === 'auto').length})`
      },
      {
        key: 'manual',
        label: `수동 발송 (${templates.filter((template) => template.mode === 'manual').length})`
      }
    ],
    [templates]
  );

  const handleRetryLoad = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleRowClick = useCallback(
    (record: MessageTemplate) => ({
      onClick: () => setPreviewTemplate(record),
      style: { cursor: 'pointer' }
    }),
    []
  );

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title={meta.title} />

      {loadState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
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

      <Tabs
        activeKey={activeMode}
        items={tabItems}
        onChange={(nextTab) => commitParams({ tab: nextTab, status: statusFilter, keyword })}
        style={{ marginBottom: 12 }}
      />

      <AdminListCard
        extra={
          <Button type="primary" onClick={openCreateModal}>
            {activeMode === 'auto' ? '자동 발송 등록' : '수동 발송 등록'}
          </Button>
        }
        toolbar={
          <FilterBar>
            <Input
              allowClear
              value={keyword}
              onChange={(event) =>
                commitParams({ keyword: event.target.value, status: statusFilter, tab: activeMode })
              }
              placeholder={`${meta.title} 템플릿명 / 제목 / 템플릿 ID`}
              style={{ width: 280 }}
            />
            <Select
              value={statusFilter}
              style={{ width: 140 }}
              options={[
                { label: '전체 상태', value: 'all' },
                { label: '활성', value: '활성' },
                { label: '비활성', value: '비활성' },
                { label: '초안', value: '초안' }
              ]}
              onChange={(value: TemplateStatusFilter) =>
                commitParams({ status: value, keyword, tab: activeMode })
              }
            />
            <Button
              onClick={() =>
                setSearchParams(
                  new URLSearchParams({ tab: activeMode }),
                  { replace: true }
                )
              }
            >
              필터 초기화
            </Button>
            <Text type="secondary">총 {visibleTemplates.length.toLocaleString()}건</Text>
          </FilterBar>
        }
      >
        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          {activeMode === 'auto'
            ? '이벤트 기반 자동 발송은 활성화/비활성화와 트리거 조건을 함께 관리합니다.'
            : '수동 발송은 템플릿 저장 후 즉시 발송, 예약 발송, 테스트 발송을 실행할 수 있습니다.'}
        </Paragraph>
        {loadState.status !== 'pending' && visibleTemplates.length === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
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

      <Modal
        open={Boolean(editorState)}
        title={
          editorState?.type === 'edit'
            ? `${meta.title} 템플릿 수정`
            : `${meta.title} 템플릿 등록`
        }
        okText="저장"
        cancelText="취소"
        width={920}
        onCancel={closeEditor}
        onOk={handleSaveTemplate}
        destroyOnClose
      >
        <Form form={templateForm} layout="vertical">
          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item
              label="카테고리"
              name="category"
              rules={[{ required: true, message: '카테고리를 선택하세요.' }]}
              style={{ flex: 1 }}
            >
              <Select options={meta.categories.map((category) => ({ label: category, value: category }))} />
            </Form.Item>
            <Form.Item
              label="상태"
              name="status"
              rules={[{ required: true, message: '상태를 선택하세요.' }]}
              style={{ width: 180 }}
            >
              <Select
                options={[
                  { label: '활성', value: '활성' },
                  { label: '비활성', value: '비활성' },
                  { label: '초안', value: '초안' }
                ]}
              />
            </Form.Item>
          </Space>

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

          {activeMode === 'auto' ? (
            <Form.Item
              label="자동 조건"
              name="triggerLabel"
              rules={[{ required: true, message: '자동 조건을 입력하세요.' }]}
            >
              <Input placeholder="예: 회원 가입 직후, 결제 실패 후 1시간" />
            </Form.Item>
          ) : null}

          <Form.Item
            label="HTML 본문"
            name="bodyHtml"
            rules={[{ required: true, message: 'HTML 본문을 입력하세요.' }]}
          >
            <Input.TextArea rows={8} placeholder="<p>HTML 템플릿 내용을 입력하세요.</p>" />
          </Form.Item>

          <Form.Item
            label="JSON 본문"
            name="bodyJson"
            rules={[{ required: true, message: 'JSON 본문을 입력하세요.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea rows={8} placeholder='{"blocks":[]}' />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(previewTemplate)}
        title={`${meta.title} 템플릿 미리보기`}
        footer={[
          <Button key="close" onClick={closePreview}>
            닫기
          </Button>
        ]}
        width={920}
        onCancel={closePreview}
        destroyOnClose
      >
        {previewTemplate ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div>
              <Text strong>템플릿 ID</Text>
              <div>{previewTemplate.id}</div>
            </div>
            <div>
              <Text strong>{meta.subjectLabel}</Text>
              <div>{previewTemplate.subject}</div>
            </div>
            <div>
              <Text strong>발송 그룹</Text>
              <div>{renderGroupNames(groups, previewTemplate.targetGroupIds)}</div>
            </div>
            <div>
              <Text strong>HTML 미리보기</Text>
              <div
                style={{
                  marginTop: 8,
                  border: '1px solid #e5eaf3',
                  borderRadius: 10,
                  padding: 16,
                  background: '#fbfcfe'
                }}
                dangerouslySetInnerHTML={{ __html: previewTemplate.bodyHtml }}
              />
            </div>
            <div>
              <Text strong>JSON 원본</Text>
              <pre
                style={{
                  marginTop: 8,
                  padding: 16,
                  background: '#0f172a',
                  color: '#e2e8f0',
                  borderRadius: 10,
                  overflowX: 'auto'
                }}
              >
                {previewTemplate.bodyJson}
              </pre>
            </div>
          </Space>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(testTemplate)}
        title={`${meta.title} 나에게 보내기`}
        okText="발송"
        cancelText="취소"
        onCancel={closeTestModal}
        onOk={handleTestSend}
        destroyOnClose
      >
        <Form form={testForm} layout="vertical">
          <Form.Item
            label={meta.recipientLabel}
            name="recipient"
            rules={[{ required: true, message: `${meta.recipientLabel}을 입력하세요.` }]}
          >
            <Input placeholder={meta.recipientPlaceholder} />
          </Form.Item>
          <Form.Item
            label="사유/근거"
            name="reason"
            rules={[{ required: true, message: '테스트 발송 사유를 입력하세요.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea rows={4} placeholder="예: 템플릿 렌더링과 링크 확인" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={Boolean(liveTemplate)}
        title={`${meta.title} ${activeMode === 'auto' ? '즉시 실행' : '발송 실행'}`}
        okText={liveActionType === '예약 발송' ? '예약 등록' : '발송 실행'}
        cancelText="취소"
        onCancel={closeLiveModal}
        onOk={handleLiveSend}
        destroyOnClose
      >
        <Form form={liveSendForm} layout="vertical">
          <Form.Item
            label="발송 그룹"
            name="targetGroupIds"
            rules={[{ required: true, message: '발송 그룹을 선택하세요.' }]}
          >
            <Select
              mode="multiple"
              options={groups.map((group) => ({
                label: `${group.name} (${group.memberCount.toLocaleString()}명)`,
                value: group.id
              }))}
            />
          </Form.Item>
          <Form.Item
            label="발송 방식"
            name="actionType"
            rules={[{ required: true, message: '발송 방식을 선택하세요.' }]}
          >
            <Select
              options={[
                { label: '즉시 발송', value: '즉시 발송' },
                { label: '예약 발송', value: '예약 발송' }
              ]}
            />
          </Form.Item>
          {liveActionType === '예약 발송' ? (
            <Form.Item
              label="예약 시각"
              name="scheduledAt"
              rules={[{ required: true, message: '예약 시각을 입력하세요.' }]}
            >
              <Input placeholder="예: 2026-03-12 09:00" />
            </Form.Item>
          ) : null}
          <Form.Item
            label="사유/근거"
            name="reason"
            rules={[{ required: true, message: '발송 사유를 입력하세요.' }]}
            style={{ marginBottom: 0 }}
          >
            <Input.TextArea rows={4} placeholder="예: 월간 캠페인 발송, 결제 실패 대응" />
          </Form.Item>
        </Form>
      </Modal>

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
