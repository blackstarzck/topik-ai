import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Row,
  Space,
  Tag,
  Typography,
  notification
} from 'antd';
import type { DescriptionsProps, TableColumnsType } from 'antd';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { fetchInstructorsSafe } from '../api/instructors-service';
import {
  defaultInstructorQuery,
  useInstructorsQueryStore
} from '../model/instructors-query-store';
import {
  instructorActivityStatuses,
  instructorCountries,
  instructorOrganizations
} from '../model/types';
import type {
  InstructorAdminNote,
  InstructorActivityStatus,
  InstructorCourseSummary,
  InstructorDetail,
  InstructorMessageHistory,
  InstructorQuery,
  InstructorSearchField,
  InstructorStatus
} from '../model/types';
import type { AsyncState } from '../../../shared/model/async-state';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import {
  DetailDrawer,
  DetailDrawerBody,
  DetailDrawerSection
} from '../../../shared/ui/detail-drawer/detail-drawer';
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
import {
  createDrawerTableScroll,
  DRAWER_TABLE_PAGINATION,
  fixDrawerTableFirstColumn
} from '../../../shared/ui/table/drawer-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import { formatUserDisplayName } from '../../../shared/ui/user/user-reference';

const { Paragraph, Text, Title } = Typography;

const pageSizeOptions = ['20', '50', '100'];
const instructorStatusFilterValues = ['정상', '정지', '탈퇴'] as const;

