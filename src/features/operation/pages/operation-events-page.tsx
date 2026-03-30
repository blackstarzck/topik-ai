import {
  Alert,
  Button,
  Descriptions,
  Space,
  Tag,
  Typography,
  notification
} from 'antd';
import type { SortOrder, TableColumnsType, TableProps } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import {
  endEventSafe,
  fetchEventsSafe,
  publishEventSafe,
  scheduleEventPublishSafe
} from '../api/events-service';
import {
  operationEventTypeValues,
  operationEventVisibilityStatusValues,
  type OperationEvent
} from '../model/types';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '../../../shared/ui/detail-drawer/detail-drawer';
import { HtmlPreviewModal } from '../../../shared/ui/html-preview-modal/html-preview-modal';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '../../../shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '../../../shared/ui/search-bar/use-search-bar-date-draft';
import {
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

const sortableFieldValues = [
  'id',
  'title',
  'eventType',
  'startAt',
  'visibilityStatus',
  'updatedAt'
] as const;

type EventSortField = (typeof sortableFieldValues)[number];

type EventActionState =
  | { type: 'schedule'; event: OperationEvent }
  | { type: 'publish'; event: OperationEvent }
  | { type: 'end'; event: OperationEvent }
  | null;

function parseEventType(value: string | null): OperationEvent['eventType'] | null {
  return operationEventTypeValues.includes(value as OperationEvent['eventType'])
    ? (value as OperationEvent['eventType'])
    : null;
}

function parseVisibilityStatus(
  value: string | null
): OperationEvent['visibilityStatus'] | null {
  return operationEventVisibilityStatusValues.includes(
    value as OperationEvent['visibilityStatus']
  )
    ? (value as OperationEvent['visibilityStatus'])
    : null;
}

function parseSortField(value: string | null): EventSortField | null {
  return sortableFieldValues.includes(value as EventSortField)
    ? (value as EventSortField)
    : null;
}

function parseSortOrder(value: string | null): SortOrder | null {
  return value === 'ascend' || value === 'descend' ? value : null;
}

function matchesEventPeriod(
  event: OperationEvent,
  startDate: string,
  endDate: string
): boolean {
  if (startDate && event.endAt < startDate) {
    return false;
  }

  if (endDate && event.startAt > endDate) {
    return false;
  }

  return true;
}

function getActionCopy(type: NonNullable<EventActionState>['type']) {
  if (type === 'schedule') {
    return {
      title: '이벤트 게시 예약',
      description: '이벤트 노출을 예약 상태로 변경합니다. 예약 사유를 입력하세요.',
      confirmText: '게시 예약 실행',
      successMessage: '이벤트 게시 예약 완료'
    };
  }

  if (type === 'publish') {
    return {
      title: '이벤트 즉시 게시',
      description: '이벤트를 즉시 노출 상태로 전환합니다. 게시 사유를 입력하세요.',
      confirmText: '즉시 게시 실행',
      successMessage: '이벤트 즉시 게시 완료'
    };
  }

  return {
    title: '이벤트 종료',
    description: '이벤트를 종료하고 노출을 중단합니다. 종료 사유를 입력하세요.',
    confirmText: '이벤트 종료 실행',
    successMessage: '이벤트 종료 완료'
  };
}

export default function OperationEventsPage(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchField = searchParams.get('searchField') ?? 'all';
  const keyword = searchParams.get('keyword') ?? '';
  const startDate = parseSearchDate(searchParams.get('startDate'));
  const endDate = parseSearchDate(searchParams.get('endDate'));
  const eventTypeFilter = parseEventType(searchParams.get('eventType'));
  const visibilityStatusFilter = parseVisibilityStatus(
    searchParams.get('visibilityStatus')
  );
  const sortField = parseSortField(searchParams.get('sortField'));
  const sortOrder = parseSortOrder(searchParams.get('sortOrder'));
  const selectedEventId = searchParams.get('selected') ?? '';
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

  const [eventsState, setEventsState] = useState<AsyncState<OperationEvent[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [actionState, setActionState] = useState<EventActionState>(null);
  const [previewEvent, setPreviewEvent] = useState<OperationEvent | null>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const handledSavedStateRef = useRef<string | null>(null);

  const listSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('selected');
    const search = nextSearchParams.toString();
    return search ? `?${search}` : '';
  }, [searchParams]);

  const commitParams = useCallback(
    (next: Record<string, string | null>) => {
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

    setEventsState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchEventsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setEventsState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setEventsState((prev) => ({
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

  useEffect(() => {
    const state = location.state as
      | {
          operationEventSaved?: {
            eventId: string;
            mode: 'create' | 'edit';
            action: 'save' | 'schedule';
          };
        }
      | null;

    if (!state?.operationEventSaved) {
      return;
    }

    const savedStateKey = [
      state.operationEventSaved.eventId,
      state.operationEventSaved.mode,
      state.operationEventSaved.action
    ].join(':');

    if (handledSavedStateRef.current === savedStateKey) {
      return;
    }

    handledSavedStateRef.current = savedStateKey;

    notificationApi.success({
      message:
        state.operationEventSaved.action === 'schedule'
          ? '이벤트 게시 예약 완료'
          : state.operationEventSaved.mode === 'create'
            ? '이벤트 임시 저장 완료'
            : '이벤트 수정 완료',
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('Operation')}</Text>
          <Text>대상 ID: {state.operationEventSaved.eventId}</Text>
          <Text>
            조치:{' '}
            {state.operationEventSaved.action === 'schedule'
              ? '등록 상세에서 게시 예약 실행'
              : state.operationEventSaved.mode === 'create'
                ? '이벤트 신규 임시 저장'
                : '이벤트 정보 수정'}
          </Text>
          <AuditLogLink
            targetType="Operation"
            targetId={state.operationEventSaved.eventId}
          />
        </Space>
      )
    });
  }, [location.state, notificationApi]);

  const filteredEvents = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return eventsState.data.filter((event) => {
      if (eventTypeFilter && event.eventType !== eventTypeFilter) {
        return false;
      }

      if (
        visibilityStatusFilter &&
        event.visibilityStatus !== visibilityStatusFilter
      ) {
        return false;
      }

      if (!matchesEventPeriod(event, startDate, endDate)) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return matchesSearchField(normalizedKeyword, searchField, {
        id: event.id,
        title: event.title,
        summary: event.summary
      });
    });
  }, [
    endDate,
    eventTypeFilter,
    eventsState.data,
    keyword,
    searchField,
    startDate,
    visibilityStatusFilter
  ]);

  const visibilitySummary = useMemo(
    () => ({
      visibleCount: eventsState.data.filter(
        (event) => event.visibilityStatus === '노출'
      ).length,
      scheduledCount: eventsState.data.filter(
        (event) => event.visibilityStatus === '예약'
      ).length,
      hiddenCount: eventsState.data.filter(
        (event) => event.visibilityStatus === '숨김'
      ).length
    }),
    [eventsState.data]
  );
  const eventSummaryCards = useMemo(
    () => [
      {
        key: 'visible-events',
        label: '노출 이벤트',
        value: `${visibilitySummary.visibleCount.toLocaleString()}건`
      },
      {
        key: 'scheduled-events',
        label: '예약 이벤트',
        value: `${visibilitySummary.scheduledCount.toLocaleString()}건`
      },
      {
        key: 'hidden-events',
        label: '숨김 이벤트',
        value: `${visibilitySummary.hiddenCount.toLocaleString()}건`
      }
    ],
    [visibilitySummary.hiddenCount, visibilitySummary.scheduledCount, visibilitySummary.visibleCount]
  );

  const selectedEvent = useMemo(
    () =>
      selectedEventId
        ? eventsState.data.find((event) => event.id === selectedEventId) ?? null
        : null,
    [eventsState.data, selectedEventId]
  );

  useEffect(() => {
    const canValidateSelected =
      eventsState.status === 'success' ||
      eventsState.status === 'empty' ||
      (eventsState.status === 'error' && eventsState.data.length > 0);

    if (!selectedEventId || !canValidateSelected || selectedEvent) {
      return;
    }

    commitParams({ selected: null });
  }, [commitParams, eventsState.data.length, eventsState.status, selectedEvent, selectedEventId]);

  const hasCachedEvents = eventsState.data.length > 0;
  const isFilteredEmpty =
    eventsState.status !== 'empty' &&
    eventsState.data.length > 0 &&
    filteredEvents.length === 0;
  const totalCount = filteredEvents.length;

  const openCreateDetail = useCallback(() => {
    navigate({
      pathname: '/operation/events/create',
      search: listSearch
    });
  }, [listSearch, navigate]);

  const openEditDetail = useCallback(
    (event: OperationEvent) => {
      navigate({
        pathname: `/operation/events/create/${event.id}`,
        search: listSearch
      });
    },
    [listSearch, navigate]
  );

  const openPreviewModal = useCallback((event: OperationEvent) => {
    setPreviewEvent(event);
  }, []);
  const closePreviewModal = useCallback(() => {
    setPreviewEvent(null);
  }, []);

  const handleReload = useCallback(() => setReloadKey((prev) => prev + 1), []);
  const openDetail = useCallback(
    (eventId: string) => commitParams({ selected: eventId }),
    [commitParams]
  );
  const closeDetail = useCallback(
    () => commitParams({ selected: null }),
    [commitParams]
  );
  const handlePreviewEdit = useCallback(() => {
    if (!previewEvent) {
      return;
    }

    setPreviewEvent(null);
    openEditDetail(previewEvent);
  }, [openEditDetail, previewEvent]);

  const handleActionConfirm = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const result =
        actionState.type === 'schedule'
          ? await scheduleEventPublishSafe({ eventId: actionState.event.id })
          : actionState.type === 'publish'
            ? await publishEventSafe({ eventId: actionState.event.id })
            : await endEventSafe({ eventId: actionState.event.id });

      if (!result.ok) {
        notificationApi.error({
          message: `${getActionCopy(actionState.type).title} 실패`,
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">오류 코드: {result.error.code}</Text>
            </Space>
          )
        });
        return;
      }

      setEventsState((prev) => ({
        status: prev.data.length === 0 ? 'empty' : 'success',
        data: prev.data.map((event) => (event.id === result.data.id ? result.data : event)),
        errorMessage: null,
        errorCode: null
      }));

      notificationApi.success({
        message: getActionCopy(actionState.type).successMessage,
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('Operation')}</Text>
            <Text>대상 ID: {result.data.id}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="Operation" targetId={result.data.id} />
          </Space>
        )
      });

      setActionState(null);
    },
    [actionState, notificationApi]
  );

  const handleTableChange = useCallback<NonNullable<TableProps<OperationEvent>['onChange']>>(
    (_, filters, sorter) => {
      const nextVisibilityStatus = Array.isArray(filters.visibilityStatus)
        ? String(filters.visibilityStatus[0] ?? '')
        : '';
      const nextEventType = Array.isArray(filters.eventType)
        ? String(filters.eventType[0] ?? '')
        : '';
      const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const nextField =
        nextSorter && typeof nextSorter.field === 'string'
          ? parseSortField(nextSorter.field)
          : null;

      commitParams({
        eventType: nextEventType || null,
        visibilityStatus: nextVisibilityStatus || null,
        sortField: nextField,
        sortOrder: nextField ? nextSorter?.order ?? null : null
      });
    },
    [commitParams]
  );

  const columns = useMemo<TableColumnsType<OperationEvent>>(
    () => [
      {
        title: '이벤트 ID',
        dataIndex: 'id',
        width: 132,
        sorter: createTextSorter((record) => record.id),
        sortOrder: sortField === 'id' ? sortOrder : null,
        render: (value: string, record) => (
          <Link
            className="table-navigation-link"
            to={`/operation/events/create/${record.id}${listSearch}`}
            onClick={(event) => event.stopPropagation()}
          >
            {value}
          </Link>
        )
      },
      {
        title: '이벤트명',
        dataIndex: 'title',
        width: 280,
        sorter: createTextSorter((record) => record.title),
        sortOrder: sortField === 'title' ? sortOrder : null
      },
      {
        title: '유형',
        dataIndex: 'eventType',
        width: 118,
        filteredValue: eventTypeFilter ? [eventTypeFilter] : null,
        ...createDefinedColumnFilterProps(operationEventTypeValues, (record) => record.eventType),
        sorter: createTextSorter((record) => record.eventType),
        sortOrder: sortField === 'eventType' ? sortOrder : null,
        render: (value: OperationEvent['eventType']) => <Tag color="blue">{value}</Tag>
      },
      {
        title: '진행 기간',
        dataIndex: 'startAt',
        width: 210,
        sorter: createTextSorter((record) => `${record.startAt}-${record.endAt}`),
        sortOrder: sortField === 'startAt' ? sortOrder : null,
        render: (_, record) => `${record.startAt} ~ ${record.endAt}`
      },
      {
        title: createStatusColumnTitle('노출 상태', operationEventVisibilityStatusValues),
        dataIndex: 'visibilityStatus',
        width: 118,
        filteredValue: visibilityStatusFilter ? [visibilityStatusFilter] : null,
        ...createDefinedColumnFilterProps(
          operationEventVisibilityStatusValues,
          (record) => record.visibilityStatus
        ),
        sorter: createTextSorter((record) => record.visibilityStatus),
        sortOrder: sortField === 'visibilityStatus' ? sortOrder : null,
        render: (value: OperationEvent['visibilityStatus']) => <StatusBadge status={value} />
      },
      {
        title: '참여자 수',
        dataIndex: 'participantCount',
        width: 130,
        render: (_, record) =>
          record.participantLimit
            ? `${record.participantCount.toLocaleString()} / ${record.participantLimit.toLocaleString()}`
            : `${record.participantCount.toLocaleString()}명`
      },
      {
        title: '보상 정책',
        dataIndex: 'rewardPolicySummary',
        width: 220,
        ellipsis: true
      },
      {
        title: '최근 수정일',
        dataIndex: 'updatedAt',
        width: 150,
        sorter: createTextSorter((record) => record.updatedAt),
        sortOrder: sortField === 'updatedAt' ? sortOrder : null
      },
      {
        title: '최근 수정자',
        dataIndex: 'updatedBy',
        width: 130
      },
      {
        title: '액션',
        key: 'actions',
        width: 96,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <Button type="link" onClick={() => openPreviewModal(record)}>
            미리보기
          </Button>
        )
      }
    ],
    [eventTypeFilter, listSearch, openPreviewModal, sortField, sortOrder, visibilityStatusFilter]
  );

  const previewFooterActions = previewEvent
    ? [
        <Button key="edit" type="primary" onClick={handlePreviewEdit}>
          본문 수정하기
        </Button>
      ]
    : undefined;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="이벤트" />
      <ListSummaryCards items={eventSummaryCards} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '이벤트 ID', value: 'id' },
              { label: '이벤트명', value: 'title' }
            ]}
            keyword={keyword}
            onSearchFieldChange={(value) => commitParams({ searchField: value })}
            onKeywordChange={(event) => commitParams({ keyword: event.target.value })}
            keywordPlaceholder="이벤트 ID, 이벤트명을 검색하세요."
            detailTitle="상세 검색"
            detailContent={
              <SearchBarDetailField label="진행 기간">
                <SearchBarDateRange
                  startDate={draftStartDate}
                  endDate={draftEndDate}
                  onChange={handleDraftDateChange}
                />
              </SearchBarDetailField>
            }
            onApply={() =>
              commitParams({
                startDate: draftStartDate,
                endDate: draftEndDate
              })
            }
            onDetailOpenChange={handleDetailOpenChange}
            onReset={handleDraftReset}
            summary={<Text type="secondary">총 {totalCount.toLocaleString()}건</Text>}
            actions={
              <Button type="primary" size="large" onClick={openCreateDetail}>
                이벤트 등록
              </Button>
            }
          />
        }
      >
        {eventsState.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="이벤트 목록을 불러오지 못했습니다."
            description={
              <Space direction="vertical">
                <Text>{eventsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
                {eventsState.errorCode ? (
                  <Text type="secondary">오류 코드: {eventsState.errorCode}</Text>
                ) : null}
                {hasCachedEvents ? (
                  <Text type="secondary">
                    마지막 성공 상태를 유지한 채 목록을 계속 확인할 수 있습니다.
                  </Text>
                ) : null}
              </Space>
            }
            action={
              <Button size="small" onClick={handleReload}>
                다시 시도
              </Button>
            }
          />
        ) : null}

        {eventsState.status === 'pending' && hasCachedEvents ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="최신 이벤트 목록을 다시 불러오는 중입니다."
            description="마지막 성공 상태를 유지한 채 새 데이터를 계속 확인할 수 있습니다."
          />
        ) : null}

        {eventsState.status === 'empty' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="등록된 이벤트가 없습니다."
            description="이벤트 등록 버튼을 눌러 첫 이벤트를 생성하세요."
          />
        ) : null}

        {isFilteredEmpty ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="선택한 조건에 맞는 이벤트가 없습니다."
            description="검색어, 진행 기간, 노출 상태, 이벤트 유형 조건을 조정해 다시 확인하세요."
          />
        ) : null}

        <AdminDataTable<OperationEvent>
          rowKey="id"
          columns={columns}
          dataSource={filteredEvents}
          pagination={false}
          loading={eventsState.status === 'pending' && !hasCachedEvents}
          onChange={handleTableChange}
          onRow={(record) => ({
            onClick: () => openDetail(record.id),
            style: { cursor: 'pointer' }
          })}
          scroll={{ x: 1600 }}
        />
      </AdminListCard>

      {actionState ? (
        <ConfirmAction
          open
          title={getActionCopy(actionState.type).title}
          description={getActionCopy(actionState.type).description}
          targetType="Operation"
          targetId={actionState.event.id}
          confirmText={getActionCopy(actionState.type).confirmText}
          onCancel={() => setActionState(null)}
          onConfirm={handleActionConfirm}
        />
      ) : null}

      <DetailDrawer
        open={Boolean(selectedEvent)}
        title={selectedEvent ? `이벤트 상세 · ${selectedEvent.id}` : '이벤트 상세'}
        onClose={closeDetail}
        destroyOnHidden
        width={760}
        headerMeta={
          selectedEvent ? (
            <Space wrap size={8}>
              <StatusBadge status={selectedEvent.progressStatus} />
              <StatusBadge status={selectedEvent.visibilityStatus} />
              <Tag color="blue">{selectedEvent.eventType}</Tag>
            </Space>
          ) : null
        }
        footerStart={
          selectedEvent ? (
            <AuditLogLink targetType="Operation" targetId={selectedEvent.id} />
          ) : null
        }
        footerEnd={
          selectedEvent ? (
            <Space wrap>
              <Button size="large" onClick={() => openPreviewModal(selectedEvent)}>
                미리보기
              </Button>
              <Button size="large" onClick={() => openEditDetail(selectedEvent)}>
                수정
              </Button>
              <Button
                size="large"
                disabled={
                  selectedEvent.progressStatus === '종료' ||
                  selectedEvent.visibilityStatus === '예약'
                }
                onClick={() => setActionState({ type: 'schedule', event: selectedEvent })}
              >
                게시 예약
              </Button>
              <Button
                size="large"
                disabled={
                  selectedEvent.progressStatus === '종료' ||
                  selectedEvent.visibilityStatus === '노출'
                }
                onClick={() => setActionState({ type: 'publish', event: selectedEvent })}
              >
                즉시 게시
              </Button>
              <Button
                size="large"
                danger
                disabled={selectedEvent.progressStatus === '종료'}
                onClick={() => setActionState({ type: 'end', event: selectedEvent })}
              >
                종료
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedEvent ? (
          <DetailDrawerBody>
            <Alert
              type={selectedEvent.progressStatus === '종료' ? 'warning' : 'info'}
              showIcon
              message={
                selectedEvent.progressStatus === '종료'
                  ? '종료된 이벤트입니다.'
                  : '이벤트 운영 정보를 확인하세요.'
              }
              description={
                selectedEvent.progressStatus === '종료'
                  ? '종료된 이벤트는 자동으로 숨김 상태로 유지됩니다. 재사용이 필요하면 이벤트를 복제해 새로 등록하세요.'
                  : '조치 후에는 감사 로그에서 대상 유형, 대상 ID, 수행 사유를 함께 검수하세요.'
              }
            />

            <DetailDrawerSection title="기본 정보">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'id', label: '이벤트 ID', children: selectedEvent.id },
                  { key: 'title', label: '이벤트명', children: selectedEvent.title },
                  { key: 'period', label: '진행 기간', children: `${selectedEvent.startAt} ~ ${selectedEvent.endAt}` },
                  { key: 'visibility', label: '노출 상태', children: <StatusBadge status={selectedEvent.visibilityStatus} /> },
                  { key: 'channels', label: '노출 위치', children: selectedEvent.exposureChannels.join(', ') },
                  {
                    key: 'bannerCount',
                    label: '배너 이미지',
                    children: selectedEvent.bannerImages.length
                      ? `총 ${selectedEvent.bannerImages.length}개 · 대표 ${selectedEvent.bannerImageFileName || '첨부 이미지'}`
                      : '미등록'
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="이벤트 요약">
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {selectedEvent.summary}
              </Paragraph>
            </DetailDrawerSection>

            <DetailDrawerSection title="참여 조건">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'targetGroup', label: '대상 그룹', children: selectedEvent.targetGroupName },
                  { key: 'targetGroupId', label: '대상 그룹 ID', children: selectedEvent.targetGroupId }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="참여 현황">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'participants', label: '참여자 수', children: `${selectedEvent.participantCount.toLocaleString()}명` },
                  {
                    key: 'participantLimit',
                    label: '참여 제한',
                    children: selectedEvent.participantLimit
                      ? `${selectedEvent.participantLimit.toLocaleString()}명`
                      : '제한 없음'
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="보상 정책">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'rewardType', label: '보상 유형', children: selectedEvent.rewardType },
                  { key: 'rewardPolicyId', label: '보상 정책 ID', children: selectedEvent.rewardPolicyId || '미입력' },
                  { key: 'rewardPolicyName', label: '보상 정책명', children: selectedEvent.rewardPolicyName || '미입력' },
                  { key: 'rewardSummary', label: '보상 요약', children: selectedEvent.rewardPolicySummary }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="메시지 및 SEO">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'messageTemplateId', label: '메시지 템플릿 ID', children: selectedEvent.messageTemplateId || '미연결' },
                  { key: 'messageTemplateName', label: '메시지 템플릿', children: selectedEvent.messageTemplateName || '미연결' },
                  { key: 'slug', label: '슬러그', children: selectedEvent.slug },
                  { key: 'metaTitle', label: '공유 제목', children: selectedEvent.metaTitle || '자동 생성' },
                  { key: 'metaDescription', label: '공유 설명', children: selectedEvent.metaDescription || '자동 생성' },
                  { key: 'canonicalUrl', label: '대표 URL', children: selectedEvent.canonicalUrl || '자동 생성' },
                  { key: 'indexingPolicy', label: '인덱싱 정책', children: selectedEvent.indexingPolicy }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="운영 메모">
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {selectedEvent.adminMemo || '등록된 운영 메모가 없습니다.'}
              </Paragraph>
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>

      <HtmlPreviewModal
        open={Boolean(previewEvent)}
        title={previewEvent ? `이벤트 미리보기 · ${previewEvent.id}` : '이벤트 미리보기'}
        bodyHtml={previewEvent?.bodyHtml}
        footerActions={previewFooterActions}
        width={920}
        onClose={closePreviewModal}
        emptyDescription="등록 상세에서 이벤트 본문을 먼저 저장하세요."
      />
    </div>
  );
}
