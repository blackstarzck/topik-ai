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
      title: '?대깽??게시 예약',
      description: '?대깽???몄텧??예약 상태濡?蹂寃쏀빀?덈떎. 예약 사유를 입력하세요.',
      confirmText: '게시 예약 ?ㅽ뻾',
      successMessage: '?대깽??게시 예약 완료'
    };
  }

  if (type === 'publish') {
    return {
      title: '?대깽??즉시 게시',
      description: '?대깽?몃? 즉시 ?몄텧 상태濡??꾪솚?⑸땲?? 게시 사유를 입력하세요.',
      confirmText: '즉시 게시 ?ㅽ뻾',
      successMessage: '?대깽??즉시 게시 완료'
    };
  }

  return {
    title: '?대깽??醫낅즺',
    description: '?대깽?몃? 醫낅즺?섍퀬 노출을 중단합니다. 醫낅즺 사유를 입력하세요.',
    confirmText: '?대깽??醫낅즺 ?ㅽ뻾',
    successMessage: '?대깽??醫낅즺 완료'
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
          ? '?대깽??게시 예약 완료'
          : state.operationEventSaved.mode === 'create'
            ? '?대깽???꾩떆 대상완료'
            : '?대깽???섏젙 완료',
      description: (
        <Space direction="vertical">
          <Text>대상?좏삎: {getTargetTypeLabel('Operation')}</Text>
          <Text>대상ID: {state.operationEventSaved.eventId}</Text>
          <Text>
            議곗튂:{' '}
            {state.operationEventSaved.action === 'schedule'
              ? '?깅줉 상세?먯꽌 게시 예약 ?ㅽ뻾'
              : state.operationEventSaved.mode === 'create'
                ? '?대깽???좉퇋 ?꾩떆 대상
                : '?대깽???뺣낫 ?섏젙'}
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
        (event) => event.visibilityStatus === '?몄텧'
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
        label: '?몄텧 ?대깽??,
        value: `${visibilitySummary.visibleCount.toLocaleString()}嫄?
      },
      {
        key: 'scheduled-events',
        label: '예약 ?대깽??,
        value: `${visibilitySummary.scheduledCount.toLocaleString()}嫄?
      },
      {
        key: 'hidden-events',
        label: '숨김 ?대깽??,
        value: `${visibilitySummary.hiddenCount.toLocaleString()}嫄?
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
              <Text type="secondary">?ㅻ쪟 肄붾뱶: {result.error.code}</Text>
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
            <Text>대상?좏삎: {getTargetTypeLabel('Operation')}</Text>
            <Text>대상ID: {result.data.id}</Text>
            <Text>사유/洹쇨굅: {reason}</Text>
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
        title: '?대깽??ID',
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
        title: '?대깽?몃챸',
        dataIndex: 'title',
        width: 280,
        sorter: createTextSorter((record) => record.title),
        sortOrder: sortField === 'title' ? sortOrder : null
      },
      {
        title: '?좏삎',
        dataIndex: 'eventType',
        width: 118,
        filteredValue: eventTypeFilter ? [eventTypeFilter] : null,
        ...createDefinedColumnFilterProps(operationEventTypeValues, (record) => record.eventType),
        sorter: createTextSorter((record) => record.eventType),
        sortOrder: sortField === 'eventType' ? sortOrder : null,
        render: (value: OperationEvent['eventType']) => <Tag color="blue">{value}</Tag>
      },
      {
        title: '吏꾪뻾 湲곌컙',
        dataIndex: 'startAt',
        width: 210,
        sorter: createTextSorter((record) => `${record.startAt}-${record.endAt}`),
        sortOrder: sortField === 'startAt' ? sortOrder : null,
        render: (_, record) => `${record.startAt} ~ ${record.endAt}`
      },
      {
        title: createStatusColumnTitle('?몄텧 상태', operationEventVisibilityStatusValues),
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
        title: '李몄뿬????,
        dataIndex: 'participantCount',
        width: 130,
        render: (_, record) =>
          record.participantLimit
            ? `${record.participantCount.toLocaleString()} / ${record.participantLimit.toLocaleString()}`
            : `${record.participantCount.toLocaleString()}紐?
      },
      {
        title: '蹂댁긽 ?뺤콉',
        dataIndex: 'rewardPolicySummary',
        width: 220,
        ellipsis: true
      },
      {
        title: '최근 수정??,
        dataIndex: 'updatedAt',
        width: 150,
        sorter: createTextSorter((record) => record.updatedAt),
        sortOrder: sortField === 'updatedAt' ? sortOrder : null
      },
      {
        title: '최근 수정??,
        dataIndex: 'updatedBy',
        width: 130
      },
      {
        title: '?≪뀡',
        key: 'actions',
        width: 96,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <Button type="link" onClick={() => openPreviewModal(record)}>
            誘몃━蹂닿린
          </Button>
        )
      }
    ],
    [eventTypeFilter, listSearch, openPreviewModal, sortField, sortOrder, visibilityStatusFilter]
  );

  const previewFooterActions = previewEvent
    ? [
        <Button key="edit" type="primary" onClick={handlePreviewEdit}>
          蹂몃Ц ?섏젙?섍린
        </Button>
      ]
    : undefined;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="?대깽?? />
      <ListSummaryCards items={eventSummaryCards} />

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={searchField}
            searchFieldOptions={[
              { label: '전체', value: 'all' },
              { label: '?대깽??ID', value: 'id' },
              { label: '?대깽?몃챸', value: 'title' }
            ]}
            keyword={keyword}
            onSearchFieldChange={(value) => commitParams({ searchField: value })}
            onKeywordChange={(event) => commitParams({ keyword: event.target.value })}
            keywordPlaceholder="?대깽??ID, ?대깽?몃챸??寃?됲븯?몄슂."
            detailTitle="상세 寃??
            detailContent={
              <SearchBarDetailField label="吏꾪뻾 湲곌컙">
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
            summary={<Text type="secondary">珥?{totalCount.toLocaleString()}嫄?/Text>}
            actions={
              <Button type="primary" size="large" onClick={openCreateDetail}>
                ?대깽???깅줉
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
            message="?대깽??紐⑸줉??遺덈윭?ㅼ? 紐삵뻽?듬땲??"
            description={
              <Space direction="vertical">
                <Text>{eventsState.errorMessage ?? '?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'}</Text>
                {eventsState.errorCode ? (
                  <Text type="secondary">?ㅻ쪟 肄붾뱶: {eventsState.errorCode}</Text>
                ) : null}
                {hasCachedEvents ? (
                  <Text type="secondary">
                    留덉?留?성공 상태瑜??좎???梨?紐⑸줉??怨꾩냽 ?뺤씤?????덉뒿?덈떎.
                  </Text>
                ) : null}
              </Space>
            }
            action={
              <Button size="small" onClick={handleReload}>
                ?ㅼ떆 ?쒕룄
              </Button>
            }
          />
        ) : null}

        {eventsState.status === 'pending' && hasCachedEvents ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="理쒖떊 ?대깽??紐⑸줉???ㅼ떆 遺덈윭?ㅻ뒗 以묒엯?덈떎."
            description="留덉?留?성공 상태瑜??좎???梨????곗씠?곕? 怨꾩냽 ?뺤씤?????덉뒿?덈떎."
          />
        ) : null}

        {eventsState.status === 'empty' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="?깅줉???대깽?멸? ?놁뒿?덈떎."
            description="?대깽???깅줉 踰꾪듉???뚮윭 泥??대깽?몃? ?앹꽦?섏꽭??"
          />
        ) : null}

        {isFilteredEmpty ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="?좏깮??議곌굔??留욌뒗 ?대깽?멸? ?놁뒿?덈떎."
            description="寃?됱뼱, 吏꾪뻾 湲곌컙, ?몄텧 상태, ?대깽???좏삎 議곌굔??議곗젙???ㅼ떆 ?뺤씤?섏꽭??"
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
        title={selectedEvent ? `?대깽??상세 쨌 ${selectedEvent.id}` : '?대깽??상세'}
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
                誘몃━蹂닿린
              </Button>
              <Button size="large" onClick={() => openEditDetail(selectedEvent)}>
                ?섏젙
              </Button>
              <Button
                size="large"
                disabled={
                  selectedEvent.progressStatus === '醫낅즺' ||
                  selectedEvent.visibilityStatus === '예약'
                }
                onClick={() => setActionState({ type: 'schedule', event: selectedEvent })}
              >
                게시 예약
              </Button>
              <Button
                size="large"
                disabled={
                  selectedEvent.progressStatus === '醫낅즺' ||
                  selectedEvent.visibilityStatus === '?몄텧'
                }
                onClick={() => setActionState({ type: 'publish', event: selectedEvent })}
              >
                즉시 게시
              </Button>
              <Button
                size="large"
                danger
                disabled={selectedEvent.progressStatus === '醫낅즺'}
                onClick={() => setActionState({ type: 'end', event: selectedEvent })}
              >
                醫낅즺
              </Button>
            </Space>
          ) : null
        }
      >
        {selectedEvent ? (
          <DetailDrawerBody>
            <Alert
              type={selectedEvent.progressStatus === '醫낅즺' ? 'warning' : 'info'}
              showIcon
              message={
                selectedEvent.progressStatus === '醫낅즺'
                  ? '醫낅즺???대깽?몄엯?덈떎.'
                  : '?대깽??운영 ?뺣낫瑜??뺤씤?섏꽭??'
              }
              description={
                selectedEvent.progressStatus === '醫낅즺'
                  ? '醫낅즺???대깽?몃뒗 ?먮룞?쇰줈 숨김 상태濡??좎??⑸땲?? ?ъ궗?⑹씠 ?꾩슂?섎㈃ ?대깽?몃? 蹂듭젣???덈줈 ?깅줉?섏꽭??'
                  : '議곗튂 ?꾩뿉??媛먯궗 로그?먯꽌 대상?좏삎, 대상ID, ?섑뻾 사유瑜??④퍡 寃?섑븯?몄슂.'
              }
            />

            <DetailDrawerSection title="湲곕낯 ?뺣낫">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'id', label: '?대깽??ID', children: selectedEvent.id },
                  { key: 'title', label: '?대깽?몃챸', children: selectedEvent.title },
                  { key: 'period', label: '吏꾪뻾 湲곌컙', children: `${selectedEvent.startAt} ~ ${selectedEvent.endAt}` },
                  { key: 'visibility', label: '?몄텧 상태', children: <StatusBadge status={selectedEvent.visibilityStatus} /> },
                  { key: 'channels', label: '?몄텧 ?꾩튂', children: selectedEvent.exposureChannels.join(', ') },
                  {
                    key: 'bannerCount',
                    label: '諛곕꼫 ?대?吏',
                    children: selectedEvent.bannerImages.length
                      ? `珥?${selectedEvent.bannerImages.length}媛?쨌 대상${selectedEvent.bannerImageFileName || '泥⑤? ?대?吏'}`
                      : '誘몃벑濡?
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="?대깽???붿빟">
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {selectedEvent.summary}
              </Paragraph>
            </DetailDrawerSection>

            <DetailDrawerSection title="李몄뿬 議곌굔">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'targetGroup', label: '대상洹몃９', children: selectedEvent.targetGroupName },
                  { key: 'targetGroupId', label: '대상洹몃９ ID', children: selectedEvent.targetGroupId }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="李몄뿬 ?꾪솴">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'participants', label: '李몄뿬????, children: `${selectedEvent.participantCount.toLocaleString()}紐? },
                  {
                    key: 'participantLimit',
                    label: '李몄뿬 ?쒗븳',
                    children: selectedEvent.participantLimit
                      ? `${selectedEvent.participantLimit.toLocaleString()}紐?
                      : '?쒗븳 ?놁쓬'
                  }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="蹂댁긽 ?뺤콉">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'rewardType', label: '蹂댁긽 ?좏삎', children: selectedEvent.rewardType },
                  { key: 'rewardPolicyId', label: '蹂댁긽 ?뺤콉 ID', children: selectedEvent.rewardPolicyId || '誘몄엯?? },
                  { key: 'rewardPolicyName', label: '蹂댁긽 ?뺤콉紐?, children: selectedEvent.rewardPolicyName || '誘몄엯?? },
                  { key: 'rewardSummary', label: '蹂댁긽 ?붿빟', children: selectedEvent.rewardPolicySummary }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="硫붿떆吏 諛?SEO">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={[
                  { key: 'messageTemplateId', label: '硫붿떆吏 ?쒗뵆由?ID', children: selectedEvent.messageTemplateId || '誘몄뿰寃? },
                  { key: 'messageTemplateName', label: '硫붿떆吏 ?쒗뵆由?, children: selectedEvent.messageTemplateName || '誘몄뿰寃? },
                  { key: 'slug', label: '?щ윭洹?, children: selectedEvent.slug },
                  { key: 'metaTitle', label: '怨듭쑀 제목', children: selectedEvent.metaTitle || '?먮룞 ?앹꽦' },
                  { key: 'metaDescription', label: '怨듭쑀 설명', children: selectedEvent.metaDescription || '?먮룞 ?앹꽦' },
                  { key: 'canonicalUrl', label: '대상URL', children: selectedEvent.canonicalUrl || '?먮룞 ?앹꽦' },
                  { key: 'indexingPolicy', label: '?몃뜳???뺤콉', children: selectedEvent.indexingPolicy }
                ]}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="운영 硫붾え">
              <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {selectedEvent.adminMemo || '?깅줉??운영 硫붾え媛 ?놁뒿?덈떎.'}
              </Paragraph>
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>

      <HtmlPreviewModal
        open={Boolean(previewEvent)}
        title={previewEvent ? `?대깽??誘몃━蹂닿린 쨌 ${previewEvent.id}` : '?대깽??誘몃━蹂닿린'}
        bodyHtml={previewEvent?.bodyHtml}
        footerActions={previewFooterActions}
        width={920}
        onClose={closePreviewModal}
        emptyDescription="?깅줉 상세?먯꽌 ?대깽??蹂몃Ц??癒쇱? ??ν븯?몄슂."
      />
    </div>
  );
}


