import {
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  Radio,
  Select,
  Slider,
  Space,
  Tooltip,
  Typography,
  notification
} from 'antd';
import type { CheckboxGroupProps, TableColumnsType } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { fetchGroupsSafe } from '../api/messages-service';
import { useMessageStore } from '../model/message-store';
import type {
  MessageChannel,
  MessageGroup,
  MessageGroupBuilderMode,
  MessageGroupCountry,
  MessageGroupDefinitionType,
  MessageGroupGender,
  MessageGroupMemberType,
  MessageGroupSignupMethod,
  MessageGroupStatus,
  MessageGroupSubscriptionState
} from '../model/types';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
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
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text, Title } = Typography;
const { RangePicker } = DatePicker;

type GroupEditorState =
  | { type: 'create' }
  | { type: 'edit'; group: MessageGroup }
  | null;

type GroupFormValues = {
  name: string;
  description: string;
  definitionType: MessageGroupDefinitionType;
  builderMode: MessageGroupBuilderMode;
  channels: MessageChannel[];
  status: MessageGroupStatus;
  country: MessageGroupCountry;
  memberTypes: MessageGroupMemberType[];
  genders: MessageGroupGender[];
  ageRange: [number, number];
  signupMethods: MessageGroupSignupMethod[];
  signupDateRange?: [Dayjs | null, Dayjs | null];
  subscriptionStates: MessageGroupSubscriptionState[];
  activityStates: ('활동' | '비활동')[];
  staticMembersText: string;
  queryBuilderText: string;
};

type GroupSavePayload = {
  id?: string;
  name: string;
  description: string;
  definitionType: MessageGroupDefinitionType;
  builderMode: MessageGroupBuilderMode;
  channels: MessageChannel[];
  status: MessageGroupStatus;
  staticMembers: string[];
  filters: MessageGroup['filters'];
  queryBuilderText?: string;
};

const channelOptions: CheckboxGroupProps<MessageChannel>['options'] = [
  { label: '메일', value: 'mail' },
  { label: '푸시', value: 'push' }
];

const memberTypeOptions: CheckboxGroupProps<MessageGroupMemberType>['options'] = [
  { label: '학생', value: '학생' },
  { label: '강사', value: '강사' },
  { label: '파트너', value: '파트너' }
];

const genderOptions: CheckboxGroupProps<MessageGroupGender>['options'] = [
  { label: '남성', value: '남성' },
  { label: '여성', value: '여성' }
];

const signupMethodOptions: CheckboxGroupProps<MessageGroupSignupMethod>['options'] = [
  { label: '이메일', value: '이메일' },
  { label: '구글', value: '구글' },
  { label: '페이스북', value: '페이스북' },
  { label: '카카오', value: '카카오' }
];

const subscriptionOptions: CheckboxGroupProps<MessageGroupSubscriptionState>['options'] = [
  { label: '구독', value: '구독' },
  { label: '구독해지', value: '구독해지' }
];

const messageGroupDefinitionTypeFilterValues = ['정적 그룹', '조건 기반 그룹'] as const;
const messageGroupStatusFilterValues = ['사용중', '초안'] as const;

const activityOptions: CheckboxGroupProps<'활동' | '비활동'>['options'] = [
  { label: '활동', value: '활동' },
  { label: '비활동', value: '비활동' }
];

function buildDefaultFormValues(): GroupFormValues {
  return {
    name: '',
    description: '',
    definitionType: '조건 기반 그룹',
    builderMode: 'simple',
    channels: ['mail', 'push'],
    status: '사용중',
    country: '한국 (KR)',
    memberTypes: ['학생'],
    genders: ['남성', '여성'],
    ageRange: [18, 30],
    signupMethods: ['이메일', '구글'],
    signupDateRange: [dayjs('2025-03-10'), dayjs('2026-03-10')],
    subscriptionStates: ['구독'],
    activityStates: ['활동'],
    staticMembersText: '',
    queryBuilderText: ''
  };
}