const searchFieldOptions: { label: string; value: InstructorSearchField }[] = [
  { label: '전체', value: 'all' },
  { label: '媛뺤궗 ID', value: 'id' },
  { label: '이름', value: 'realName' },
  { label: '이메일, value: 'email' },
  { label: '?뚯냽', value: 'organization' },
  { label: '대상洹몃９', value: 'messageGroupName' }
];

type ActionState =
  | { type: 'suspend'; instructor: InstructorDetail }
  | { type: 'unsuspend'; instructor: InstructorDetail }
  | null;

function parsePositiveNumber(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseSearchField(value: string | null): InstructorSearchField {
  if (
    value === 'id' ||
    value === 'realName' ||
    value === 'email' ||
    value === 'organization' ||
    value === 'messageGroupName'
  ) {
    return value;
  }
  return defaultInstructorQuery.searchField;
}

function parseInstructorQuery(searchParams: URLSearchParams): InstructorQuery {
  return {
    page: parsePositiveNumber(
      searchParams.get('page'),
      defaultInstructorQuery.page
    ),
    pageSize: parsePositiveNumber(
      searchParams.get('pageSize'),
      defaultInstructorQuery.pageSize
    ),
    sort: defaultInstructorQuery.sort,
    status: defaultInstructorQuery.status,
    activityStatus: defaultInstructorQuery.activityStatus,
    country: defaultInstructorQuery.country,
    organization: defaultInstructorQuery.organization,
    searchField: parseSearchField(searchParams.get('searchField')),
    startDate: parseSearchDate(searchParams.get('startDate')),
    endDate: parseSearchDate(searchParams.get('endDate')),
    keyword: searchParams.get('keyword') ?? ''
  };
}

function buildInstructorSearchParams(
  query: InstructorQuery,
  selectedId?: string
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(query.page));
  params.set('pageSize', String(query.pageSize));
  if (query.searchField !== 'all') {
    params.set('searchField', query.searchField);
  }
  if (query.startDate) {
    params.set('startDate', query.startDate);
  }
  if (query.endDate) {
    params.set('endDate', query.endDate);
  }
  if (query.keyword.trim()) {
    params.set('keyword', query.keyword.trim());
  }
  if (selectedId) {
    params.set('selected', selectedId);
  }

  return params;
}

function filterInstructors(
  instructors: InstructorDetail[],
  query: InstructorQuery
): InstructorDetail[] {
  const keyword = query.keyword.trim().toLowerCase();

  const filtered = instructors.filter((item) => {
    if (
      !matchesSearchDateRange(item.lastActivityAt, query.startDate, query.endDate)
    ) {
      return false;
    }
    if (!keyword) {
      return true;
    }

    return matchesSearchField(keyword, query.searchField, {
      id: item.id,
      realName: item.realName,
      email: item.email,
      organization: item.organization,
      messageGroupName: item.messageGroupName
    });
  });

  return [...filtered].sort((left, right) => {
    if (query.sort === 'students-desc') {
      return right.studentCount - left.studentCount;
    }
    if (query.sort === 'courses-desc') {
      return right.courseCount - left.courseCount;
    }
    return right.lastActivityAt.localeCompare(left.lastActivityAt);
  });
}

function formatCurrentDateTime(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

function renderActivityTag(status: InstructorActivityStatus): JSX.Element {
  const color =
    status === '활성' ? 'green' : status === '二쇱쓽' ? 'orange' : 'default';

  return <Tag color={color}>{status}</Tag>;
}

function renderCourseStatusTag(
  status: InstructorCourseSummary['status']
): JSX.Element {
  const color =
    status === '吏꾪뻾 以? ? 'green' : status === '以鍮?以? ? 'gold' : 'default';

  return <Tag color={color}>{status}</Tag>;
}

function renderMessageStatusTag(
  status: InstructorMessageHistory['status']
): JSX.Element {
  const color =
    status === '발송 완료' ? 'green' : status === '예약' ? 'cyan' : 'gold';

  return <Tag color={color}>{status}</Tag>;
}

function summarizeNoteContent(content: string, maxLength = 52): string {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength).trimEnd()}...`;
}

function buildSummaryItems(
  instructor: InstructorDetail
): DescriptionsProps['items'] {
  return [
    { key: 'id', label: '媛뺤궗 ID', children: instructor.id },
    {
      key: 'realName',
      label: '이름',
      children: formatUserDisplayName(instructor.realName, instructor.id)
    },
    { key: 'email', label: '이메일, children: instructor.email },
    { key: 'organization', label: '?뚯냽', children: instructor.organization },
    { key: 'country', label: '?대떦 援??', children: instructor.country },
    {
      key: 'status',
      label: '怨꾩젙 상태',
      children: <StatusBadge status={instructor.status} />
    },
    {
      key: 'activityStatus',
      label: '활동 상태',
      children: renderActivityTag(instructor.activityStatus)
    },
    {
      key: 'assignmentStatus',
      label: '諛곗젙 상태',
      children: instructor.assignmentStatus
    },
    {
      key: 'courseCount',
      label: '?대떦 怨쇱젙 ??,
      children: `${instructor.courseCount}媛?
    },
    {
      key: 'studentCount',
      label: '?대떦 ?숈뒿????,
      children: `${instructor.studentCount.toLocaleString()}紐?
    },
    {
      key: 'lastActivityAt',
      label: '理쒓렐 활동',
      children: instructor.lastActivityAt
    },
    {
      key: 'lastActionAt',
      label: '理쒓렐 議곗튂??,
      children: instructor.lastActionAt
    }
  ];
}

export default function InstructorManagementPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedInstructorId = searchParams.get('selected') ?? '';
  const query = useInstructorsQueryStore((state) => state.query);
  const replaceQuery = useInstructorsQueryStore((state) => state.replaceQuery);
  const setQuery = useInstructorsQueryStore((state) => state.setQuery);
  const [instructorsState, setInstructorsState] = useState<
    AsyncState<InstructorDetail[]>
  >({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [actionState, setActionState] = useState<ActionState>(null);
  const [notificationApi, notificationContextHolder] =
    notification.useNotification();
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(query.startDate, query.endDate);

  useEffect(() => {
    replaceQuery(parseInstructorQuery(searchParams));
  }, [replaceQuery, searchParams]);

  useEffect(() => {
    const controller = new AbortController();

    setInstructorsState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchInstructorsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setInstructorsState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setInstructorsState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    return () => {
      controller.abort();
    };
  }, [query.page, query.pageSize, reloadKey]);

  const commitQuery = useCallback(
    (next: Partial<InstructorQuery>) => {
      const merged = { ...query, ...next };
      setQuery(next);
      setSearchParams(
        buildInstructorSearchParams(merged, selectedInstructorId || undefined),
        { replace: true }
      );
    },
    [query, selectedInstructorId, setQuery, setSearchParams]
  );

  const visibleInstructors = useMemo(
    () => filterInstructors(instructorsState.data, query),
    [instructorsState.data, query]
  );

  const selectedInstructor = useMemo(
    () =>
      instructorsState.data.find((item) => item.id === selectedInstructorId) ?? null,
    [instructorsState.data, selectedInstructorId]
  );

  const summary = useMemo(
    () => ({
      total: instructorsState.data.length,
      normal: instructorsState.data.filter((item) => item.status === '정상').length,
      suspended: instructorsState.data.filter((item) => item.status === '정지').length,
      dormant: instructorsState.data.filter(
        (item) => item.activityStatus === '?대㈃'
      ).length
    }),
    [instructorsState.data]
  );

  const openDrawer = useCallback(
    (instructorId: string) => {
      setSearchParams(buildInstructorSearchParams(query, instructorId), {
        replace: true
      });
    },
    [query, setSearchParams]
  );

  const closeDrawer = useCallback(() => {
    setSearchParams(buildInstructorSearchParams(query), { replace: true });
  }, [query, setSearchParams]);

  const openMessageGroup = useCallback(
    (groupName: string) => {
      navigate(`/messages/groups?keyword=${encodeURIComponent(groupName)}`);
    },
    [navigate]
  );

  const handleSuspend = useCallback((instructor: InstructorDetail) => {
    setActionState({ type: 'suspend', instructor });
  }, []);

  const handleUnsuspend = useCallback((instructor: InstructorDetail) => {
    setActionState({ type: 'unsuspend', instructor });
  }, []);

  const handleConfirmAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const nextStatus: InstructorStatus =
        actionState.type === 'suspend' ? '정지' : '정상';
      const actionLabel =
        actionState.type === 'suspend' ? '媛뺤궗 정지' : '媛뺤궗 정지 ?댁젣';

      setInstructorsState((prev) => {
        const nextData = prev.data.map((item) =>
          item.id === actionState.instructor.id
            ? {
                ...item,
                status: nextStatus,
                assignmentStatus:
                  nextStatus === '정지' ? '議곗젙 ?꾩슂' : item.assignmentStatus,
                lastActionAt: formatCurrentDateTime()
              }
            : item
        );

        return {
          ...prev,
          data: nextData,
          status: nextData.length === 0 ? 'empty' : 'success'
        };
      });

      notificationApi.success({
        message: `${actionLabel} 완료`,
        description: (
          <Space direction="vertical">
            <Text>대상?좏삎: 媛뺤궗</Text>
            <Text>대상ID: {actionState.instructor.id}</Text>
            <Text>사유/洹쇨굅: {reason}</Text>
            <AuditLogLink
              targetType="Instructor"
              targetId={actionState.instructor.id}
            />
          </Space>
        )
      });
      setActionState(null);
    },
    [actionState, notificationApi]
  );

  const handleRetryLoad = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleKeywordChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      commitQuery({ keyword: event.target.value, page: 1 });
    },
    [commitQuery]
  );

  const handleSearchFieldChange = useCallback(
    (value: string) => {
      commitQuery({
        searchField: value as InstructorSearchField,
        page: 1
      });
    },
    [commitQuery]
  );

  const handleDateRangeChange = useCallback(
    (startDate: string, endDate: string) => {
      commitQuery({ startDate, endDate, page: 1 });
    },
    [commitQuery]
  );

  const handleApplyDateRange = useCallback(() => {
    handleDateRangeChange(draftStartDate, draftEndDate);
  }, [draftEndDate, draftStartDate, handleDateRangeChange]);

  const columns = useMemo<TableColumnsType<InstructorDetail>>(
    () => [
      {
        title: '媛뺤궗 ID',
        dataIndex: 'id',
        width: 120,
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '이름',
        dataIndex: 'realName',
        width: 110,
        sorter: createTextSorter((record) => record.realName)
      },
      {
        title: '이메일,
        dataIndex: 'email',
        width: 220,
        sorter: createTextSorter((record) => record.email)
      },
      {
        title: '?뚯냽',
        dataIndex: 'organization',
        width: 180,
        ...createDefinedColumnFilterProps(
          instructorOrganizations,
          (record) => record.organization
        ),
        sorter: createTextSorter((record) => record.organization)
      },
      {
        title: '?대떦 援??',
        dataIndex: 'country',
        width: 120,
        ...createDefinedColumnFilterProps(instructorCountries, (record) => record.country),
        sorter: createTextSorter((record) => record.country)
      },
      {
        title: createStatusColumnTitle('怨꾩젙 상태', ['정상', '정지', '탈퇴']),
        dataIndex: 'status',
        width: 120,
        ...createDefinedColumnFilterProps(
          instructorStatusFilterValues,
          (record) => record.status
        ),
        sorter: createTextSorter((record) => record.status),
        render: (status: InstructorStatus) => <StatusBadge status={status} />
      },
      {
        title: createStatusColumnTitle('활동 상태', ['활성', '二쇱쓽', '?대㈃']),
        dataIndex: 'activityStatus',
        width: 120,
        ...createDefinedColumnFilterProps(
          instructorActivityStatuses,
          (record) => record.activityStatus
        ),
        sorter: createTextSorter((record) => record.activityStatus),
        render: (status: InstructorActivityStatus) => renderActivityTag(status)
      },
      {
        title: '?대떦 怨쇱젙 ??,
        dataIndex: 'courseCount',
        width: 130,
        sorter: createNumberSorter((record) => record.courseCount),
        render: (value: number) => `${value}媛?
      },
      {
        title: '?대떦 ?숈뒿????,
        dataIndex: 'studentCount',
        width: 140,
        sorter: createNumberSorter((record) => record.studentCount),
        render: (value: number) => `${value.toLocaleString()}紐?
      },
      {
        title: '理쒓렐 활동',
        dataIndex: 'lastActivityAt',
        width: 160,
        sorter: createTextSorter((record) => record.lastActivityAt)
      },
      {
        title: '理쒓렐 議곗튂??,
        dataIndex: 'lastActionAt',
        width: 160,
        sorter: createTextSorter((record) => record.lastActionAt)
      },
      {
        title: '?≪뀡',
        key: 'actions',
        width: 140,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <TableActionMenu
            items={[
              {
                key: `message-group-${record.id}`,
                label: '대상洹몃９ 蹂닿린',
                onClick: () => openMessageGroup(record.messageGroupName)
              },
              {
                key: `suspend-${record.id}`,
                label: '媛뺤궗 정지',
                danger: true,
                disabled: record.status !== '정상',
                onClick: () => handleSuspend(record)
              },
              {
                key: `unsuspend-${record.id}`,
                label: '媛뺤궗 정지 ?댁젣',
                disabled: record.status !== '정지',
                onClick: () => handleUnsuspend(record)
              }
            ]}
          />
        )
      }
    ],
    [handleSuspend, handleUnsuspend, openMessageGroup]
  );

  const courseColumns = useMemo<TableColumnsType<InstructorCourseSummary>>(
    () =>
      fixDrawerTableFirstColumn([
        {
          title: '怨쇱젙 ID',
          dataIndex: 'id',
          width: 120,
          sorter: createTextSorter((record) => record.id)
        },
        {
          title: '怨쇱젙紐?,
          dataIndex: 'title',
          ellipsis: true,
          sorter: createTextSorter((record) => record.title)
        },
        {
          title: '?쒖씠??,
          dataIndex: 'level',
          width: 120,
          sorter: createTextSorter((record) => record.level)
        },
        {
          title: '?숈뒿????,
          dataIndex: 'studentCount',
          width: 110,
          sorter: createNumberSorter((record) => record.studentCount),
          render: (value: number) => `${value.toLocaleString()}紐?
        },
        {
          title: createStatusColumnTitle('怨쇱젙 상태', [
            '吏꾪뻾 以?,
            '以鍮?以?,
            '醫낅즺 ?덉젙'
          ]),
          dataIndex: 'status',
          width: 120,
          sorter: createTextSorter((record) => record.status),
          render: (status: InstructorCourseSummary['status']) =>
            renderCourseStatusTag(status)
        }
      ]),
    []
  );

  const messageColumns = useMemo<TableColumnsType<InstructorMessageHistory>>(
    () =>
      fixDrawerTableFirstColumn([
        {
          title: '발송 ID',
          dataIndex: 'id',
          width: 120,
          sorter: createTextSorter((record) => record.id)
        },
        {
          title: '梨꾨꼸',
          dataIndex: 'channel',
          width: 90,
          sorter: createTextSorter((record) => record.channel)
        },
        {
          title: '제목',
          dataIndex: 'title',
          ellipsis: true,
          sorter: createTextSorter((record) => record.title)
        },
        {
          title: '발송 시각',
          dataIndex: 'sentAt',
          width: 150,
          sorter: createTextSorter((record) => record.sentAt)
        },
        {
          title: createStatusColumnTitle('상태', ['발송 완료', '예약', '珥덉븞']),
          dataIndex: 'status',
          width: 120,
          sorter: createTextSorter((record) => record.status),
          render: (status: InstructorMessageHistory['status']) =>
            renderMessageStatusTag(status)
        }
      ]),
    []
  );

  const adminNoteColumns = useMemo<TableColumnsType<InstructorAdminNote>>(
    () =>
      fixDrawerTableFirstColumn([
        {
          title: '硫붾え ID',
          dataIndex: 'id',
          width: 120,
          sorter: createTextSorter((record) => record.id)
        },
        {
          title: '?묒꽦 愿由ъ옄',
          dataIndex: 'adminName',
          width: 120,
          sorter: createTextSorter((record) => record.adminName)
        },
        {
          title: '작성일,
          dataIndex: 'createdAt',
          width: 150,
          sorter: createTextSorter((record) => record.createdAt)
        },
        {
          title: '硫붾え ?붿빟',
          dataIndex: 'content',
          ellipsis: true,
          render: (content: string) => (
            <Text type="secondary">{summarizeNoteContent(content)}</Text>
          ),
          sorter: createTextSorter((record) => record.content)
        }
      ]),
    []
  );

  const handleRowClick = useCallback(
    (record: InstructorDetail) => ({
      onClick: () => openDrawer(record.id),
      style: { cursor: 'pointer' }
    }),
    [openDrawer]
  );

  const drawerStatusAlert = useMemo(() => {
    if (!selectedInstructor) {
      return null;
    }
    if (selectedInstructor.status === '정지') {
      return {
        type: 'warning' as const,
        message: '?꾩옱 정지 상태??媛뺤궗?낅땲??',
        description: '?숈뒿???щ같???щ?? 硫붿떆吏 발송 ?꾩슂 ?щ?瑜??④퍡 ?뺤씤?섏꽭??'
      };
    }
    if (selectedInstructor.activityStatus === '?대㈃') {
      return {
        type: 'info' as const,
        message: '理쒓렐 활동???ㅻ옒 ?놁뼱 ?먭????꾩슂?⑸땲??',
        description: '?대㈃ 媛뺤궗 ?덈궡? ?대떦 怨쇱젙 상태瑜??④퍡 ?뺤씤?섏꽭??'
      };
    }
    if (selectedInstructor.assignmentStatus === '議곗젙 ?꾩슂') {
      return {
        type: 'warning' as const,
        message: '?대떦 怨쇱젙 ?먮뒗 ?숈뒿??諛곗젙 議곗젙???꾩슂?⑸땲??',
        description: '운영 硫붾え? 理쒓렐 議곗튂?쇱쓣 ?뺤씤?????꾩냽 議곗튂瑜?吏꾪뻾?섏꽭??'
      };
    }
    return null;
  }, [selectedInstructor]);

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="媛뺤궗 愿由? />

      {instructorsState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="媛뺤궗 紐⑸줉 議고쉶??실패?덉뒿?덈떎."
          description={
            <Space direction="vertical" size={4}>
              <Text>
                {instructorsState.errorMessage ?? '?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'}
              </Text>
              <Text type="secondary">
                ?ㅻ쪟 肄붾뱶: {instructorsState.errorCode ?? '-'}
              </Text>
              <Space>
                <Button onClick={handleRetryLoad}>?ъ떆??/Button>
                <Text type="secondary">留덉?留?성공 ?곗씠?곕뒗 ?좎??⑸땲??</Text>
              </Space>
            </Space>
          }
        />
      ) : null}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Text type="secondary">전체 媛뺤궗</Text>
            <Title level={3} style={{ margin: '8px 0 0' }}>
              {summary.total.toLocaleString()}紐?            </Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Text type="secondary">정상 媛뺤궗</Text>
            <Title level={3} style={{ margin: '8px 0 0' }}>
              {summary.normal.toLocaleString()}紐?            </Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Text type="secondary">정지 媛뺤궗</Text>
            <Title level={3} style={{ margin: '8px 0 0' }}>
              {summary.suspended.toLocaleString()}紐?            </Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Text type="secondary">?대㈃ 媛뺤궗</Text>
            <Title level={3} style={{ margin: '8px 0 0' }}>
              {summary.dormant.toLocaleString()}紐?            </Title>
          </Card>
        </Col>
      </Row>

      <AdminListCard
        toolbar={
          <SearchBar
            searchField={query.searchField}
            searchFieldOptions={searchFieldOptions}
            keyword={query.keyword}
            onSearchFieldChange={handleSearchFieldChange}
            onKeywordChange={handleKeywordChange}
            keywordPlaceholder="寃??.."
            detailTitle="상세 寃??
            detailContent={
              <SearchBarDetailField label="理쒓렐 활동??>
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
              <Text type="secondary">
                珥?{visibleInstructors.length.toLocaleString()}嫄?              </Text>
            }
          />
        }
      >
        {instructorsState.status !== 'pending' && visibleInstructors.length === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="議곌굔??留욌뒗 媛뺤궗媛 ?놁뒿?덈떎."
            description="寃?됱뼱 ?먮뒗 ?꾪꽣 議곌굔??議곗젙?????ㅼ떆 ?뺤씤?섏꽭??"
          />
        ) : null}

      <AdminDataTable<InstructorDetail>
        rowKey="id"
        columns={columns}
          dataSource={visibleInstructors}
          onRow={handleRowClick}
          loading={instructorsState.status === 'pending'}
          scroll={{ x: 1660, y: 560 }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            pageSizeOptions,
            showSizeChanger: true,
            showTotal: (total) => `珥?${total.toLocaleString()}嫄?,
            onChange: (page, pageSize) => {
              commitQuery({
                page,
                pageSize: pageSize ?? query.pageSize
              });
            }
          }}
        />
      </AdminListCard>

      <DetailDrawer
        open={Boolean(selectedInstructor)}
        title={selectedInstructor ? `媛뺤궗 상세 쨌 ${selectedInstructor.realName}` : '媛뺤궗 상세'}
        width={640}
        onClose={closeDrawer}
        headerMeta={
          selectedInstructor ? (
            <Space>
              <StatusBadge status={selectedInstructor.status} />
              {renderActivityTag(selectedInstructor.activityStatus)}
            </Space>
          ) : null
        }
        footerStart={
          selectedInstructor ? (
            <AuditLogLink
              targetType="Instructor"
              targetId={selectedInstructor.id}
            />
          ) : null
        }
        footerEnd={
          selectedInstructor ? (
            <Space wrap>
              <Button
                onClick={() => openMessageGroup(selectedInstructor.messageGroupName)}
              >
                대상洹몃９ 蹂닿린
              </Button>
              {selectedInstructor.status === '정지' ? (
                <Button
                  type="primary"
                  onClick={() => handleUnsuspend(selectedInstructor)}
                >
                  정지 ?댁젣
                </Button>
              ) : (
                <Button
                  danger
                  type="primary"
                  onClick={() => handleSuspend(selectedInstructor)}
                >
                  媛뺤궗 정지
                </Button>
              )}
            </Space>
          ) : null
        }
      >
        {selectedInstructor ? (
          <DetailDrawerBody>
            {drawerStatusAlert ? (
              <Alert
                type={drawerStatusAlert.type}
                showIcon
                message={drawerStatusAlert.message}
                description={drawerStatusAlert.description}
              />
            ) : null}

            <DetailDrawerSection title="湲곕낯 ?뺣낫">
              <Descriptions
                bordered
                size="small"
                column={1}
                items={buildSummaryItems(selectedInstructor)}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="?뚭컻 諛??꾨Ц 遺꾩빞">
              <Paragraph style={{ marginBottom: 8 }}>
                {selectedInstructor.introduction}
              </Paragraph>
              <Space wrap>
                {selectedInstructor.specialties.map((specialty) => (
                  <Tag key={specialty}>{specialty}</Tag>
                ))}
              </Space>
            </DetailDrawerSection>

            <DetailDrawerSection title="?대떦 怨쇱젙">
              <AdminDataTable<InstructorCourseSummary>
                rowKey="id"
                columns={courseColumns}
                dataSource={selectedInstructor.assignedCourses}
                pagination={DRAWER_TABLE_PAGINATION}
                scroll={createDrawerTableScroll(760)}
                locale={{ emptyText: '諛곗젙??怨쇱젙???놁뒿?덈떎.' }}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="理쒓렐 硫붿떆吏 발송 이력">
              <AdminDataTable<InstructorMessageHistory>
                rowKey="id"
                columns={messageColumns}
                dataSource={selectedInstructor.recentMessages}
                pagination={DRAWER_TABLE_PAGINATION}
                scroll={createDrawerTableScroll(760)}
                locale={{ emptyText: '理쒓렐 발송 이력???놁뒿?덈떎.' }}
              />
            </DetailDrawerSection>

            <DetailDrawerSection title="관리자 메모">
              <AdminDataTable<InstructorAdminNote>
                rowKey="id"
                columns={adminNoteColumns}
                dataSource={selectedInstructor.adminNotes}
                expandable={{
                  fixed: 'left',
                  expandRowByClick: true,
                  expandedRowRender: (note) => (
                    <Paragraph
                      style={{ margin: 0, whiteSpace: 'pre-wrap' }}
                    >
                      {note.content}
                    </Paragraph>
                  ),
                  rowExpandable: (note) => Boolean(note.content.trim())
                }}
                pagination={DRAWER_TABLE_PAGINATION}
                scroll={createDrawerTableScroll(760)}
                locale={{ emptyText: '?깅줉??관리자 메모媛 ?놁뒿?덈떎.' }}
              />
            </DetailDrawerSection>
          </DetailDrawerBody>
        ) : null}
      </DetailDrawer>

      {actionState ? (
        <ConfirmAction
          open
          title={actionState.type === 'suspend' ? '媛뺤궗 정지' : '媛뺤궗 정지 ?댁젣'}
          description={
            actionState.type === 'suspend'
              ? '媛뺤궗 怨꾩젙怨?운영 ?묎렐???쒗븳?⑸땲?? 議곗튂 사유? 洹쇨굅瑜?湲곕줉?섏꽭??'
              : '媛뺤궗 怨꾩젙 ?묎렐??蹂듦뎄?⑸땲?? ?댁젣 사유? 洹쇨굅瑜?湲곕줉?섏꽭??'
          }
          targetType="Instructor"
          targetId={actionState.instructor.id}
          confirmText={actionState.type === 'suspend' ? '정지 실행' : '해제 실행'}
          onCancel={() => setActionState(null)}
          onConfirm={handleConfirmAction}
        />
      ) : null}
    </div>
  );
}


