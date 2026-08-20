import { Alert, Button, Space, Typography, notification } from 'antd';
import type { TableProps } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAsyncResource } from '@/shared/model/use-async-resource';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  endEventSafe,
  fetchEventsSafe,
  publishEventSafe,
  scheduleEventPublishSafe
} from '../api/events-service';
import type { OperationEvent } from '../model/types';
import {
  getEventActionCopy,
  matchesEventPeriod,
  parseEventSortField,
  parseEventType,
  parseVisibilityStatus,
  type EventActionState
} from '../model/operation-events-page-schema';
import { createOperationEventColumns } from '../ui/operation-events-columns';
import { OperationEventDetailDrawer } from '../ui/operation-event-detail-drawer';
import { getTargetTypeLabel } from '@/shared/model/target-type-label';
import { useRouterStateNotice } from '@/shared/model/use-router-state-notice';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';
import { HtmlPreviewModal } from '@/shared/ui/html-preview-modal/html-preview-modal';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { ListSummaryCards } from '@/shared/ui/list-summary-cards/list-summary-cards';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '@/shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '@/shared/ui/search-bar/use-search-bar-date-draft';
import {
  matchesSearchField,
  parseSearchDate
} from '@/shared/ui/search-bar/search-bar-utils';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { parseSortOrder } from '@/shared/ui/table/table-column-utils';
import { SPACE } from '@/shared/styles/design-tokens';

const { Text } = Typography;

export default function OperationEventsPage(): JSX.Element {
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
  const sortField = parseEventSortField(searchParams.get('sortField'));
  const sortOrder = parseSortOrder(searchParams.get('sortOrder'));
  const selectedEventId = searchParams.get('selected') ?? '';
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(startDate, endDate);

  const fetchEvents = useCallback(
    (signal: AbortSignal) => fetchEventsSafe(signal),
    []
  );
  const {
    state: eventsState,
    reload: reloadEvents,
    mutate: mutateEvents
  } = useAsyncResource<OperationEvent[]>(fetchEvents, { initialData: [] });
  const [actionState, setActionState] = useState<EventActionState>(null);
  const [previewEvent, setPreviewEvent] = useState<OperationEvent | null>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();

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

  useRouterStateNotice(
    'operationEventSaved',
    (saved) => [saved.eventId, saved.mode, saved.action].join(':'),
    (saved) => {
      notificationApi.success({
        message:
          saved.action === 'schedule'
            ? '이벤트 게시 예약 완료'
            : saved.mode === 'create'
              ? '이벤트 임시 저장 완료'
              : '이벤트 수정 완료',
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('OperationEvent')}</Text>
            <Text>대상 ID: {saved.eventId}</Text>
            <Text>
              조치:{' '}
              {saved.action === 'schedule'
                ? '등록 상세에서 게시 예약 실행'
                : saved.mode === 'create'
                  ? '이벤트 신규 임시 저장'
                  : '이벤트 정보 수정'}
            </Text>
            <AuditLogLink targetType="OperationEvent" targetId={saved.eventId} />
          </Space>
        )
      });
    }
  );

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

  const handleReload = reloadEvents;
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
          ? await scheduleEventPublishSafe({
              eventId: actionState.event.id,
              reason
            })
          : actionState.type === 'publish'
            ? await publishEventSafe({
                eventId: actionState.event.id,
                reason
              })
            : await endEventSafe({
                eventId: actionState.event.id,
                reason
              });

      if (!result.ok) {
        notificationApi.error({
          message: `${getEventActionCopy(actionState.type).title} 실패`,
          description: (
            <Space direction="vertical">
              <Text>{result.error.message}</Text>
              <Text type="secondary">오류 코드: {result.error.code}</Text>
            </Space>
          )
        });
        return;
      }

      mutateEvents((data) =>
        data.map((event) => (event.id === result.data.id ? result.data : event))
      );

      notificationApi.success({
        message: getEventActionCopy(actionState.type).successMessage,
        description: (
          <Space direction="vertical">
            <Text>대상 유형: {getTargetTypeLabel('OperationEvent')}</Text>
            <Text>대상 ID: {result.data.id}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="OperationEvent" targetId={result.data.id} />
          </Space>
        )
      });

      setActionState(null);
    },
    [actionState, mutateEvents, notificationApi]
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
          ? parseEventSortField(nextSorter.field)
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

  const columns = useMemo(
    () =>
      createOperationEventColumns({
        sortField,
        sortOrder,
        eventTypeFilter,
        visibilityStatusFilter,
        listSearch,
        onPreview: openPreviewModal
      }),
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
            style={{ marginBottom: SPACE.sm }}
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
            style={{ marginBottom: SPACE.sm }}
            message="최신 이벤트 목록을 다시 불러오는 중입니다."
            description="마지막 성공 상태를 유지한 채 새 데이터를 계속 확인할 수 있습니다."
          />
        ) : null}

        {eventsState.status === 'empty' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: SPACE.sm }}
            message="등록된 이벤트가 없습니다."
            description="이벤트 등록 버튼을 눌러 첫 이벤트를 생성하세요."
          />
        ) : null}

        {isFilteredEmpty ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: SPACE.sm }}
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
          title={getEventActionCopy(actionState.type).title}
          description={getEventActionCopy(actionState.type).description}
          targetType="OperationEvent"
          targetId={actionState.event.id}
          confirmText={getEventActionCopy(actionState.type).confirmText}
          onCancel={() => setActionState(null)}
          onConfirm={handleActionConfirm}
        />
      ) : null}

      <OperationEventDetailDrawer
        event={selectedEvent}
        onClose={closeDetail}
        onPreview={openPreviewModal}
        onEdit={openEditDetail}
        onAction={(type, event) => setActionState({ type, event })}
      />

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
