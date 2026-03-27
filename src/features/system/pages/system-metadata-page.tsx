import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
  notification
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  fetchMetadataGroupsSafe,
  saveMetadataGroupSafe,
  saveMetadataItemSafe,
  toggleMetadataGroupStatusSafe,
  toggleMetadataItemStatusSafe
} from '../api/system-metadata-service';
import { usePermissionStore } from '../model/permission-store';
import type { AsyncState } from '../../../shared/model/async-state';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '../../../shared/ui/detail-drawer/detail-drawer';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { BinaryStatusSwitch } from '../../../shared/ui/table/binary-status-switch';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';
import type {
  MetadataExposureStatus,
  MetadataStatus,
  SystemMetadataGroup,
  SystemMetadataHistoryEntry,
  SystemMetadataItem
} from '../model/system-metadata-types';
import {
  metadataExposureStatusOptions,
  metadataManagerTypeOptions,
  metadataOwnerModuleOptions,
  metadataStatusOptions,
  metadataSyncStatusOptions
} from '../model/system-metadata-types';

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

type SummaryFilter = 'linked' | 'internal' | 'review' | '';

type GroupEditorState =
  | {
      mode: 'create' | 'edit';
      group: SystemMetadataGroup | null;
    }
  | null;

type ItemEditorState =
  | {
      groupId: string;
      item: SystemMetadataItem | null;
    }
  | null;

type StatusActionState =
  | {
      target: 'group';
      group: SystemMetadataGroup;
      nextStatus: MetadataStatus;
    }
  | {
      target: 'item';
      group: SystemMetadataGroup;
      item: SystemMetadataItem;
      nextStatus: MetadataStatus;
    }
  | null;

type GroupFormValues = {
  groupName: string;
  description: string;
  managerType: SystemMetadataGroup['managerType'];
  ownerModule: SystemMetadataGroup['ownerModule'];
  ownerRole: string;
  syncStatus: SystemMetadataGroup['syncStatus'];
  exposureStatus: SystemMetadataGroup['exposureStatus'];
  itemCodePrefix: string;
  linkedAdminPagesText: string;
  linkedUserSurfacesText: string;
  schemaCandidateNotesText: string;
};

type ItemFormValues = {
  code: string;
  label: string;
  description: string;
  status: MetadataStatus;
  sortOrder: number;
  isDefault: 'yes' | 'no';
  exposureStatus: MetadataExposureStatus;
};

function parseSummaryFilter(value: string | null): SummaryFilter {
  if (value === 'linked' || value === 'internal' || value === 'review') {
    return value;
  }

  return '';
}

