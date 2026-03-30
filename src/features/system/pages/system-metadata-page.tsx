import {
  DeleteOutlined,
  EditOutlined,
  MenuOutlined,
  MinusSquareOutlined,
  PlusOutlined,
  PlusSquareOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
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
  Tooltip,
  Tree,
  Typography,
  notification
} from 'antd';
import type { DescriptionsProps, TableColumnsType, TreeProps } from 'antd';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  deleteMetadataItemSafe,
  fetchMetadataGroupsSafe,
  reorderMetadataItemsSafe,
  saveMetadataGroupSafe,
  saveMetadataItemSafe,
  toggleMetadataGroupStatusSafe,
  toggleMetadataItemStatusSafe
} from '../api/system-metadata-service';
import { usePermissionStore } from '../model/permission-store';
import type { AsyncState } from '../../../shared/model/async-state';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { AdminFormDescriptions } from '../../../shared/ui/descriptions/admin-form-descriptions';
import {
  DETAIL_DRAWER_WIDTH,
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
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { BinaryStatusSwitch } from '../../../shared/ui/table/binary-status-switch';
import {
  DRAWER_TABLE_PAGINATION,
  createDrawerTableScroll,
  fixDrawerTableFirstColumn
} from '../../../shared/ui/table/drawer-table';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { createTextSorter } from '../../../shared/ui/table/table-column-utils';
import type {
  MetadataExposureStatus,
  MetadataHistoryAction,
  MetadataModule,
  MetadataManagerType,
  MetadataStatus,
  MetadataSyncStatus,
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

const TEXT = {
  pageTitle: '운영 설정 카탈로그',
  toolbarSummary: '총',
  createGroup: '설정 추가',
  editGroup: '설정 수정',
  createItem: '운영 값 추가',
  editItem: '운영 값 수정',
  drawerTitle: '운영 설정 상세',
  active: '활성',
  inactive: '비활성',
  confirmed: '확인됨',
  inferred: '운영상 추정',
  internalOnly: '내부 전용',
  planned: '노출 예정',
  live: '운영 중',
  review: '검토 필요',
  draft: '초안',
  reason: '사유/근거',
  none: '없음',
  defaultValue: '기본값'
} as const;

const MODULE_LABELS: Record<MetadataModule, string> = {
  Users: '회원/권한',
  Message: '메시지 발송',
  Operation: '운영/노출',
  Commerce: '커머스/혜택',
  Content: '콘텐츠',
  System: '시스템'
};

const MANAGER_TYPE_LABELS: Record<MetadataManagerType, string> = {
  codeTable: '코드 테이블',
  selectOption: '선택 옵션',
  exposureRule: '노출 규칙',
  segmentField: '세그먼트 필드'
};

const EXPOSURE_LABELS: Record<MetadataExposureStatus, string> = {
  confirmed: TEXT.confirmed,
  inferred: TEXT.inferred,
  internalOnly: TEXT.internalOnly,
  planned: TEXT.planned
};

const SYNC_LABELS: Record<MetadataSyncStatus, string> = {
  live: TEXT.live,
  review: TEXT.review,
  draft: TEXT.draft
};

const STATUS_LABELS: Record<MetadataStatus, string> = {
  active: TEXT.active,
  inactive: TEXT.inactive
};

const MANAGER_TYPE_SELECT_OPTIONS = metadataManagerTypeOptions.map((option) => ({
  value: option.value,
  label: MANAGER_TYPE_LABELS[option.value]
}));

const OWNER_MODULE_SELECT_OPTIONS = metadataOwnerModuleOptions.map((option) => ({
  value: option.value,
  label: MODULE_LABELS[option.value]
}));

const SYNC_STATUS_SELECT_OPTIONS = metadataSyncStatusOptions.map((option) => ({
  value: option.value,
  label: SYNC_LABELS[option.value]
}));

const EXPOSURE_STATUS_SELECT_OPTIONS = metadataExposureStatusOptions.map((option) => ({
  value: option.value,
  label: EXPOSURE_LABELS[option.value]
}));

const STATUS_SELECT_OPTIONS = metadataStatusOptions.map((option) => ({
  value: option.value,
  label: STATUS_LABELS[option.value]
}));

const DEFAULT_VALUE_SELECT_OPTIONS = [
  { value: 'yes', label: TEXT.defaultValue },
  { value: 'no', label: '기본값 아님' }
] as const;

const DRAWER_TABLE_PAGINATION_WITH_HIDE = {
  ...DRAWER_TABLE_PAGINATION,
  hideOnSinglePage: true
} as const;

const HISTORY_ACTION_LABELS: Record<MetadataHistoryAction, string> = {
  group_created: '설정 생성',
  group_updated: '설정 수정',
  group_activated: '설정 활성화',
  group_deactivated: '설정 비활성화',
  item_created: '운영 값 추가',
  item_deleted: '운영 값 삭제',
  item_reordered: '운영 값 순서 변경',
  item_updated: '운영 값 수정',
  item_activated: '운영 값 활성화',
  item_deactivated: '운영 값 비활성화'
};

type SummaryFilter =
  | 'memberSettings'
  | 'messageSettings'
  | 'operationExposure'
  | 'commerceBenefits'
  | '';

const SUMMARY_FILTER_LABELS: Record<Exclude<SummaryFilter, ''>, string> = {
  memberSettings: '회원/권한',
  messageSettings: '메시지 발송',
  operationExposure: '운영/노출',
  commerceBenefits: '커머스/혜택'
};

type GroupEditorState =
  | { mode: 'create' | 'edit'; group: SystemMetadataGroup | null }
  | null;

type ItemEditorState =
  | { groupId: string; item: SystemMetadataItem | null }
  | null;

type StatusActionState =
  | { target: 'group'; group: SystemMetadataGroup; nextStatus: MetadataStatus }
  | {
      target: 'item';
      group: SystemMetadataGroup;
      item: SystemMetadataItem;
      nextStatus: MetadataStatus;
    }
  | null;

type DeleteActionState =
  | {
      group: SystemMetadataGroup;
      item: SystemMetadataItem;
    }
  | null;

type GroupFormValues = {
  groupName: string;
  description: string;
  managerType: MetadataManagerType;
  ownerModule: SystemMetadataGroup['ownerModule'];
  ownerRole: string;
  syncStatus: MetadataSyncStatus;
  exposureStatus: MetadataExposureStatus;
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

type MetadataItemDragHandleProps = {
  itemId: string;
  disabled: boolean;
  onDragStart: (itemId: string, event: ReactDragEvent<HTMLButtonElement>) => void;
  onDragEnd: () => void;
};

type MetadataTreeItemTitleProps = {
  item: SystemMetadataItem;
  hovered: boolean;
  onHoverChange: (hovered: boolean) => void;
  onDelete: (item: SystemMetadataItem, event: ReactMouseEvent<HTMLButtonElement>) => void;
};

type MetadataTreeAddTitleProps = {
  onClick: () => void;
};

function MetadataItemDragHandle({
  itemId,
  disabled,
  onDragStart,
  onDragEnd
}: MetadataItemDragHandleProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label="운영 값 순서 변경"
      draggable={!disabled}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 0,
        background: 'transparent',
        padding: 4,
        cursor: disabled ? 'not-allowed' : 'grab',
        color: 'rgba(0, 0, 0, 0.45)'
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDragStart={(event) => onDragStart(itemId, event)}
      onDragEnd={onDragEnd}
    >
      <MenuOutlined />
    </button>
  );
}

function MetadataTreeItemTitle({
  item,
  hovered,
  onHoverChange,
  onDelete
}: MetadataTreeItemTitleProps): JSX.Element {
  return (
    <span
      data-testid={`metadata-tree-item-${item.itemId}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: '100%'
      }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <span>{item.label}</span>
      {hovered ? (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          data-testid={`metadata-tree-delete-button-${item.itemId}`}
          aria-label={`운영 값 삭제 ${item.label}`}
          onClick={(event) => onDelete(item, event)}
        />
      ) : null}
    </span>
  );
}

function MetadataTreeAddTitle({ onClick }: MetadataTreeAddTitleProps): JSX.Element {
  return (
    <span
      role="button"
      tabIndex={0}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer'
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <PlusSquareOutlined style={{ color: 'rgba(0, 0, 0, 0.65)' }} />
      <span>추가</span>
    </span>
  );
}

function parseSummaryFilter(value: string | null): SummaryFilter {
  return value === 'memberSettings' ||
    value === 'messageSettings' ||
    value === 'operationExposure' ||
    value === 'commerceBenefits'
    ? value
    : '';
}

function normalizeMultilineValue(value: string): string[] {
  return [...new Set(value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
}

function joinMultilineValue(values: string[]): string {
  return values.join('\n');
}

function normalizeDuplicateValue(value: string): string {
  return value.trim().toLowerCase();
}

function sortGroups(groups: SystemMetadataGroup[]): SystemMetadataGroup[] {
  return [...groups].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function moveArrayItem<T>(values: T[], fromIndex: number, toIndex: number): T[] {
  const nextValues = [...values];
  const [targetValue] = nextValues.splice(fromIndex, 1);
  nextValues.splice(toIndex, 0, targetValue);
  return nextValues;
}

function getSettingCategory(group: SystemMetadataGroup): Exclude<SummaryFilter, ''> {
  if (group.ownerModule === 'Users' || group.ownerModule === 'System') {
    return 'memberSettings';
  }
  if (group.ownerModule === 'Message') {
    return 'messageSettings';
  }
  if (group.ownerModule === 'Commerce') {
    return 'commerceBenefits';
  }
  return 'operationExposure';
}

function getItemPreviewText(items: SystemMetadataItem[]): string {
  if (items.length === 0) return '-';
  const labels = items.slice(0, 2).map((item) => item.label);
  return items.length > 2 ? `${labels.join(', ')} 외 ${items.length - 2}개` : labels.join(', ');
}

function getDefaultItemLabels(items: SystemMetadataItem[]): string[] {
  return items.filter((item) => item.isDefault).map((item) => item.label);
}

function getFeatureSearchValues(group: SystemMetadataGroup): string[] {
  return [
    MODULE_LABELS[group.ownerModule],
    SUMMARY_FILTER_LABELS[getSettingCategory(group)],
    MANAGER_TYPE_LABELS[group.managerType]
  ];
}

function buildDrawerGuideDescription(group: SystemMetadataGroup): string {
  if (group.linkedUserSurfaces.length === 0) {
    return '이 설정은 내부 운영에서 공통으로 쓰는 기준값입니다. 아래 설정 구조와 운영 값 목록에서 실제 선택지와 정렬 순서를 관리합니다.';
  }
  return `이 설정은 ${getPreviewText(group.linkedUserSurfaces)}에 영향을 줍니다. 운영 값 라벨과 기본값, 정렬 순서를 함께 검토해 주세요.`;
}

function mergeUpdatedGroup(
  groups: SystemMetadataGroup[],
  updatedGroup: SystemMetadataGroup
): SystemMetadataGroup[] {
  const exists = groups.some((group) => group.groupId === updatedGroup.groupId);
  return sortGroups(
    exists
      ? groups.map((group) => (group.groupId === updatedGroup.groupId ? updatedGroup : group))
      : [updatedGroup, ...groups]
  );
}

function matchesSummaryFilter(group: SystemMetadataGroup, summaryFilter: SummaryFilter): boolean {
  if (!summaryFilter) {
    return true;
  }
  return getSettingCategory(group) === summaryFilter;
}

function getSyncStatusColor(status: MetadataSyncStatus): string {
  if (status === 'live') return 'green';
  if (status === 'review') return 'gold';
  return 'default';
}

function getExposureStatusColor(status: MetadataExposureStatus): string {
  if (status === 'confirmed') return 'green';
  if (status === 'inferred') return 'gold';
  if (status === 'planned') return 'blue';
  return 'default';
}

function getPreviewText(values: string[]): string {
  if (values.length === 0) return '-';
  if (values.length === 1) return values[0];
  return `${values[0]} 외 ${values.length - 1}개`;
}

function renderValueList(values: string[]): JSX.Element {
  if (values.length === 0) {
    return <Text type="secondary">{TEXT.none}</Text>;
  }

  return (
    <Space direction="vertical" size={4}>
      {values.map((value) => (
        <Text key={value}>{value}</Text>
      ))}
    </Space>
  );
}

function createHelpLabel(label: string, description: string): JSX.Element {
  return (
    <Space size={4}>
      <span>{label}</span>
      <Tooltip title={description}>
        <QuestionCircleOutlined style={{ color: 'rgba(0, 0, 0, 0.45)' }} />
      </Tooltip>
    </Space>
  );
}

function buildNotificationDescription(group: SystemMetadataGroup, reason: string): JSX.Element {
  return (
    <Space direction="vertical">
      <Text>Target Type: SystemMetadataGroup</Text>
      <Text>Target ID: {group.groupId}</Text>
      <Text>
        {TEXT.reason}: {reason}
      </Text>
      <AuditLogLink targetType="SystemMetadataGroup" targetId={group.groupId} />
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
  const [deleteActionState, setDeleteActionState] = useState<DeleteActionState>(null);
  const [pendingDeleteActionState, setPendingDeleteActionState] =
    useState<DeleteActionState>(null);
  const [submittingGroup, setSubmittingGroup] = useState(false);
  const [submittingItem, setSubmittingItem] = useState(false);
  const [reorderingItems, setReorderingItems] = useState(false);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [hoveredTreeItemId, setHoveredTreeItemId] = useState<string | null>(null);
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
  const openCreateGroupModal = useCallback(() => {
    setGroupEditorState({ mode: 'create', group: null });
  }, []);
  const openEditGroupModal = useCallback((group: SystemMetadataGroup) => {
    setGroupEditorState({ mode: 'edit', group });
  }, []);
  const openCreateItemModal = useCallback((groupId: string) => {
    setItemEditorState({ groupId, item: null });
  }, []);
  const openEditItemModal = useCallback((groupId: string, item: SystemMetadataItem) => {
    setItemEditorState({ groupId, item });
  }, []);
  const openDeleteItemConfirm = useCallback(
    (group: SystemMetadataGroup, item: SystemMetadataItem) => {
      setDeleteActionState({ group, item });
    },
    []
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
      if (controller.signal.aborted) return;
      if (result.ok) {
        const nextData = sortGroups(result.data);
        setMetadataState({
          status: nextData.length === 0 ? 'empty' : 'success',
          data: nextData,
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

    return () => controller.abort();
  }, [reloadKey]);

  const selectedGroup = useMemo(
    () =>
      selectedGroupId
        ? metadataState.data.find((group) => group.groupId === selectedGroupId) ?? null
        : null,
    [metadataState.data, selectedGroupId]
  );
  const itemEditorGroup = useMemo(
    () =>
      itemEditorState
        ? metadataState.data.find((group) => group.groupId === itemEditorState.groupId) ?? null
        : null,
    [itemEditorState, metadataState.data]
  );

  useEffect(() => {
    setDraggingItemId(null);
    setDragOverItemId(null);
    setHoveredTreeItemId(null);
  }, [selectedGroupId]);

  useEffect(() => {
    if (itemEditorState || !pendingDeleteActionState) {
      return;
    }

    setDeleteActionState(pendingDeleteActionState);
    setPendingDeleteActionState(null);
  }, [itemEditorState, pendingDeleteActionState]);

  const selectedGroupTreeData = useMemo<NonNullable<TreeProps['treeData']>>(() => {
    if (!selectedGroup) {
      return [];
    }

    return [
      {
        key: `group-${selectedGroup.groupId}`,
        title: <Text strong>{selectedGroup.groupName}</Text>,
        selectable: false,
        children: [
          ...selectedGroup.items.map((item) => ({
            key: item.itemId,
            title: (
              <MetadataTreeItemTitle
                item={item}
                hovered={hoveredTreeItemId === item.itemId}
                onHoverChange={(hovered) =>
                  setHoveredTreeItemId(hovered ? item.itemId : null)
                }
                onDelete={(targetItem, event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openDeleteItemConfirm(selectedGroup, targetItem);
                }}
              />
            ),
            isLeaf: true
          })),
          {
            key: `add-item-${selectedGroup.groupId}`,
            title: (
              <MetadataTreeAddTitle
                onClick={() => openCreateItemModal(selectedGroup.groupId)}
              />
            ),
            isLeaf: true,
            selectable: false
          }
        ]
      }
    ];
  }, [hoveredTreeItemId, openCreateItemModal, openDeleteItemConfirm, selectedGroup]);

  useEffect(() => {
    const canValidateSelection =
      metadataState.status === 'success' ||
      metadataState.status === 'empty' ||
      (metadataState.status === 'error' && metadataState.data.length > 0);

    if (!selectedGroupId || !canValidateSelection) return;
    if (!metadataState.data.some((group) => group.groupId === selectedGroupId)) {
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
      managerType: group?.managerType ?? 'codeTable',
      ownerModule: group?.ownerModule ?? 'System',
      ownerRole: group?.ownerRole ?? 'OPS_ADMIN',
      syncStatus: group?.syncStatus ?? 'draft',
      exposureStatus: group?.exposureStatus ?? 'internalOnly',
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
      status: item?.status ?? 'active',
      sortOrder: item?.sortOrder ?? (itemEditorGroup?.items.length ?? 0) + 1,
      isDefault: item?.isDefault ? 'yes' : 'no',
      exposureStatus: item?.exposureStatus ?? 'internalOnly'
    });
  }, [itemEditorGroup, itemEditorState, itemForm]);

  const filteredGroups = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return metadataState.data.filter((group) => {
      if (!matchesSummaryFilter(group, summaryFilter)) return false;
      if (!matchesSearchDateRange(group.updatedAt, startDate, endDate)) return false;
      if (!normalizedKeyword) return true;
      return matchesSearchField(normalizedKeyword, searchField, {
        groupId: group.groupId,
        groupName: group.groupName,
        feature: getFeatureSearchValues(group),
        userSurface: group.linkedUserSurfaces
      });
    });
  }, [endDate, keyword, metadataState.data, searchField, startDate, summaryFilter]);

  const openDrawer = useCallback((groupId: string) => {
    commitParams({ selected: groupId });
  }, [commitParams]);

  const closeDrawer = useCallback(() => {
    commitParams({ selected: null });
  }, [commitParams]);

  const handleApplyDateRange = useCallback(() => {
    commitParams({ startDate: draftStartDate || null, endDate: draftEndDate || null });
  }, [commitParams, draftEndDate, draftStartDate]);

  const handleSummaryFilter = useCallback((nextSummaryFilter: SummaryFilter) => {
    commitParams({ summaryFilter: nextSummaryFilter || null });
  }, [commitParams]);

  const handleSubmitGroup = useCallback(async () => {
    if (!groupEditorState) return;
    try {
      const values = await groupForm.validateFields();
      setSubmittingGroup(true);
      const reason =
        groupEditorState.mode === 'create'
          ? '운영 설정 신규 등록'
          : '운영 설정 정보 수정';
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
              ? '운영 설정 추가 실패'
              : '운영 설정 수정 실패',
          description: result.error.message
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
            ? '운영 설정 추가 완료'
            : '운영 설정 수정 완료',
        description: buildNotificationDescription(result.data, reason)
      });
    } finally {
      setSubmittingGroup(false);
    }
  }, [commitParams, currentAdminId, groupEditorState, groupForm, notificationApi]);

  const handleSubmitItem = useCallback(async () => {
    if (!itemEditorState) return;
    try {
      const values = await itemForm.validateFields();
      setSubmittingItem(true);
      const reason = itemEditorState.item
        ? '운영 값 정보 수정'
        : '운영 값 신규 추가';
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
          message: itemEditorState.item
            ? '운영 값 수정 실패'
            : '운영 값 추가 실패',
          description: result.error.message
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
        message: itemEditorState.item
          ? '운영 값 수정 완료'
          : '운영 값 추가 완료',
        description: buildNotificationDescription(result.data, reason)
      });
    } finally {
      setSubmittingItem(false);
    }
  }, [commitParams, currentAdminId, itemEditorState, itemForm, notificationApi]);

  const resetItemDragState = useCallback(() => {
    setDraggingItemId(null);
    setDragOverItemId(null);
  }, []);

  const handleItemReorder = useCallback(
    async (orderedItemIds: string[], reason: string) => {
      if (!selectedGroup) {
        resetItemDragState();
        return;
      }

      const currentOrder = selectedGroup.items.map((item) => item.itemId);
      if (currentOrder.join('|') === orderedItemIds.join('|')) {
        resetItemDragState();
        return;
      }

      setReorderingItems(true);
      const result = await reorderMetadataItemsSafe({
        groupId: selectedGroup.groupId,
        orderedItemIds,
        reason,
        changedBy: currentAdminId
      });
      setReorderingItems(false);
      resetItemDragState();

      if (!result.ok) {
        notificationApi.error({
          message: '운영 값 순서 변경 실패',
          description: result.error.message
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
        message: '운영 값 순서 변경 완료',
        description: buildNotificationDescription(result.data, reason)
      });
    },
    [currentAdminId, notificationApi, resetItemDragState, selectedGroup]
  );

  const handleItemDragStart = useCallback(
    (itemId: string, event: ReactDragEvent<HTMLButtonElement>) => {
      if (reorderingItems) {
        event.preventDefault();
        return;
      }

      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', itemId);
      setDraggingItemId(itemId);
      setDragOverItemId(itemId);
    },
    [reorderingItems]
  );

  const handleItemDrop = useCallback(
    async (targetItemId: string) => {
      if (!selectedGroup || !draggingItemId || draggingItemId === targetItemId) {
        resetItemDragState();
        return;
      }

      const currentOrder = selectedGroup.items.map((item) => item.itemId);
      const sourceIndex = currentOrder.indexOf(draggingItemId);
      const targetIndex = currentOrder.indexOf(targetItemId);

      if (sourceIndex < 0 || targetIndex < 0) {
        resetItemDragState();
        return;
      }

      const nextOrder = moveArrayItem(currentOrder, sourceIndex, targetIndex);
      await handleItemReorder(nextOrder, '운영 값 정렬 순서 조정');
    },
    [draggingItemId, handleItemReorder, resetItemDragState, selectedGroup]
  );

  const handleSettingTreeSelect = useCallback<NonNullable<TreeProps['onSelect']>>(
    (_, info) => {
      if (!selectedGroup) {
        return;
      }

      const nodeKey = String(info.node.key);
      if (nodeKey === `add-item-${selectedGroup.groupId}`) {
        openCreateItemModal(selectedGroup.groupId);
        return;
      }

      const targetItem =
        selectedGroup.items.find((item) => item.itemId === nodeKey) ?? null;
      if (targetItem) {
        openEditItemModal(selectedGroup.groupId, targetItem);
      }
    },
    [openCreateItemModal, openEditItemModal, selectedGroup]
  );

  const handleSettingTreeDrop = useCallback<NonNullable<TreeProps['onDrop']>>(
    (info) => {
      if (!selectedGroup) {
        return;
      }

      const dragKey = String(info.dragNode.key);
      const currentOrder = selectedGroup.items.map((item) => item.itemId);
      const sourceIndex = currentOrder.indexOf(dragKey);
      if (sourceIndex < 0) {
        return;
      }

      const dropKey = String(info.node.key);
      let targetIndex = currentOrder.length - 1;

      if (
        dropKey !== `group-${selectedGroup.groupId}` &&
        dropKey !== `add-item-${selectedGroup.groupId}`
      ) {
        const rawTargetIndex = currentOrder.indexOf(dropKey);
        if (rawTargetIndex < 0) {
          return;
        }

        const dropPath = String(info.node.pos).split('-');
        const relativeDropPosition =
          info.dropPosition - Number(dropPath[dropPath.length - 1]);
        targetIndex = rawTargetIndex;

        if (info.dropToGap && relativeDropPosition > 0) {
          targetIndex = rawTargetIndex + 1;
        }
      }

      const normalizedTargetIndex =
        targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
      const nextOrder = moveArrayItem(
        currentOrder,
        sourceIndex,
        Math.max(0, Math.min(normalizedTargetIndex, currentOrder.length - 1))
      );

      void handleItemReorder(nextOrder, '설정 구조 드래그 정렬');
    },
    [handleItemReorder, selectedGroup]
  );

  const handleDeleteItem = useCallback(
    async (reason: string) => {
      if (!deleteActionState) {
        return;
      }

      const result = await deleteMetadataItemSafe({
        groupId: deleteActionState.group.groupId,
        itemId: deleteActionState.item.itemId,
        reason,
        changedBy: currentAdminId
      });

      if (!result.ok) {
        notificationApi.error({
          message: '운영 값 삭제 실패',
          description: result.error.message
        });
        return;
      }

      setMetadataState((prev) => ({
        status: 'success',
        data: mergeUpdatedGroup(prev.data, result.data),
        errorMessage: null,
        errorCode: null
      }));
      if (itemEditorState?.item?.itemId === deleteActionState.item.itemId) {
        setItemEditorState(null);
      }
      setHoveredTreeItemId(null);
      setDeleteActionState(null);
      notificationApi.success({
        message: '운영 값 삭제 완료',
        description: buildNotificationDescription(result.data, reason)
      });
    },
    [currentAdminId, deleteActionState, itemEditorState?.item?.itemId, notificationApi]
  );

  const handleStatusAction = useCallback(async (reason: string) => {
    if (!statusActionState) return;
    const result =
      statusActionState.target === 'group'
        ? await toggleMetadataGroupStatusSafe({
            groupId: statusActionState.group.groupId,
            nextStatus: statusActionState.nextStatus,
            reason,
            changedBy: currentAdminId
          })
        : await toggleMetadataItemStatusSafe({
            groupId: statusActionState.group.groupId,
            itemId: statusActionState.item.itemId,
            nextStatus: statusActionState.nextStatus,
            reason,
            changedBy: currentAdminId
          });

    if (!result.ok) {
      notificationApi.error({
        message:
          statusActionState.target === 'group'
            ? '운영 설정 상태 변경 실패'
            : '운영 값 상태 변경 실패',
        description: result.error.message
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
        statusActionState.target === 'group'
          ? STATUS_LABELS[statusActionState.nextStatus] + ' 완료'
          : '운영 값 ' + STATUS_LABELS[statusActionState.nextStatus] + ' 완료',
      description: buildNotificationDescription(result.data, reason)
    });
    setStatusActionState(null);
  }, [currentAdminId, notificationApi, statusActionState]);

  const summaryItems = useMemo(
    () => [
      {
        key: 'all',
        label: '전체 설정',
        value: `${metadataState.data.length.toLocaleString()}개`,
        active: summaryFilter === '',
        onClick: () => handleSummaryFilter('')
      },
      {
        key: 'memberSettings',
        label: SUMMARY_FILTER_LABELS.memberSettings,
        value: `${metadataState.data
          .filter((group) => matchesSummaryFilter(group, 'memberSettings'))
          .length.toLocaleString()}개`,
        active: summaryFilter === 'memberSettings',
        onClick: () => handleSummaryFilter('memberSettings')
      },
      {
        key: 'messageSettings',
        label: SUMMARY_FILTER_LABELS.messageSettings,
        value: `${metadataState.data
          .filter((group) => matchesSummaryFilter(group, 'messageSettings'))
          .length.toLocaleString()}개`,
        active: summaryFilter === 'messageSettings',
        onClick: () => handleSummaryFilter('messageSettings')
      },
      {
        key: 'operationExposure',
        label: SUMMARY_FILTER_LABELS.operationExposure,
        value: `${metadataState.data
          .filter((group) => matchesSummaryFilter(group, 'operationExposure'))
          .length.toLocaleString()}개`,
        active: summaryFilter === 'operationExposure',
        onClick: () => handleSummaryFilter('operationExposure')
      },
      {
        key: 'commerceBenefits',
        label: SUMMARY_FILTER_LABELS.commerceBenefits,
        value: `${metadataState.data
          .filter((group) => matchesSummaryFilter(group, 'commerceBenefits'))
          .length.toLocaleString()}개`,
        active: summaryFilter === 'commerceBenefits',
        onClick: () => handleSummaryFilter('commerceBenefits')
      }
    ],
    [handleSummaryFilter, metadataState.data, summaryFilter]
  );

  const columns = useMemo<TableColumnsType<SystemMetadataGroup>>(
    () => [
      {
        title: '설정',
        key: 'setting',
        width: 240,
        sorter: createTextSorter((record) => record.groupName),
        render: (_, record) => <Text strong>{record.groupName}</Text>
      },
      {
        title: createHelpLabel(
          '소속 기능',
          '이 설정이 어떤 운영 업무 영역에서 쓰이는지 보여줍니다.'
        ),
        key: 'feature',
        width: 140,
        render: (_, record) => (
          <Tag color="blue">{SUMMARY_FILTER_LABELS[getSettingCategory(record)]}</Tag>
        )
      },
      {
        title: createHelpLabel(
          '운영 값',
          '현재 운영 중인 선택지와 상태 값의 요약입니다.'
        ),
        key: 'itemPreview',
        width: 220,
        render: (_, record) => <Text>{getItemPreviewText(record.items)}</Text>
      },
      {
        title: createHelpLabel(
          '사용자 영향',
          '확인됨은 실제 사용자 화면 연결이 검증된 상태이고, 운영상 추정은 연결 가능성은 있으나 문서나 화면 확인이 끝나지 않은 상태입니다.'
        ),
        key: 'impact',
        width: 220,
        render: (_, record) => (
          <Space direction="vertical" size={4}>
            <Tag color={getExposureStatusColor(record.exposureStatus)}>
              {EXPOSURE_LABELS[record.exposureStatus]}
            </Tag>
            <Text type="secondary">
              {record.linkedUserSurfaces.length > 0
                ? getPreviewText(record.linkedUserSurfaces)
                : '내부 운영에만 영향'}
            </Text>
          </Space>
        )
      },
      {
        title: createHelpLabel(
          '운영 상태',
          '활성 여부와 현재 검토 상태를 함께 보여줍니다.'
        ),
        key: 'statusSummary',
        width: 160,
        onCell: () => ({ onClick: (event) => event.stopPropagation() }),
        render: (_, record) => (
          <Space direction="vertical" size={4}>
            <BinaryStatusSwitch
              checked={record.status === 'active'}
              checkedLabel={TEXT.active}
              uncheckedLabel={TEXT.inactive}
              onToggle={() =>
                setStatusActionState({
                  target: 'group',
                  group: record,
                  nextStatus: record.status === 'active' ? 'inactive' : 'active'
                })
              }
            />
            <Tag color={getSyncStatusColor(record.syncStatus)}>{SYNC_LABELS[record.syncStatus]}</Tag>
          </Space>
        )
      },
      {
        title: '최근 수정',
        dataIndex: 'updatedAt',
        width: 180,
        sorter: createTextSorter((record) => record.updatedAt),
        render: (_, record) => (
          <Space direction="vertical" size={4}>
            <Text>{record.updatedAt}</Text>
            <Text type="secondary">{record.updatedBy}</Text>
          </Space>
        )
      },
      {
        title: '액션',
        key: 'action',
        width: 90,
        onCell: () => ({ onClick: (event) => event.stopPropagation() }),
        render: (_, record) => (
          <TableActionMenu
            items={[
              { key: `open-${record.groupId}`, label: '상세 보기', onClick: () => openDrawer(record.groupId) },
              { key: `edit-${record.groupId}`, label: TEXT.editGroup, onClick: () => openEditGroupModal(record) },
              { key: `item-${record.groupId}`, label: TEXT.createItem, onClick: () => openCreateItemModal(record.groupId) },
              {
                key: `toggle-${record.groupId}`,
                label: record.status === 'active' ? '설정 비활성화' : '설정 활성화',
                danger: record.status === 'active',
                onClick: () =>
                  setStatusActionState({
                    target: 'group',
                    group: record,
                    nextStatus: record.status === 'active' ? 'inactive' : 'active'
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
        title: '',
        key: 'drag',
        width: 48,
        onCell: () => ({ onClick: (event) => event.stopPropagation() }),
        render: (_, record) => (
          <MetadataItemDragHandle
            itemId={record.itemId}
            disabled={reorderingItems}
            onDragStart={handleItemDragStart}
            onDragEnd={resetItemDragState}
          />
        )
      },
      { title: '운영 값 코드', dataIndex: 'code', width: 140 },
      { title: '운영 값', dataIndex: 'label', width: 160 },
      {
        title: '상태',
        dataIndex: 'status',
        width: 100,
        render: (value: MetadataStatus) => (
          <Tag color={value === 'active' ? 'green' : 'default'}>{STATUS_LABELS[value]}</Tag>
        )
      },
      {
        title: '사용자 영향',
        dataIndex: 'exposureStatus',
        width: 120,
        render: (value: MetadataExposureStatus) => (
          <Tag color={getExposureStatusColor(value)}>{EXPOSURE_LABELS[value]}</Tag>
        )
      },
      { title: '정렬', dataIndex: 'sortOrder', width: 80 },
      {
        title: TEXT.defaultValue,
        dataIndex: 'isDefault',
        width: 100,
        render: (value: boolean) =>
          value ? <Tag color="blue">{TEXT.defaultValue}</Tag> : <Text type="secondary">-</Text>
      },
      { title: '최근 수정', dataIndex: 'updatedAt', width: 160 },
      {
        title: '액션',
        key: 'action',
        width: 90,
        onCell: () => ({ onClick: (event) => event.stopPropagation() }),
        render: (_, record) =>
          selectedGroup ? (
            <TableActionMenu
              items={[
                { key: `edit-item-${record.itemId}`, label: TEXT.editItem, onClick: () => openEditItemModal(selectedGroup.groupId, record) },
                {
                  key: `delete-item-${record.itemId}`,
                  label: '운영 값 삭제',
                  danger: true,
                  onClick: () => openDeleteItemConfirm(selectedGroup, record)
                },
                {
                  key: `toggle-item-${record.itemId}`,
                  label: record.status === 'active' ? '운영 값 비활성화' : '운영 값 활성화',
                  danger: record.status === 'active',
                  onClick: () =>
                    setStatusActionState({
                      target: 'item',
                      group: selectedGroup,
                      item: record,
                      nextStatus: record.status === 'active' ? 'inactive' : 'active'
                    })
                }
              ]}
            />
          ) : null
      }
    ],
    [
      handleItemDragStart,
      openDeleteItemConfirm,
      openEditItemModal,
      reorderingItems,
      resetItemDragState,
      selectedGroup
    ]
  );

  const historyColumns = useMemo<TableColumnsType<SystemMetadataHistoryEntry>>(
    () => [
      { title: '시각', dataIndex: 'createdAt', width: 170 },
      {
        title: '조치',
        dataIndex: 'action',
        width: 140,
        render: (value: MetadataHistoryAction) => HISTORY_ACTION_LABELS[value]
      },
      { title: '수정자', dataIndex: 'changedBy', width: 130 },
      { title: TEXT.reason, dataIndex: 'reason' }
    ],
    []
  );

  const drawerItemColumns = useMemo(
    () => fixDrawerTableFirstColumn(itemColumns),
    [itemColumns]
  );

  const drawerHistoryColumns = useMemo(
    () => fixDrawerTableFirstColumn(historyColumns),
    [historyColumns]
  );

  const groupFormDescriptionItems = useMemo<DescriptionsProps['items']>(
    () => [
      {
        key: 'groupName',
        label: '설정명',
        children: (
          <Form.Item
            name="groupName"
            rules={[{ required: true, message: '설정명을 입력해 주세요.' }]}
          >
            <Input />
          </Form.Item>
        )
      },
      {
        key: 'managerType',
        label: createHelpLabel(
          '관리 방식',
          '공통 상태값, 선택 옵션, 노출 규칙처럼 이 설정이 어떤 형태로 쓰이는지 정의합니다.'
        ),
        children: (
          <Form.Item
            name="managerType"
            rules={[{ required: true, message: '관리 방식을 선택해 주세요.' }]}
          >
            <Select options={MANAGER_TYPE_SELECT_OPTIONS} />
          </Form.Item>
        )
      },
      {
        key: 'ownerModule',
        label: '소속 기능',
        children: (
          <Form.Item
            name="ownerModule"
            rules={[{ required: true, message: '소속 기능을 선택해 주세요.' }]}
          >
            <Select options={OWNER_MODULE_SELECT_OPTIONS} />
          </Form.Item>
        )
      },
      {
        key: 'ownerRole',
        label: '관리 책임 역할',
        children: (
          <Form.Item
            name="ownerRole"
            rules={[{ required: true, message: '관리 책임 역할을 입력해 주세요.' }]}
          >
            <Input />
          </Form.Item>
        )
      },
      {
        key: 'syncStatus',
        label: createHelpLabel(
          '동기화 상태',
          '운영 중인지, 검토가 필요한지, 아직 초안인지 같은 관리 상태를 뜻합니다.'
        ),
        children: (
          <Form.Item
            name="syncStatus"
            rules={[{ required: true, message: '동기화 상태를 선택해 주세요.' }]}
          >
            <Select options={SYNC_STATUS_SELECT_OPTIONS} />
          </Form.Item>
        )
      },
      {
        key: 'exposureStatus',
        label: createHelpLabel(
          '사용자 영향',
          '이 설정이 실제 사용자 화면에 반영되는지, 아니면 내부 운영 데이터인지 구분합니다.'
        ),
        children: (
          <Form.Item
            name="exposureStatus"
            rules={[{ required: true, message: '사용자 영향 범위를 선택해 주세요.' }]}
          >
            <Select options={EXPOSURE_STATUS_SELECT_OPTIONS} />
          </Form.Item>
        )
      },
      {
        key: 'itemCodePrefix',
        label: createHelpLabel(
          '운영 값 코드 prefix',
          '운영 값 코드가 같은 규칙으로 생성되도록 묶는 접두사입니다.'
        ),
        span: 2,
        children: (
          <Form.Item
            name="itemCodePrefix"
            rules={[{ required: true, message: '운영 값 코드 prefix를 입력해 주세요.' }]}
          >
            <Input />
          </Form.Item>
        )
      },
      {
        key: 'description',
        label: '운영 목적',
        span: 2,
        children: (
          <Form.Item
            name="description"
            rules={[{ required: true, message: '운영 목적을 입력해 주세요.' }]}
          >
            <TextArea rows={3} />
          </Form.Item>
        )
      },
      {
        key: 'linkedAdminPagesText',
        label: createHelpLabel(
          '연결 route',
          '이 설정을 참조하는 관리자 route를 참고용으로 등록합니다.'
        ),
        span: 2,
        children: (
          <Form.Item
            name="linkedAdminPagesText"
            rules={[{ required: true, message: '연결 route를 1개 이상 입력해 주세요.' }]}
          >
            <TextArea rows={3} />
          </Form.Item>
        )
      },
      {
        key: 'linkedUserSurfacesText',
        label: '사용자 화면',
        span: 2,
        children: (
          <Form.Item name="linkedUserSurfacesText">
            <TextArea rows={3} />
          </Form.Item>
        )
      },
      {
        key: 'schemaCandidateNotesText',
        label: createHelpLabel(
          '연동/검토 메모',
          'API 연동, 코드 테이블 규격, 검토 사인오프처럼 운영자가 참고해야 하는 메모입니다.'
        ),
        span: 2,
        children: (
          <Form.Item name="schemaCandidateNotesText">
            <TextArea rows={3} />
          </Form.Item>
        )
      }
    ],
    []
  );

  const itemFormDescriptionItems = useMemo<DescriptionsProps['items']>(
    () => [
      {
        key: 'code',
        label: createHelpLabel(
          '운영 값 코드',
          '로그와 API에서 데이터를 찾을 때 쓰는 식별자입니다. 같은 prefix 규칙을 유지해 주세요.'
        ),
        children: (
          <Form.Item
            name="code"
            rules={[
              { required: true, message: '운영 값 코드를 입력해 주세요.' },
              {
                validator: async (_, value: string | undefined) => {
                  const normalizedValue = normalizeDuplicateValue(value ?? '').toUpperCase();
                  if (!normalizedValue || !itemEditorGroup) {
                    return;
                  }

                  const duplicatedItem = itemEditorGroup.items.find(
                    (item) =>
                      item.itemId !== itemEditorState?.item?.itemId &&
                      item.code.trim().toUpperCase() === normalizedValue
                  );

                  if (duplicatedItem) {
                    throw new Error('같은 운영 값 코드가 이미 존재합니다.');
                  }
                }
              }
            ]}
          >
            <Input />
          </Form.Item>
        )
      },
      {
        key: 'label',
        label: '운영 값 라벨',
        children: (
          <Form.Item
            name="label"
            rules={[
              { required: true, message: '운영 값 라벨을 입력해 주세요.' },
              {
                validator: async (_, value: string | undefined) => {
                  const normalizedValue = normalizeDuplicateValue(value ?? '');
                  if (!normalizedValue || !itemEditorGroup) {
                    return;
                  }

                  const duplicatedItem = itemEditorGroup.items.find(
                    (item) =>
                      item.itemId !== itemEditorState?.item?.itemId &&
                      normalizeDuplicateValue(item.label) === normalizedValue
                  );

                  if (duplicatedItem) {
                    throw new Error('같은 운영 값 라벨이 이미 존재합니다.');
                  }
                }
              }
            ]}
          >
            <Input />
          </Form.Item>
        )
      },
      {
        key: 'status',
        label: '상태',
        children: (
          <Form.Item
            name="status"
            rules={[{ required: true, message: '상태를 선택해 주세요.' }]}
          >
            <Select options={STATUS_SELECT_OPTIONS} />
          </Form.Item>
        )
      },
      {
        key: 'sortOrder',
        label: '정렬 순서',
        children: (
          <Form.Item
            name="sortOrder"
            rules={[{ required: true, message: '정렬 순서를 입력해 주세요.' }]}
          >
            <Input type="number" min={1} />
          </Form.Item>
        )
      },
      {
        key: 'isDefault',
        label: createHelpLabel(
          TEXT.defaultValue,
          '운영자가 별도 선택을 하지 않았을 때 기본으로 적용될 값을 뜻합니다.'
        ),
        children: (
          <Form.Item
            name="isDefault"
            rules={[{ required: true, message: '기본값 여부를 선택해 주세요.' }]}
          >
            <Select options={DEFAULT_VALUE_SELECT_OPTIONS} />
          </Form.Item>
        )
      },
      {
        key: 'exposureStatus',
        label: createHelpLabel(
          '사용자 영향',
          '운영 값이 사용자 화면까지 연결되는 값인지, 내부 운영 전용인지 표시합니다.'
        ),
        children: (
          <Form.Item
            name="exposureStatus"
            rules={[{ required: true, message: '사용자 영향 범위를 선택해 주세요.' }]}
          >
            <Select options={EXPOSURE_STATUS_SELECT_OPTIONS} />
          </Form.Item>
        )
      },
      {
        key: 'description',
        label: '값 설명',
        span: 2,
        children: (
          <Form.Item
            name="description"
            rules={[{ required: true, message: '값 설명을 입력해 주세요.' }]}
          >
            <TextArea rows={4} />
          </Form.Item>
        )
      }
    ],
    [itemEditorGroup, itemEditorState?.item?.itemId]
  );

  const hasCachedGroups = metadataState.data.length > 0;
  const isFilteredEmpty =
    metadataState.status !== 'empty' && metadataState.data.length > 0 && filteredGroups.length === 0;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title={TEXT.pageTitle} />
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
        message="쿠폰 적용 범위, 회원 상태, FAQ 노출 위치처럼 운영자가 직접 바꾸는 설정을 기능 기준으로 모아 보는 페이지입니다."
        description={
          <Space direction="vertical" size={4}>
            <Text>1. 상단 요약 카드에서 먼저 관리하려는 기능 영역을 좁힙니다.</Text>
            <Text>2. 목록에서 설정명을 눌러 어디에 쓰이는 값인지와 사용자 영향을 확인합니다.</Text>
            <Text>3. 필요한 운영 값만 추가하거나 수정하고, 감사 로그에서 변경 이력을 검증합니다.</Text>
          </Space>
        }
      />
      <ListSummaryCards items={summaryItems} />
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        카드는 기능 영역을 빠르게 좁히는 용도이고, 실제 수정 여부 판단은 상세 Drawer의
        `기본 정보`, `설정 구조`, `지금 운영 중인 값`을 기준으로 진행하는 것을 기본으로 합니다.
      </Paragraph>

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '설정 ID', value: 'groupId' },
              { label: '설정명', value: 'groupName' },
              { label: '소속 기능', value: 'feature' },
              { label: '사용자 화면', value: 'userSurface' }
            ]}
            keyword={keyword}
            onSearchFieldChange={(value) => commitParams({ searchField: value })}
            onKeywordChange={(event) => commitParams({ keyword: event.target.value, searchField })}
            keywordPlaceholder="설정명, 소속 기능, 사용자 화면으로 검색"
            detailTitle="상세 검색"
            detailContent={<SearchBarDetailField label={createHelpLabel('최근 수정', '최근 수정 범위로 설정 목록을 좁혀 볼 수 있습니다.') }><SearchBarDateRange startDate={draftStartDate} endDate={draftEndDate} onChange={handleDraftDateChange} /></SearchBarDetailField>}
            onApply={handleApplyDateRange}
            onDetailOpenChange={handleDetailOpenChange}
            onReset={handleDraftReset}
            summary={<Text type="secondary">{TEXT.toolbarSummary} {filteredGroups.length.toLocaleString()}개 설정</Text>}
            actions={
              <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                data-testid="create-group-button"
                onClick={openCreateGroupModal}
              >
                {TEXT.createGroup}
              </Button>
            }
          />
        }
      >
        {metadataState.status === 'error' ? <Alert type="error" showIcon style={{ marginBottom: 12 }} message="운영 설정 목록을 불러오지 못했습니다." description={metadataState.errorMessage ?? ''} action={<Button size="small" onClick={() => setReloadKey((prev) => prev + 1)}>다시 시도</Button>} /> : null}
        {metadataState.status === 'pending' && hasCachedGroups ? <Alert type="info" showIcon style={{ marginBottom: 12 }} message="최신 운영 설정을 다시 불러오는 중입니다." /> : null}
        {metadataState.status === 'empty' ? <Alert type="info" showIcon style={{ marginBottom: 12 }} message="등록된 운영 설정이 없습니다." /> : null}
        {isFilteredEmpty ? <Alert type="info" showIcon style={{ marginBottom: 12 }} message="현재 검색 조건과 일치하는 운영 설정이 없습니다." /> : null}

        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          설정명을 눌러 상세를 열면 사용처, 현재 운영 값, 변경 영향, 감사 로그 확인 경로를 한 화면에서 볼 수 있습니다.
        </Paragraph>

        <AdminDataTable<SystemMetadataGroup> rowKey="groupId" pagination={false} scroll={{ x: 1480 }} loading={metadataState.status === 'pending' && !hasCachedGroups} columns={columns} dataSource={filteredGroups} onRow={(record) => ({ onClick: () => openDrawer(record.groupId), style: { cursor: 'pointer' } })} />
      </AdminListCard>

      <DetailDrawer
        open={Boolean(selectedGroup)}
        title={
          selectedGroup
            ? `${TEXT.drawerTitle}: ${selectedGroup.groupName}`
            : TEXT.drawerTitle
        }
        headerMeta={
          selectedGroup ? <Text type="secondary">{selectedGroup.groupId}</Text> : null
        }
        width={DETAIL_DRAWER_WIDTH.default}
        onClose={closeDrawer}
        footerStart={
          selectedGroup ? (
            <AuditLogLink
              targetType="SystemMetadataGroup"
              targetId={selectedGroup.groupId}
            />
          ) : null
        }
        footerEnd={
          selectedGroup ? (
            <Space>
              <Button
                size="large"
                data-testid="create-item-button"
                onClick={() => openCreateItemModal(selectedGroup.groupId)}
              >
                {TEXT.createItem}
              </Button>
              <Button size="large" icon={<EditOutlined />} onClick={() => openEditGroupModal(selectedGroup)}>
                {TEXT.editGroup}
              </Button>
              <Button
                size="large"
                danger={selectedGroup.status === 'active'}
                type={selectedGroup.status === 'active' ? 'primary' : 'default'}
                onClick={() =>
                  setStatusActionState({
                    target: 'group',
                    group: selectedGroup,
                    nextStatus:
                      selectedGroup.status === 'active' ? 'inactive' : 'active'
                  })
                }
              >
                {selectedGroup.status === 'active'
                  ? '설정 비활성화'
                  : '설정 활성화'}
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedGroup ? (
          <DetailDrawerBody>
            <Alert
              type="info"
              showIcon
              message={`${MODULE_LABELS[selectedGroup.ownerModule]} 기능에서 쓰는 ${selectedGroup.groupName} 설정입니다.`}
              description={buildDrawerGuideDescription(selectedGroup)}
            />
            <DetailDrawerSection
              title={createHelpLabel(
                '기본 정보',
                '이 설정이 어떤 기능에서 쓰이고 누구에게 영향을 주는지 먼저 확인하는 영역입니다.'
              )}
            >
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                화면에서 바로 값을 바꾸기 전에, 어떤 기능의 기준값인지와 사용자 화면에 영향이 있는지부터
                확인한 뒤 아래 운영 값을 조정해 주세요.
              </Paragraph>
              <Descriptions
                bordered
                column={1}
                items={[
                  {
                    key: 'groupName',
                    label: '설정명',
                    children: (
                      <Space direction="vertical" size={2}>
                        <Text strong>{selectedGroup.groupName}</Text>
                        <Text type="secondary">{selectedGroup.groupId}</Text>
                      </Space>
                    )
                  },
                  {
                    key: 'feature',
                    label: '소속 기능',
                    children: (
                      <Space wrap size={[8, 8]}>
                        <Tag color="blue">
                          {SUMMARY_FILTER_LABELS[getSettingCategory(selectedGroup)]}
                        </Tag>
                        <Text>{MODULE_LABELS[selectedGroup.ownerModule]}</Text>
                        <Text type="secondary">
                          {MANAGER_TYPE_LABELS[selectedGroup.managerType]}
                        </Text>
                      </Space>
                    )
                  },
                  {
                    key: 'status',
                    label: '운영 상태',
                    children: (
                      <Space wrap size={[8, 8]}>
                        <Tag color={selectedGroup.status === 'active' ? 'green' : 'default'}>
                          {STATUS_LABELS[selectedGroup.status]}
                        </Tag>
                        <Tag color={getSyncStatusColor(selectedGroup.syncStatus)}>
                          {SYNC_LABELS[selectedGroup.syncStatus]}
                        </Tag>
                        <Tag color={getExposureStatusColor(selectedGroup.exposureStatus)}>
                          {EXPOSURE_LABELS[selectedGroup.exposureStatus]}
                        </Tag>
                      </Space>
                    )
                  },
                  {
                    key: 'userSurface',
                    label: '사용자 화면',
                    children:
                      selectedGroup.linkedUserSurfaces.length > 0 ? (
                        renderValueList(selectedGroup.linkedUserSurfaces)
                      ) : (
                        <Text type="secondary">내부 운영에만 영향</Text>
                      )
                  },
                  {
                    key: 'description',
                    label: '운영 목적',
                    children: selectedGroup.description
                  }
                ]}
              />
            </DetailDrawerSection>
            <DetailDrawerSection
              title={createHelpLabel(
                '설정 구조',
                '설정 그룹 아래에 어떤 운영 값이 연결되는지 트리 구조로 보여줍니다.'
              )}
            >
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                설정 구조는 상위 설정 아래에 실제 운영 값이 매달리는 방식으로 구성됩니다. 각 계층의 마지막 `추가`
                노드로 같은 레벨의 값을 만들 수 있고, 기존 값은 드래그로 순서를 바꾸거나 눌러서 바로 수정할 수 있습니다.
              </Paragraph>
              <Tree
                defaultExpandAll
                showLine={{ showLeafIcon: false }}
                switcherIcon={({ expanded, isLeaf }) =>
                  isLeaf ? null : expanded ? <MinusSquareOutlined /> : <PlusSquareOutlined />
                }
                draggable={{
                  icon: false,
                  nodeDraggable: (node) =>
                    typeof node.key === 'string' &&
                    !node.key.startsWith('group-') &&
                    !node.key.startsWith('add-item-')
                }}
                onSelect={handleSettingTreeSelect}
                onDrop={handleSettingTreeDrop}
                treeData={selectedGroupTreeData}
              />
            </DetailDrawerSection>
            <DetailDrawerSection
              title={createHelpLabel(
                '지금 운영 중인 값',
                '실제 선택지 목록입니다. 드래그로 순서를 바꾸고 우측 액션으로 수정 또는 상태 변경을 진행합니다.'
              )}
            >
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                왼쪽 핸들을 드래그하면 정렬 순서가 즉시 바뀝니다. 라벨은 운영자가 이해하기 쉽게,
                코드는 로그와 API 추적에 맞게 유지해 주세요.
              </Paragraph>
              <AdminDataTable<SystemMetadataItem>
                rowKey="itemId"
                pagination={false}
                scroll={createDrawerTableScroll()}
                columns={drawerItemColumns}
                dataSource={selectedGroup.items}
                loading={reorderingItems}
                onRow={(record) => ({
                  onDragOver: (event) => {
                    if (
                      reorderingItems ||
                      !draggingItemId ||
                      draggingItemId === record.itemId
                    ) {
                      return;
                    }

                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    if (dragOverItemId !== record.itemId) {
                      setDragOverItemId(record.itemId);
                    }
                  },
                  onDrop: (event) => {
                    event.preventDefault();
                    void handleItemDrop(record.itemId);
                  },
                  style:
                    draggingItemId === record.itemId
                      ? {
                          opacity: 0.45
                        }
                      : dragOverItemId === record.itemId
                        ? {
                            backgroundColor: 'rgba(22, 119, 255, 0.08)',
                            boxShadow: 'inset 0 2px 0 #1677ff'
                          }
                        : undefined
                })}
              />
            </DetailDrawerSection>
            <DetailDrawerSection
              title={createHelpLabel(
                '고급 정보',
                '연동 체계와 책임 역할처럼 일반 운영자보다 시스템 관리자에게 더 중요한 정보입니다.'
              )}
            >
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                문제 추적이나 개발 작업이 필요할 때 참고하는 정보입니다. 일반 운영 업무에서는 위 섹션 확인만으로도
                충분한 경우가 많습니다.
              </Paragraph>
              <Descriptions
                bordered
                column={1}
                items={[
                  {
                    key: 'groupId',
                    label: '설정 ID',
                    children: selectedGroup.groupId
                  },
                  {
                    key: 'ownerRole',
                    label: '관리 책임 역할',
                    children: selectedGroup.ownerRole
                  },
                  {
                    key: 'defaultItems',
                    label: '기본값',
                    children: renderValueList(getDefaultItemLabels(selectedGroup.items))
                  },
                  {
                    key: 'itemCodePrefix',
                    label: '운영 값 코드 prefix',
                    children: selectedGroup.itemCodePrefix
                  },
                  {
                    key: 'updatedAt',
                    label: '최근 수정',
                    children: (
                      <Space direction="vertical" size={2}>
                        <Text>{selectedGroup.updatedAt}</Text>
                        <Text type="secondary">{selectedGroup.updatedBy}</Text>
                      </Space>
                    )
                  },
                  {
                    key: 'lastReviewedAt',
                    label: '마지막 검토',
                    children: selectedGroup.lastReviewedAt
                  },
                  {
                    key: 'notes',
                    label: '변경 전 참고 메모',
                    children: renderValueList(selectedGroup.schemaCandidateNotes)
                  }
                ]}
              />
            </DetailDrawerSection>
            <DetailDrawerSection
              title={createHelpLabel(
                '변경 이력',
                '누가 어떤 설정을 바꿨는지 확인하는 기록입니다.'
              )}
            >
              <Paragraph type="secondary" style={{ marginBottom: 12 }}>
                최근 조치 사유와 수행자를 확인하면서 현재 값이 왜 유지되고 있는지 판단할 수 있습니다.
              </Paragraph>
              <AdminDataTable<SystemMetadataHistoryEntry>
                rowKey="historyId"
                pagination={DRAWER_TABLE_PAGINATION_WITH_HIDE}
                scroll={createDrawerTableScroll()}
                columns={drawerHistoryColumns}
                dataSource={selectedGroup.history}
              />
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>

      <Modal
        open={Boolean(groupEditorState)}
        title={groupEditorState?.mode === 'edit' ? TEXT.editGroup : TEXT.createGroup}
        okText={groupEditorState?.mode === 'edit' ? '수정' : '추가'}
        cancelText="취소"
        confirmLoading={submittingGroup}
        zIndex={1400}
        width={760}
        forceRender
        okButtonProps={{ 'data-testid': 'group-submit-button' }}
        onCancel={() => setGroupEditorState(null)}
        onOk={() => void handleSubmitGroup()}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="여러 화면과 기능에서 공통으로 재사용하는 운영 설정을 만들거나 정리할 때 사용합니다."
          description="개별 화면 전용 문구나 임시 UI 값이 아니라, 여러 화면에서 공통으로 쓰는 선택지·상태값·노출 규칙만 등록하는 것을 기본으로 합니다. 연결 route는 참고용 정보이고, 실제 운영 조작은 상세 Drawer의 `설정 구조`와 `지금 운영 중인 값`에서 확인합니다."
        />
        <Form<GroupFormValues> form={groupForm}>
          <AdminFormDescriptions
            bordered
            size="small"
            column={2}
            items={groupFormDescriptionItems}
            requiredKeys={[
              'groupName',
              'managerType',
              'ownerModule',
              'ownerRole',
              'syncStatus',
              'exposureStatus',
              'itemCodePrefix',
              'description',
              'linkedAdminPagesText'
            ]}
          />
        </Form>
      </Modal>

      {deleteActionState ? (
        <ConfirmAction
          open
          title="운영 값 삭제"
          description={`${deleteActionState.item.label} 값을 삭제하는 운영 사유를 입력해 주세요.`}
          targetType="SystemMetadataGroup"
          targetId={deleteActionState.group.groupId}
          confirmText="삭제 실행"
          onCancel={() => setDeleteActionState(null)}
          onConfirm={handleDeleteItem}
        />
      ) : null}

      <Modal
        open={Boolean(itemEditorState)}
        title={itemEditorState?.item ? TEXT.editItem : TEXT.createItem}
        okText={itemEditorState?.item ? '수정' : '추가'}
        cancelText="취소"
        confirmLoading={submittingItem}
        zIndex={1400}
        width={760}
        forceRender
        onCancel={() => setItemEditorState(null)}
        onOk={() => void handleSubmitItem()}
        footer={
          itemEditorState?.item ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12
              }}
            >
              <Button
                danger
                data-testid="metadata-item-delete-button"
                onClick={() => {
                  if (!selectedGroup || !itemEditorState.item) {
                    return;
                  }
                  setPendingDeleteActionState({
                    group: selectedGroup,
                    item: itemEditorState.item
                  });
                  setItemEditorState(null);
                }}
              >
                운영 값 삭제
              </Button>
              <Space>
                <Button onClick={() => setItemEditorState(null)}>취소</Button>
                <Button
                  type="primary"
                  data-testid="item-submit-button"
                  loading={submittingItem}
                  onClick={() => void handleSubmitItem()}
                >
                  수정
                </Button>
              </Space>
            </div>
          ) : (
            <Space>
              <Button onClick={() => setItemEditorState(null)}>취소</Button>
              <Button
                type="primary"
                data-testid="item-submit-button"
                loading={submittingItem}
                onClick={() => void handleSubmitItem()}
              >
                추가
              </Button>
            </Space>
          )
        }
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="운영 값은 실제 선택지, 상태값, 노출 값 항목입니다."
          description="라벨은 운영자가 이해하기 쉽게 작성하고, 코드는 감사 로그와 API 추적을 위한 식별자이므로 prefix 규칙을 유지해 주세요. 현재 mock 데이터 기준으로 같은 설정 그룹 안에서는 코드와 라벨 중복을 허용하지 않습니다."
        />
        <Form<ItemFormValues> form={itemForm}>
          <AdminFormDescriptions
            bordered
            size="small"
            column={2}
            items={itemFormDescriptionItems}
            requiredKeys={[
              'code',
              'label',
              'status',
              'sortOrder',
              'isDefault',
              'exposureStatus',
              'description'
            ]}
          />
        </Form>
      </Modal>

      {statusActionState ? (
        <ConfirmAction
          open
          title={
            statusActionState.target === 'group'
              ? statusActionState.nextStatus === 'inactive'
                ? '운영 설정 비활성화'
                : '운영 설정 활성화'
              : statusActionState.nextStatus === 'inactive'
                ? '운영 값 비활성화'
                : '운영 값 활성화'
          }
          description={
            statusActionState.target === 'group'
              ? '운영 설정을 변경하는 사유를 입력해 주세요.'
              : `${statusActionState.item.label} 값을 변경하는 운영 사유를 입력해 주세요.`
          }
          targetType="SystemMetadataGroup"
          targetId={statusActionState.group.groupId}
          confirmText={statusActionState.nextStatus === 'inactive' ? '비활성화 실행' : '활성화 실행'}
          onCancel={() => setStatusActionState(null)}
          onConfirm={handleStatusAction}
        />
      ) : null}
    </div>
  );
}