function toFormValues(group: MessageGroup): GroupFormValues {
  return {
    name: group.name,
    description: group.description,
    definitionType: group.definitionType,
    builderMode: group.builderMode,
    channels: group.channels,
    status: group.status,
    country: group.filters.country,
    memberTypes: group.filters.memberTypes,
    genders: group.filters.genders,
    ageRange: group.filters.ageRange,
    signupMethods: group.filters.signupMethods,
    signupDateRange: group.filters.signupDateRange?.start && group.filters.signupDateRange?.end
      ? [dayjs(group.filters.signupDateRange.start), dayjs(group.filters.signupDateRange.end)]
      : undefined,
    subscriptionStates: group.filters.subscriptionStates,
    activityStates: group.filters.activityStates,
    staticMembersText: group.staticMembers.join('\n'),
    queryBuilderText: group.queryBuilderText ?? ''
  };
}

function buildPayload(
  values: GroupFormValues,
  editorState: GroupEditorState
): GroupSavePayload {
  return {
    id: editorState?.type === 'edit' ? editorState.group.id : undefined,
    name: values.name.trim(),
    description: values.description.trim(),
    definitionType: values.definitionType,
    builderMode: values.definitionType === '정적 그룹' ? 'simple' : values.builderMode,
    channels: values.channels,
    status: values.status,
    staticMembers:
      values.definitionType === '정적 그룹'
        ? values.staticMembersText
            .split(/\r?\n/)
            .map((member) => member.trim())
            .filter(Boolean)
        : [],
    filters: {
      country: values.country,
      memberTypes: values.memberTypes,
      genders: values.genders,
      ageRange: values.ageRange,
      signupMethods: values.signupMethods,
      signupDateRange:
        values.signupDateRange && values.signupDateRange[0] && values.signupDateRange[1]
          ? {
              start: values.signupDateRange[0].format('YYYY-MM-DD'),
              end: values.signupDateRange[1].format('YYYY-MM-DD')
            }
          : undefined,
      subscriptionStates: values.subscriptionStates,
      activityStates: values.activityStates
    },
    queryBuilderText:
      values.definitionType === '정적 그룹' ? undefined : values.queryBuilderText.trim() || undefined
  };
}