function normalizeMultilineValue(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

function joinMultilineValue(values: string[]): string {
  return values.join('\n');
}

function sortGroups(groups: SystemMetadataGroup[]): SystemMetadataGroup[] {
  return [...groups].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function mergeUpdatedGroup(
  groups: SystemMetadataGroup[],
  updatedGroup: SystemMetadataGroup
): SystemMetadataGroup[] {
  const exists = groups.some((group) => group.groupId === updatedGroup.groupId);
  const nextGroups = exists
    ? groups.map((group) =>
        group.groupId === updatedGroup.groupId ? updatedGroup : group
      )
    : [updatedGroup, ...groups];

  return sortGroups(nextGroups);
}

function matchesSummaryFilter(
  group: SystemMetadataGroup,
  summaryFilter: SummaryFilter
): boolean {
  if (!summaryFilter) {
    return true;
  }
  if (summaryFilter === 'linked') {
    return group.linkedUserSurfaces.length > 0 && group.exposureStatus !== '내부 전용';
  }
  if (summaryFilter === 'internal') {
    return group.exposureStatus === '내부 전용';
  }
  if (summaryFilter === 'review') {
    return group.syncStatus === '검토 필요';
  }

  return true;
}

function getSyncStatusColor(status: SystemMetadataGroup['syncStatus']): string {
  if (status === '운영 중') {
    return 'green';
  }
  if (status === '검토 필요') {
    return 'gold';
  }
  return 'default';
}

function getExposureStatusColor(status: MetadataExposureStatus): string {
  if (status === '확인됨') {
    return 'green';
  }
  if (status === '운영상 추정') {
    return 'gold';
  }
  if (status === '노출 예정') {
    return 'blue';
  }
  return 'default';
}

function getPreviewText(values: string[]): string {
  if (values.length === 0) {
    return '-';
  }
  if (values.length === 1) {
    return values[0];
  }
  return `${values[0]} 외 ${values.length - 1}`;
}

function buildNotificationDescription(group: SystemMetadataGroup, reason: string): JSX.Element {
  return (
    <Space direction="vertical">
      <Text>Target Type: SystemMetadataGroup</Text>
      <Text>Target ID: {group.groupId}</Text>
      <Text>사유/근거: {reason}</Text>
      <AuditLogLink targetType="SystemMetadataGroup" targetId={group.groupId} />
    </Space>
  );
}

function renderValueList(values: string[]): JSX.Element {
  if (values.length === 0) {
    return <Text type="secondary">없음</Text>;
  }

  return (
    <Space direction="vertical" size={4}>
      {values.map((value) => (
        <Text key={value}>{value}</Text>
      ))}
    </Space>
  );
}

export default function SystemMetadataPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const [metadataState, setMetadataState] = useState<AsyncState<SystemMetadataGroup[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [groupEditorState, setGroupEditorState] = useState<GroupEditorState>(null);
  const [itemEditorState, setItemEditorState] = useState<ItemEditorState>(null);
  const [statusActionState, setStatusActionState] = useState<StatusActionState>(null);
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [groupForm] = Form.useForm<GroupFormValues>();
  const [itemForm] = Form.useForm<ItemFormValues>();
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const summaryFilter = parseSummaryFilter(searchParams.get('summaryFilter'));
  const searchField = searchParams.get('searchField') ?? 'all';
  const keyword = searchParams.get('keyword') ?? '';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const selectedGroupId = searchParams.get('selected') ?? '';
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

  const commitParams = useCallback(
    (
      next: Partial<
        Record<
          'searchField' | 'keyword' | 'startDate' | 'endDate' | 'selected' | 'summaryFilter',
          string | null
        >
      >
    ) => {
      const merged = new URLSearchParams(searchParams);

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

  useEffect(() => {
    const controller = new AbortController();

    setMetadataState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchMetadataGroupsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        const sortedGroups = sortGroups(result.data);
        setMetadataState({
          status: sortedGroups.length === 0 ? 'empty' : 'success',
          data: sortedGroups,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setMetadataState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  const selectedGroup = useMemo(
    () =>
      selectedGroupId
        ? metadataState.data.find((group) => group.groupId === selectedGroupId) ?? null
        : null,
    [metadataState.data, selectedGroupId]
  );

  useEffect(() => {
    const canValidateSelection =
      metadataState.status === 'success' ||
      metadataState.status === 'empty' ||
      (metadataState.status === 'error' && metadataState.data.length > 0);

    if (!selectedGroupId || !canValidateSelection) {
      return;
    }

    const hasSelectedGroup = metadataState.data.some(
      (group) => group.groupId === selectedGroupId
    );

    if (!hasSelectedGroup) {
      commitParams({ selected: null });
    }
  }, [commitParams, metadataState.data, metadataState.status, selectedGroupId]);

  useEffect(() => {
    if (!groupEditorState) {
      groupForm.resetFields();
      return;
    }

    const group = groupEditorState.group;
    groupForm.setFieldsValue({
      groupName: group?.groupName ?? '',
      description: group?.description ?? '',
      managerType: group?.managerType ?? '코드 테이블',
      ownerModule: group?.ownerModule ?? 'System',
      ownerRole: group?.ownerRole ?? 'OPS_ADMIN',
      syncStatus: group?.syncStatus ?? '초안',
      exposureStatus: group?.exposureStatus ?? '내부 전용',
      itemCodePrefix: group?.itemCodePrefix ?? '',
      linkedAdminPagesText: joinMultilineValue(group?.linkedAdminPages ?? []),
      linkedUserSurfacesText: joinMultilineValue(group?.linkedUserSurfaces ?? []),
      schemaCandidateNotesText: joinMultilineValue(group?.schemaCandidateNotes ?? [])
    });
  }, [groupEditorState, groupForm]);

  useEffect(() => {
    if (!itemEditorState) {
      itemForm.resetFields();
      return;
    }

    const item = itemEditorState.item;
    itemForm.setFieldsValue({
      code: item?.code ?? '',
      label: item?.label ?? '',
      description: item?.description ?? '',
      status: item?.status ?? '활성',
      sortOrder: item?.sortOrder ?? 1,
      isDefault: item?.isDefault ? 'yes' : 'no',
      exposureStatus: item?.exposureStatus ?? '내부 전용'
    });
  }, [itemEditorState, itemForm]);

  const filteredGroups = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return metadataState.data.filter((group) => {
      if (!matchesSummaryFilter(group, summaryFilter)) {
        return false;
      }
      if (!matchesSearchDateRange(group.updatedAt, startDate, endDate)) {
        return false;
      }
      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        groupId: group.groupId,
        groupName: group.groupName,
        adminPage: group.linkedAdminPages,
        userSurface: group.linkedUserSurfaces
      });
    });
  }, [endDate, keyword, metadataState.data, searchField, startDate, summaryFilter]);

  const openDrawer = useCallback(
    (groupId: string) => {
      commitParams({ selected: groupId });
    },
    [commitParams]
  );

  const closeDrawer = useCallback(() => {
    commitParams({ selected: null });
  }, [commitParams]);

  const handleApplyDateRange = useCallback(() => {
    commitParams({
      startDate: draftStartDate || null,
      endDate: draftEndDate || null
    });
  }, [commitParams, draftEndDate, draftStartDate]);

  const handleSummaryFilter = useCallback(
    (nextSummaryFilter: SummaryFilter) => {
      commitParams({ summaryFilter: nextSummaryFilter || null });
    },
    [commitParams]
  );

  const openCreateGroupModal = useCallback(() => {
    setGroupEditorState({ mode: 'create', group: null });
  }, []);

  const openEditGroupModal = useCallback((group: SystemMetadataGroup) => {
    setGroupEditorState({ mode: 'edit', group });
  }, []);

  const closeGroupModal = useCallback(() => {
    setGroupEditorState(null);
  }, []);

  const openCreateItemModal = useCallback((groupId: string) => {
    setItemEditorState({ groupId, item: null });
  }, []);

  const openEditItemModal = useCallback((groupId: string, item: SystemMetadataItem) => {
    setItemEditorState({ groupId, item });
  }, []);

  const closeItemModal = useCallback(() => {
    setItemEditorState(null);
  }, []);

  const handleReload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleSubmitGroup = useCallback(async () => {
    if (!groupEditorState) {
      return;
    }

    try {
      const values = await groupForm.validateFields();
      setSubmittingGroup(true);
      const reason =
        groupEditorState.mode === 'create'
          ? '운영 메타데이터 그룹 신규 등록'
          : '운영 메타데이터 그룹 정보 수정';
      const result = await saveMetadataGroupSafe({
        groupId: groupEditorState.group?.groupId,
        groupName: values.groupName,
        description: values.description,
        managerType: values.managerType,
        ownerModule: values.ownerModule,
        ownerRole: values.ownerRole,
        syncStatus: values.syncStatus,
        exposureStatus: values.exposureStatus,
        linkedAdminPages: normalizeMultilineValue(values.linkedAdminPagesText),
        linkedUserSurfaces: normalizeMultilineValue(values.linkedUserSurfacesText),
        schemaCandidateNotes: normalizeMultilineValue(values.schemaCandidateNotesText),
        itemCodePrefix: values.itemCodePrefix,
        reason,
        changedBy: currentAdminId
      });

      if (!result.ok) {
        notificationApi.error({
          message:
            groupEditorState.mode === 'create'
              ? '메타 그룹 등록 실패'
              : '메타 그룹 수정 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">오류 코드: {result.error.code}</Text>
            </Space>
          )
        });
        return;
      }

      setMetadataState((prev) => ({
        status: 'success',
        data: mergeUpdatedGroup(prev.data, result.data),
        errorMessage: null,
        errorCode: null
      }));
      commitParams({ selected: result.data.groupId });
      setGroupEditorState(null);
      notificationApi.success({
        message:
          groupEditorState.mode === 'create'
            ? '메타 그룹 등록 완료'
            : '메타 그룹 수정 완료',
        description: buildNotificationDescription(result.data, reason)
      });
    } finally {
      setSubmittingGroup(false);
    }
  }, [commitParams, currentAdminId, groupEditorState, groupForm, notificationApi]);

  const handleSubmitItem = useCallback(async () => {
    if (!itemEditorState) {
      return;
    }

    try {
      const values = await itemForm.validateFields();
      setSubmittingItem(true);
      const reason = itemEditorState.item
        ? '메타 항목 정보 수정'
        : '메타 항목 신규 추가';
      const result = await saveMetadataItemSafe({
        groupId: itemEditorState.groupId,
        itemId: itemEditorState.item?.itemId,
        code: values.code,
        label: values.label,
        description: values.description,
        status: values.status,
        sortOrder: Number(values.sortOrder),
        isDefault: values.isDefault === 'yes',
        exposureStatus: values.exposureStatus,
        reason,
        changedBy: currentAdminId
      });

      if (!result.ok) {
        notificationApi.error({
          message: itemEditorState.item ? '메타 항목 수정 실패' : '메타 항목 추가 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">오류 코드: {result.error.code}</Text>
            </Space>
          )
        });
        return;
      }

      setMetadataState((prev) => ({
        status: 'success',
        data: mergeUpdatedGroup(prev.data, result.data),
        errorMessage: null,
        errorCode: null
      }));
      commitParams({ selected: result.data.groupId });
      setItemEditorState(null);
      notificationApi.success({
        message: itemEditorState.item ? '메타 항목 수정 완료' : '메타 항목 추가 완료',
        description: buildNotificationDescription(result.data, reason)
      });
    } finally {
      setSubmittingItem(false);
    }
  }, [commitParams, currentAdminId, itemEditorState, itemForm, notificationApi]);

  const handleStatusAction = useCallback(async (reason: string) => {
    if (!statusActionState) {
      return;
    }

    if (statusActionState.target === 'group') {
      const result = await toggleMetadataGroupStatusSafe({
        groupId: statusActionState.group.groupId,
        nextStatus: statusActionState.nextStatus,
        reason,
        changedBy: currentAdminId
      });

      if (!result.ok) {
        notificationApi.error({
          message: '메타 그룹 상태 변경 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">오류 코드: {result.error.code}</Text>
            </Space>
          )
        });
        return;
      }

      setMetadataState((prev) => ({
        status: 'success',
        data: mergeUpdatedGroup(prev.data, result.data),
        errorMessage: null,
        errorCode: null
      }));
      notificationApi.success({
        message:
          statusActionState.nextStatus === '비활성'
            ? '메타 그룹 비활성화 완료'
            : '메타 그룹 활성화 완료',
        description: buildNotificationDescription(result.data, reason)
      });
    }

    if (statusActionState.target === 'item') {
      const result = await toggleMetadataItemStatusSafe({
        groupId: statusActionState.group.groupId,
        itemId: statusActionState.item.itemId,
        nextStatus: statusActionState.nextStatus,
        reason,
        changedBy: currentAdminId
      });

      if (!result.ok) {
        notificationApi.error({
          message: '메타 항목 상태 변경 실패',
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">오류 코드: {result.error.code}</Text>
            </Space>
          )
        });
        return;
      }

      setMetadataState((prev) => ({
        status: 'success',
        data: mergeUpdatedGroup(prev.data, result.data),
        errorMessage: null,
        errorCode: null
      }));
      notificationApi.success({
        message:
          statusActionState.nextStatus === '비활성'
            ? '메타 항목 비활성화 완료'
            : '메타 항목 활성화 완료',
        description: buildNotificationDescription(result.data, reason)
      });
    }

    setStatusActionState(null);
  }, [currentAdminId, notificationApi, statusActionState]);

  const summaryItems = useMemo(() => {
    const totalCount = metadataState.data.length;
    const linkedCount = metadataState.data.filter(
      (group) => group.linkedUserSurfaces.length > 0 && group.exposureStatus !== '내부 전용'
    ).length;
    const internalCount = metadataState.data.filter(
      (group) => group.exposureStatus === '내부 전용'
    ).length;
    const reviewCount = metadataState.data.filter(
      (group) => group.syncStatus === '검토 필요'
    ).length;

    return [
      {
        key: 'all',
        label: '전체 그룹',
        value: `${totalCount.toLocaleString()}개`,
        active: summaryFilter === '',
        onClick: () => handleSummaryFilter('')
      },
      {
        key: 'linked',
        label: 'B2C 연결',
        value: `${linkedCount.toLocaleString()}개`,
        hint: '확인됨/운영상 추정 surface 보유',
        active: summaryFilter === 'linked',
        onClick: () => handleSummaryFilter('linked')
      },
      {
        key: 'internal',
        label: '내부 전용',
        value: `${internalCount.toLocaleString()}개`,
        active: summaryFilter === 'internal',
        onClick: () => handleSummaryFilter('internal')
      },
      {
        key: 'review',
        label: '검토 필요',
        value: `${reviewCount.toLocaleString()}개`,
        active: summaryFilter === 'review',
        onClick: () => handleSummaryFilter('review')
      }
    ];
  }, [handleSummaryFilter, metadataState.data, summaryFilter]);

  const columns = useMemo<TableColumnsType<SystemMetadataGroup>>(
    () => [
      {
        title: '그룹 ID',
        dataIndex: 'groupId',
        width: 120,
        sorter: createTextSorter((record) => record.groupId)
      },
      {
        title: '그룹명',
        dataIndex: 'groupName',
        width: 220,
        sorter: createTextSorter((record) => record.groupName)
      },
      {
        title: '유형',
        dataIndex: 'managerType',
        width: 120,
        sorter: createTextSorter((record) => record.managerType)
      },
      {
        title: '상태',
        dataIndex: 'status',
        width: 120,
        onCell: () => ({
          onClick: (event) => event.stopPropagation()
        }),
        render: (_, record) => (
          <BinaryStatusSwitch
            checked={record.status === '활성'}
            checkedLabel="활성"
            uncheckedLabel="비활성"
            onToggle={() =>
              setStatusActionState({
                target: 'group',
                group: record,
                nextStatus: record.status === '활성' ? '비활성' : '활성'
              })
            }
          />
        )
      },
      {
        title: '동기화 상태',
        dataIndex: 'syncStatus',
        width: 120,
        sorter: createTextSorter((record) => record.syncStatus),
        render: (value: SystemMetadataGroup['syncStatus']) => (
          <Tag color={getSyncStatusColor(value)}>{value}</Tag>
        )
      },
      {
        title: 'B2C 노출',
        dataIndex: 'exposureStatus',
        width: 120,
        sorter: createTextSorter((record) => record.exposureStatus),
        render: (value: MetadataExposureStatus) => (
          <Tag color={getExposureStatusColor(value)}>{value}</Tag>
        )
      },
      {
        title: '연관 관리자 화면',
        dataIndex: 'linkedAdminPages',
        width: 240,
        render: (value: string[]) => getPreviewText(value)
      },
      {
        title: '연관 사용자 화면',
        dataIndex: 'linkedUserSurfaces',
        width: 220,
        render: (value: string[]) => getPreviewText(value)
      },
      {
        title: '항목 수',
        key: 'itemCount',
        width: 90,
        sorter: createTextSorter((record) => String(record.items.length)),
        render: (_, record) => `${record.items.length}개`
      },
      {
        title: '최근 수정',
        dataIndex: 'updatedAt',
        width: 170,
        sorter: createTextSorter((record) => record.updatedAt)
      },
      {
        title: '액션',
        key: 'action',
        width: 90,
        onCell: () => ({
          onClick: (event) => event.stopPropagation()
        }),
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `open-${record.groupId}`,
                label: '상세 보기',
                onClick: () => openDrawer(record.groupId)
              },
              {
                key: `edit-${record.groupId}`,
                label: '그룹 수정',
                onClick: () => openEditGroupModal(record)
              },
              {
                key: `add-item-${record.groupId}`,
                label: '항목 추가',
                onClick: () => openCreateItemModal(record.groupId)
              },
              {
                key:
                  record.status === '활성'
                    ? `deactivate-${record.groupId}`
                    : `activate-${record.groupId}`,
                label: record.status === '활성' ? '그룹 비활성화' : '그룹 활성화',
                danger: record.status === '활성',
                onClick: () =>
                  setStatusActionState({
                    target: 'group',
                    group: record,
                    nextStatus: record.status === '활성' ? '비활성' : '활성'
                  })
              }
            ]}
          />
        )
      }
    ],
    [openCreateItemModal, openDrawer, openEditGroupModal]
  );

  const itemColumns = useMemo<TableColumnsType<SystemMetadataItem>>(
    () => [
      {
        title: '코드',
        dataIndex: 'code',
        width: 150,
        sorter: createTextSorter((record) => record.code)
      },
      {
        title: '라벨',
        dataIndex: 'label',
        width: 160,
        sorter: createTextSorter((record) => record.label)
      },
      {
        title: '상태',
        dataIndex: 'status',
        width: 100,
        render: (value: MetadataStatus) => <StatusBadge status={value} />
      },
      {
        title: 'B2C 노출',
        dataIndex: 'exposureStatus',
        width: 120,
        render: (value: MetadataExposureStatus) => (
          <Tag color={getExposureStatusColor(value)}>{value}</Tag>
        )
      },
      {
        title: '정렬',
        dataIndex: 'sortOrder',
        width: 80
      },
      {
        title: '기본값',
        dataIndex: 'isDefault',
        width: 90,
        render: (value: boolean) =>
          value ? <Tag color="blue">기본값</Tag> : <Text type="secondary">-</Text>
      },
      {
        title: '최근 수정',
        dataIndex: 'updatedAt',
        width: 160
      },
      {
        title: '액션',
        key: 'action',
        width: 90,
        render: (_, record) =>
          selectedGroup ? (
            <TableActionMenu
              items={[
                {
                  key: `edit-item-${record.itemId}`,
                  label: '항목 수정',
                  onClick: () => openEditItemModal(selectedGroup.groupId, record)
                },
                {
                  key:
                    record.status === '활성'
                      ? `deactivate-item-${record.itemId}`
                      : `activate-item-${record.itemId}`,
                  label: record.status === '활성' ? '항목 비활성화' : '항목 활성화',
                  danger: record.status === '활성',
                  onClick: () =>
                    setStatusActionState({
                      target: 'item',
                      group: selectedGroup,
                      item: record,
                      nextStatus: record.status === '활성' ? '비활성' : '활성'
                    })
                }
              ]}
            />
          ) : null
      }
    ],
    [openEditItemModal, selectedGroup]
  );

  const historyColumns = useMemo<TableColumnsType<SystemMetadataHistoryEntry>>(
    () => [
      {
        title: '시각',
        dataIndex: 'createdAt',
        width: 170
      },
      {
        title: '조치',
        dataIndex: 'action',
        width: 140
      },
      {
        title: '수행자',
        dataIndex: 'changedBy',
        width: 130
      },
      {
        title: '사유/근거',
        dataIndex: 'reason'
      }
    ],
    []
  );

  const hasCachedGroups = metadataState.data.length > 0;
  const isFilteredEmpty =
    metadataState.status !== 'empty' &&
    metadataState.data.length > 0 &&
    filteredGroups.length === 0;
