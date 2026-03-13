import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
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
  DRAWER_SECTION_GAP,
  DRAWER_TABLE_PAGINATION,
  fixDrawerTableFirstColumn
} from '../../../shared/ui/table/drawer-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';

const { Paragraph, Text, Title } = Typography;

const pageSizeOptions = ['20', '50', '100'];

const searchFieldOptions: { label: string; value: InstructorSearchField }[] = [
  { label: '전체', value: 'all' },
  { label: '강사 ID', value: 'id' },
  { label: '이름', value: 'realName' },
  { label: '이메일', value: 'email' },
  { label: '소속', value: 'organization' },
  { label: '대상 그룹', value: 'messageGroupName' }
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
    status === '활성' ? 'green' : status === '주의' ? 'orange' : 'default';

  return <Tag color={color}>{status}</Tag>;
}

function renderCourseStatusTag(
  status: InstructorCourseSummary['status']
): JSX.Element {
  const color =
    status === '진행 중' ? 'green' : status === '준비 중' ? 'gold' : 'default';

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
    { key: 'id', label: '강사 ID', children: instructor.id },
    { key: 'realName', label: '이름', children: instructor.realName },
    { key: 'email', label: '이메일', children: instructor.email },
    { key: 'organization', label: '소속', children: instructor.organization },
    { key: 'country', label: '담당 국가', children: instructor.country },
    {
      key: 'status',
      label: '계정 상태',
      children: <StatusBadge status={instructor.status} />
    },
    {
      key: 'activityStatus',
      label: '활동 상태',
      children: renderActivityTag(instructor.activityStatus)
    },
    {
      key: 'assignmentStatus',
      label: '배정 상태',
      children: instructor.assignmentStatus
    },
    {
      key: 'courseCount',
      label: '담당 과정 수',
      children: `${instructor.courseCount}개`
    },
    {
      key: 'studentCount',
      label: '담당 학습자 수',
      children: `${instructor.studentCount.toLocaleString()}명`
    },
    {
      key: 'lastActivityAt',
      label: '최근 활동',
      children: instructor.lastActivityAt
    },
    {
      key: 'lastActionAt',
      label: '최근 조치일',
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
  }, [reloadKey]);

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
        (item) => item.activityStatus === '휴면'
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
        actionState.type === 'suspend' ? '강사 정지' : '강사 정지 해제';

      setInstructorsState((prev) => {
        const nextData = prev.data.map((item) =>
          item.id === actionState.instructor.id
            ? {
                ...item,
                status: nextStatus,
                assignmentStatus:
                  nextStatus === '정지' ? '조정 필요' : item.assignmentStatus,
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
            <Text>대상 유형: 강사</Text>
            <Text>대상 ID: {actionState.instructor.id}</Text>
            <Text>사유/근거: {reason}</Text>
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
        title: '강사 ID',
        dataIndex: 'id',
        width: 120,
        ...createColumnFilterProps(visibleInstructors, (record) => record.id),
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '이름',
        dataIndex: 'realName',
        width: 110,
        ...createColumnFilterProps(visibleInstructors, (record) => record.realName),
        sorter: createTextSorter((record) => record.realName)
      },
      {
        title: '이메일',
        dataIndex: 'email',
        width: 220,
        ...createColumnFilterProps(visibleInstructors, (record) => record.email),
        sorter: createTextSorter((record) => record.email)
      },
      {
        title: '소속',
        dataIndex: 'organization',
        width: 180,
        ...createColumnFilterProps(
          visibleInstructors,
          (record) => record.organization
        ),
        sorter: createTextSorter((record) => record.organization)
      },
      {
        title: '담당 국가',
        dataIndex: 'country',
        width: 120,
        ...createColumnFilterProps(visibleInstructors, (record) => record.country),
        sorter: createTextSorter((record) => record.country)
      },
      {
        title: createStatusColumnTitle('계정 상태', ['정상', '정지', '탈퇴']),
        dataIndex: 'status',
        width: 120,
        ...createColumnFilterProps(visibleInstructors, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        render: (status: InstructorStatus) => <StatusBadge status={status} />
      },
      {
        title: createStatusColumnTitle('활동 상태', ['활성', '주의', '휴면']),
        dataIndex: 'activityStatus',
        width: 120,
        ...createColumnFilterProps(
          visibleInstructors,
          (record) => record.activityStatus
        ),
        sorter: createTextSorter((record) => record.activityStatus),
        render: (status: InstructorActivityStatus) => renderActivityTag(status)
      },
      {
        title: '담당 과정 수',
        dataIndex: 'courseCount',
        width: 130,
        ...createColumnFilterProps(
          visibleInstructors,
          (record) => record.courseCount
        ),
        sorter: createNumberSorter((record) => record.courseCount),
        render: (value: number) => `${value}개`
      },
      {
        title: '담당 학습자 수',
        dataIndex: 'studentCount',
        width: 140,
        ...createColumnFilterProps(
          visibleInstructors,
          (record) => record.studentCount
        ),
        sorter: createNumberSorter((record) => record.studentCount),
        render: (value: number) => `${value.toLocaleString()}명`
      },
      {
        title: '최근 활동',
        dataIndex: 'lastActivityAt',
        width: 160,
        ...createColumnFilterProps(
          visibleInstructors,
          (record) => record.lastActivityAt
        ),
        sorter: createTextSorter((record) => record.lastActivityAt)
      },
      {
        title: '최근 조치일',
        dataIndex: 'lastActionAt',
        width: 160,
        ...createColumnFilterProps(
          visibleInstructors,
          (record) => record.lastActionAt
        ),
        sorter: createTextSorter((record) => record.lastActionAt)
      },
      {
        title: '액션',
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
                label: '대상 그룹 보기',
                onClick: () => openMessageGroup(record.messageGroupName)
              },
              {
                key: `suspend-${record.id}`,
                label: '강사 정지',
                danger: true,
                disabled: record.status !== '정상',
                onClick: () => handleSuspend(record)
              },
              {
                key: `unsuspend-${record.id}`,
                label: '강사 정지 해제',
                disabled: record.status !== '정지',
                onClick: () => handleUnsuspend(record)
              }
            ]}
          />
        )
      }
    ],
    [
      handleSuspend,
      handleUnsuspend,
      openMessageGroup,
      visibleInstructors
    ]
  );

  const courseColumns = useMemo<TableColumnsType<InstructorCourseSummary>>(
    () =>
      fixDrawerTableFirstColumn([
        {
          title: '과정 ID',
          dataIndex: 'id',
          width: 120,
          sorter: createTextSorter((record) => record.id)
        },
        {
          title: '과정명',
          dataIndex: 'title',
          ellipsis: true,
          sorter: createTextSorter((record) => record.title)
        },
        {
          title: '난이도',
          dataIndex: 'level',
          width: 120,
          sorter: createTextSorter((record) => record.level)
        },
        {
          title: '학습자 수',
          dataIndex: 'studentCount',
          width: 110,
          align: 'right',
          sorter: createNumberSorter((record) => record.studentCount),
          render: (value: number) => `${value.toLocaleString()}명`
        },
        {
          title: createStatusColumnTitle('과정 상태', [
            '진행 중',
            '준비 중',
            '종료 예정'
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
          title: '채널',
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
          title: createStatusColumnTitle('상태', ['발송 완료', '예약', '초안']),
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
          title: '메모 ID',
          dataIndex: 'id',
          width: 120,
          sorter: createTextSorter((record) => record.id)
        },
        {
          title: '작성 관리자',
          dataIndex: 'adminName',
          width: 120,
          sorter: createTextSorter((record) => record.adminName)
        },
        {
          title: '작성일',
          dataIndex: 'createdAt',
          width: 150,
          sorter: createTextSorter((record) => record.createdAt)
        },
        {
          title: '메모 요약',
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
        message: '현재 정지 상태인 강사입니다.',
        description: '학습자 재배정 여부와 메시지 발송 필요 여부를 함께 확인하세요.'
      };
    }
    if (selectedInstructor.activityStatus === '휴면') {
      return {
        type: 'info' as const,
        message: '최근 활동이 오래 없어 점검이 필요합니다.',
        description: '휴면 강사 안내와 담당 과정 상태를 함께 확인하세요.'
      };
    }
    if (selectedInstructor.assignmentStatus === '조정 필요') {
      return {
        type: 'warning' as const,
        message: '담당 과정 또는 학습자 배정 조정이 필요합니다.',
        description: '운영 메모와 최근 조치일을 확인한 뒤 후속 조치를 진행하세요.'
      };
    }
    return null;
  }, [selectedInstructor]);

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="강사 관리" />

      {instructorsState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="강사 목록 조회에 실패했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>
                {instructorsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}
              </Text>
              <Text type="secondary">
                오류 코드: {instructorsState.errorCode ?? '-'}
              </Text>
              <Space>
                <Button onClick={handleRetryLoad}>재시도</Button>
                <Text type="secondary">마지막 성공 데이터는 유지됩니다.</Text>
              </Space>
            </Space>
          }
        />
      ) : null}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={6}>
          <Card>
            <Text type="secondary">전체 강사</Text>
            <Title level={3} style={{ margin: '8px 0 0' }}>
              {summary.total.toLocaleString()}명
            </Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Text type="secondary">정상 강사</Text>
            <Title level={3} style={{ margin: '8px 0 0' }}>
              {summary.normal.toLocaleString()}명
            </Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Text type="secondary">정지 강사</Text>
            <Title level={3} style={{ margin: '8px 0 0' }}>
              {summary.suspended.toLocaleString()}명
            </Title>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Text type="secondary">휴면 강사</Text>
            <Title level={3} style={{ margin: '8px 0 0' }}>
              {summary.dormant.toLocaleString()}명
            </Title>
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
            keywordPlaceholder="검색..."
            detailTitle="상세 검색"
            detailContent={
              <SearchBarDetailField label="최근 활동일">
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
                총 {visibleInstructors.length.toLocaleString()}건
              </Text>
            }
          />
        }
      >
        {instructorsState.status !== 'pending' && visibleInstructors.length === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="조건에 맞는 강사가 없습니다."
            description="검색어 또는 필터 조건을 조정한 뒤 다시 확인하세요."
          />
        ) : null}

        <AdminDataTable<InstructorDetail>
          rowKey="id"
          virtual
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
            showTotal: (total) => `총 ${total.toLocaleString()}건`,
            onChange: (page, pageSize) => {
              commitQuery({
                page,
                pageSize: pageSize ?? query.pageSize
              });
            }
          }}
        />
      </AdminListCard>

      <Drawer
        open={Boolean(selectedInstructor)}
        title={selectedInstructor ? `강사 상세 · ${selectedInstructor.realName}` : '강사 상세'}
        width={640}
        onClose={closeDrawer}
        extra={
          selectedInstructor ? (
            <Space>
              <StatusBadge status={selectedInstructor.status} />
              {renderActivityTag(selectedInstructor.activityStatus)}
            </Space>
          ) : null
        }
        footer={
          selectedInstructor ? (
            <Space
              style={{ width: '100%', justifyContent: 'space-between' }}
              wrap
            >
              <AuditLogLink
                targetType="Instructor"
                targetId={selectedInstructor.id}
              />
              <Space wrap>
                <Button
                  onClick={() => openMessageGroup(selectedInstructor.messageGroupName)}
                >
                  대상 그룹 보기
                </Button>
                {selectedInstructor.status === '정지' ? (
                  <Button
                    type="primary"
                    onClick={() => handleUnsuspend(selectedInstructor)}
                  >
                    정지 해제
                  </Button>
                ) : (
                  <Button
                    danger
                    type="primary"
                    onClick={() => handleSuspend(selectedInstructor)}
                  >
                    강사 정지
                  </Button>
                )}
              </Space>
            </Space>
          ) : null
        }
      >
        {selectedInstructor ? (
          <Space
            direction="vertical"
            size={DRAWER_SECTION_GAP}
            style={{ width: '100%' }}
          >
            {drawerStatusAlert ? (
              <Alert
                type={drawerStatusAlert.type}
                showIcon
                message={drawerStatusAlert.message}
                description={drawerStatusAlert.description}
              />
            ) : null}

            <div>
              <Title level={5} style={{ marginTop: 0 }}>
                기본 정보
              </Title>
              <Descriptions
                bordered
                size="small"
                column={1}
                items={buildSummaryItems(selectedInstructor)}
              />
            </div>

            <div>
              <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                소개 및 전문 분야
              </Title>
              <Paragraph style={{ marginBottom: 8 }}>
                {selectedInstructor.introduction}
              </Paragraph>
              <Space wrap>
                {selectedInstructor.specialties.map((specialty) => (
                  <Tag key={specialty}>{specialty}</Tag>
                ))}
              </Space>
            </div>

            <div>
              <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                담당 과정
              </Title>
              <AdminDataTable<InstructorCourseSummary>
                rowKey="id"
                columns={courseColumns}
                dataSource={selectedInstructor.assignedCourses}
                pagination={DRAWER_TABLE_PAGINATION}
                scroll={createDrawerTableScroll(760)}
                locale={{ emptyText: '배정된 과정이 없습니다.' }}
              />
            </div>

            <div>
              <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                최근 메시지 발송 이력
              </Title>
              <AdminDataTable<InstructorMessageHistory>
                rowKey="id"
                columns={messageColumns}
                dataSource={selectedInstructor.recentMessages}
                pagination={DRAWER_TABLE_PAGINATION}
                scroll={createDrawerTableScroll(760)}
                locale={{ emptyText: '최근 발송 이력이 없습니다.' }}
              />
            </div>

            <div>
              <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>
                관리자 메모
              </Title>
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
                locale={{ emptyText: '등록된 관리자 메모가 없습니다.' }}
              />
            </div>
          </Space>
        ) : null}
      </Drawer>

      {actionState ? (
        <ConfirmAction
          open
          title={actionState.type === 'suspend' ? '강사 정지' : '강사 정지 해제'}
          description={
            actionState.type === 'suspend'
              ? '강사 계정과 운영 접근을 제한합니다. 조치 사유와 근거를 기록하세요.'
              : '강사 계정 접근을 복구합니다. 해제 사유와 근거를 기록하세요.'
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