export default function MessageGroupsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
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

  const groups = useMessageStore((state) => state.groups);
  const previewGroupCount = useMessageStore((state) => state.previewGroupCount);
  const saveGroup = useMessageStore((state) => state.saveGroup);
  const recalculateGroup = useMessageStore((state) => state.recalculateGroup);
  const deleteGroup = useMessageStore((state) => state.deleteGroup);

  const [loadState, setLoadState] = useState<AsyncState<null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [editorState, setEditorState] = useState<GroupEditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<MessageGroup | null>(null);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [form] = Form.useForm<GroupFormValues>();

  const definitionType = Form.useWatch('definitionType', form);
  const builderMode = Form.useWatch('builderMode', form);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({
      status: 'pending',
      data: null,
      errorMessage: null,
      errorCode: null
    });

    void fetchGroupsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setLoadState({
          status: result.data.length === 0 ? 'empty' : 'success',
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
  }, [reloadKey]);

  const visibleGroups = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return groups.filter((group) => {
      if (!matchesSearchDateRange(group.lastCalculatedAt, startDate, endDate)) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        name: group.name,
        description: group.description,
        ruleSummary: group.ruleSummary
      });
    });
  }, [endDate, groups, keyword, searchField, startDate]);

  const commitParams = useCallback(
    (
      next: Partial<
        Record<'keyword' | 'searchField' | 'startDate' | 'endDate', string>
      >
    ) => {
      const merged = new URLSearchParams(searchParams);
      merged.delete('definition');

      Object.entries(next).forEach(([key, value]) => {
        if (!value || value === 'all') {
          merged.delete(key);
          return;
        }
        merged.set(key, value);
      });

      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleApplyDateRange = useCallback(() => {
    commitParams({
      startDate: draftStartDate,
      endDate: draftEndDate,
      keyword,
      searchField
    });
  }, [commitParams, draftEndDate, draftStartDate, keyword, searchField]);

  const openCreateDrawer = useCallback(() => {
    form.setFieldsValue(buildDefaultFormValues());
    setPreviewCount(null);
    setEditorState({ type: 'create' });
  }, [form]);

  const openEditDrawer = useCallback(
    (group: MessageGroup) => {
      form.setFieldsValue(toFormValues(group));
      setPreviewCount(group.memberCount);
      setEditorState({ type: 'edit', group });
    },
    [form]
  );

  const closeDrawer = useCallback(() => {
    setEditorState(null);
    setPreviewCount(null);
  }, []);

  const handlePreviewCount = useCallback(async () => {
    const values = await form.validateFields([
      'definitionType',
      'builderMode',
      'channels',
      'country',
      'memberTypes',
      'genders',
      'ageRange',
      'signupMethods',
      'signupDateRange',
      'subscriptionStates',
      'activityStates',
      'staticMembersText'
    ]);
    const count = previewGroupCount(buildPayload(values, editorState));
    setPreviewCount(count);
  }, [editorState, form, previewGroupCount]);

  const handleSaveGroup = useCallback(async () => {
    const values = await form.validateFields();
    const saved = saveGroup(buildPayload(values, editorState));

    notificationApi.success({
      message: `대상 그룹 ${editorState?.type === 'edit' ? '수정' : '생성'} 완료`,
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
          <Text>대상 ID: {saved.id}</Text>
          <Text>예상 대상 수: {saved.memberCount.toLocaleString()}명</Text>
          <AuditLogLink targetType="Message" targetId={saved.id} />
        </Space>
      )
    });
    closeDrawer();
  }, [closeDrawer, editorState, form, notificationApi, saveGroup]);

  const handleRecalculate = useCallback(
    (group: MessageGroup) => {
      const refreshed = recalculateGroup(group.id);
      if (!refreshed) {
        return;
      }

      notificationApi.success({
        message: '대상 그룹 예상 수 재계산 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
            <Text>대상 ID: {refreshed.id}</Text>
            <Text>예상 대상 수: {refreshed.memberCount.toLocaleString()}명</Text>
            <AuditLogLink targetType="Message" targetId={refreshed.id} />
          </Space>
        )
      });
    },
    [notificationApi, recalculateGroup]
  );

  const handleDeleteGroup = useCallback(
    async (reason: string) => {
      if (!deleteTarget) {
        return;
      }

      const deleted = deleteGroup(deleteTarget.id);
      if (!deleted) {
        return;
      }

      notificationApi.success({
        message: '대상 그룹 삭제 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Message')}</Text>
            <Text>대상 ID: {deleted.id}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="Message" targetId={deleted.id} />
          </Space>
        )
      });
      setDeleteTarget(null);
    },
    [deleteGroup, deleteTarget, notificationApi]
  );

  const columns = useMemo<TableColumnsType<MessageGroup>>(
    () => [
      {
        title: '그룹 이름',
        dataIndex: 'name',
        width: 180,
        sorter: createTextSorter((record) => record.name)
      },
      {
        title: '설명',
        dataIndex: 'description',
        width: 260,
        ellipsis: true,
        sorter: createTextSorter((record) => record.description)
      },
      {
        title: '정의 방식',
        dataIndex: 'definitionType',
        width: 130,
        ...createDefinedColumnFilterProps(
          messageGroupDefinitionTypeFilterValues,
          (record) => record.definitionType
        ),
        sorter: createTextSorter((record) => record.definitionType)
      },
      {
        title: '조건 요약',
        dataIndex: 'ruleSummary',
        ellipsis: true,
        sorter: createTextSorter((record) => record.ruleSummary)
      },
      {
        title: '예상 대상 수',
        dataIndex: 'memberCount',
        width: 130,
        align: 'right',
        sorter: createNumberSorter((record) => record.memberCount),
        render: (value: number) => `${value.toLocaleString()}명`
      },
      {
        title: createStatusColumnTitle('상태', ['사용중', '초안']),
        dataIndex: 'status',
        width: 100,
        ...createDefinedColumnFilterProps(
          messageGroupStatusFilterValues,
          (record) => record.status
        ),
        sorter: createTextSorter((record) => record.status),
        render: (status: MessageGroupStatus) => <StatusBadge status={status} />
      },
      {
        title: '작업',
        key: 'actions',
        width: 132,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <Space size={4}>
            <Tooltip title="그룹 수정">
              <Button type="text" icon={<EditOutlined />} onClick={() => openEditDrawer(record)} />
            </Tooltip>
            <Tooltip title="대상 수 재계산">
              <Button type="text" icon={<ReloadOutlined />} onClick={() => handleRecalculate(record)} />
            </Tooltip>
            <Tooltip title="그룹 삭제">
              <Button
                danger
                type="text"
                icon={<DeleteOutlined />}
                onClick={() => setDeleteTarget(record)}
              />
            </Tooltip>
          </Space>
        )
      }
    ],
    [handleRecalculate, openEditDrawer]
  );

  const handleRetryLoad = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const ageRange = Form.useWatch('ageRange', form);

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="대상 그룹" />

      {loadState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="대상 그룹 조회에 실패했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>{loadState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
              <Text type="secondary">오류 코드: {loadState.errorCode ?? '-'}</Text>
              <Button onClick={handleRetryLoad}>다시 시도</Button>
            </Space>
          }
        />
      ) : null}

      <Card>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 8
          }}
        >
          <div style={{ flex: 1 }}>
            <SearchBar
              searchField={searchField}
              searchFieldOptions={[
                { label: '전체', value: 'all' },
                { label: '그룹 이름', value: 'name' },
                { label: '설명', value: 'description' },
                { label: '조건 요약', value: 'ruleSummary' }
              ]}
              keyword={keyword}
              onSearchFieldChange={(value) => commitParams({ searchField: value })}
              onKeywordChange={(event) =>
                commitParams({
                  keyword: event.target.value,
                  searchField
                })
              }
              keywordPlaceholder="검색..."
              detailTitle="상세 검색"
              detailContent={
                <SearchBarDetailField label="마지막 계산일">
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
                <Text type="secondary">총 {visibleGroups.length.toLocaleString()}건</Text>
              }
            />
          </div>
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openCreateDrawer}>
            그룹 추가
          </Button>
        </div>

        <Paragraph type="secondary" style={{ marginTop: 0 }}>
          메일과 푸시에서 공용으로 사용하는 대상 그룹입니다. 행을 클릭하면 우측에서 그룹 조건과
          예상 수신자 수를 바로 조정할 수 있습니다.
        </Paragraph>

        {loadState.status !== 'pending' && visibleGroups.length === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="조건에 맞는 대상 그룹이 없습니다."
            description="검색어 또는 정의 방식을 조정하거나 새 그룹을 생성하세요."
          />
        ) : null}

        <AdminDataTable<MessageGroup>
          rowKey="id"
          columns={columns}
          dataSource={visibleGroups}
          onRow={(record) => ({
            onClick: () => openEditDrawer(record),
            style: { cursor: 'pointer' }
          })}
          loading={loadState.status === 'pending'}
          pagination={false}
          scroll={{ x: 1180 }}
        />
      </Card>

      <Drawer
        open={Boolean(editorState)}
        title={editorState?.type === 'edit' ? '그룹 수정' : '그룹 추가'}
        width={640}
        onClose={closeDrawer}
      destroyOnHidden
        extra={
          editorState?.type === 'edit' ? (
            <Text type="secondary">그룹 ID: {editorState.group.id}</Text>
          ) : null
        }
        footer={
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Button onClick={closeDrawer}>취소</Button>
            <Space>
              <Button onClick={handlePreviewCount}>조회하기</Button>
              <Button type="primary" onClick={handleSaveGroup}>
                저장
              </Button>
            </Space>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={buildDefaultFormValues()}>
          <Form.Item
            label="그룹 이름"
            name="name"
            rules={[{ required: true, message: '그룹 이름을 입력하세요.' }]}
          >
            <Input placeholder="예: 활성 학습자" />
          </Form.Item>

          <Form.Item
            label="설명"
            name="description"
            rules={[{ required: true, message: '그룹 설명을 입력하세요.' }]}
          >
            <Input.TextArea rows={3} placeholder="발송 대상 그룹의 목적과 사용 맥락을 적어주세요." />
          </Form.Item>

          <Space align="start" size={16} style={{ width: '100%' }}>
            <Form.Item
              label="정의 방식"
              name="definitionType"
              rules={[{ required: true, message: '정의 방식을 선택하세요.' }]}
              style={{ flex: 1 }}
            >
              <Select
                options={[
                  { label: '조건 기반 그룹', value: '조건 기반 그룹' },
                  { label: '정적 그룹', value: '정적 그룹' }
                ]}
              />
            </Form.Item>
            <Form.Item
              label="운영 상태"
              name="status"
              rules={[{ required: true, message: '운영 상태를 선택하세요.' }]}
              style={{ width: 160 }}
            >
              <Select
                options={[
                  { label: '사용중', value: '사용중' },
                  { label: '초안', value: '초안' }
                ]}
              />
            </Form.Item>
          </Space>

          <Form.Item
            label="적용 채널"
            name="channels"
            rules={[{ required: true, message: '적용 채널을 하나 이상 선택하세요.' }]}
          >
            <Checkbox.Group options={channelOptions} />
          </Form.Item>

          {definitionType === '정적 그룹' ? (
            <Form.Item
              label="정적 대상 목록"
              name="staticMembersText"
              rules={[{ required: true, message: '정적 대상 목록을 입력하세요.' }]}
            >
              <Input.TextArea
                rows={10}
                placeholder="한 줄에 하나씩 이메일 또는 사용자 식별자를 입력하세요."
              />
            </Form.Item>
          ) : (
            <>
              <Form.Item label="설정 방식" name="builderMode">
                <Radio.Group
                  options={[
                    { label: '간편 설정', value: 'simple' },
                    { label: '상세 설정(Query Builder)', value: 'query-builder' }
                  ]}
                />
              </Form.Item>

              <Divider style={{ marginTop: 0 }} />
              <Title level={5}>세그먼트 설정</Title>

              <Form.Item label="국적" name="country">
                <Select
                  options={[
                    { label: '한국 (KR)', value: '한국 (KR)' },
                    { label: '미국 (US)', value: '미국 (US)' },
                    { label: '베트남 (VN)', value: '베트남 (VN)' }
                  ]}
                />
              </Form.Item>

              <Form.Item label="회원 유형" name="memberTypes">
                <Checkbox.Group options={memberTypeOptions} />
              </Form.Item>

              <Form.Item label="성별" name="genders">
                <Checkbox.Group options={genderOptions} />
              </Form.Item>

              <Form.Item label="연령" name="ageRange">
                <Slider range min={18} max={60} />
              </Form.Item>

              <Text type="secondary">
                선택 연령대: {ageRange?.[0] ?? 18}세 ~ {ageRange?.[1] ?? 30}세
              </Text>

              <Form.Item label="가입 방식" name="signupMethods" style={{ marginTop: 12 }}>
                <Checkbox.Group options={signupMethodOptions} />
              </Form.Item>

              <Form.Item label="가입 일자" name="signupDateRange">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item label="구독 여부" name="subscriptionStates">
                <Checkbox.Group options={subscriptionOptions} />
              </Form.Item>

              <Form.Item label="활동 여부" name="activityStates">
                <Checkbox.Group options={activityOptions} />
              </Form.Item>

              {builderMode === 'query-builder' ? (
                <Form.Item
                  label="상세 조건(Query Builder)"
                  name="queryBuilderText"
                  rules={[{ required: true, message: '상세 조건을 입력하세요.' }]}
                >
                  <Input.TextArea
                    rows={6}
                    placeholder="예: country = 'KR' AND member_type = '학생' AND last_login_at >= NOW() - INTERVAL '90 day'"
                  />
                </Form.Item>
              ) : null}
            </>
          )}
        </Form>

        <Divider />

        <Descriptions
          size="small"
          column={1}
          bordered
          items={[
            {
              key: 'summary',
              label: '조건 요약',
              children:
                editorState?.type === 'edit'
                  ? editorState.group.ruleSummary
                  : '저장 시 조건 요약이 자동 생성됩니다.'
            },
            {
              key: 'preview',
              label: '예상 발송 인원',
              children: previewCount === null ? '조회하기 전' : `${previewCount.toLocaleString()}명`
            },
            {
              key: 'lastCalculatedAt',
              label: '마지막 계산',
              children: editorState?.type === 'edit' ? editorState.group.lastCalculatedAt : '-'
            }
          ]}
        />
      </Drawer>

      {deleteTarget ? (
        <ConfirmAction
          open
          title="대상 그룹 삭제"
          description="공용 대상 그룹을 삭제하면 메일/푸시 템플릿에서 해당 그룹을 새로 선택할 수 없습니다. 삭제 사유를 남기세요."
          targetType="Message"
          targetId={deleteTarget.id}
          confirmText="삭제 실행"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteGroup}
        />
      ) : null}
    </div>
  );
}
