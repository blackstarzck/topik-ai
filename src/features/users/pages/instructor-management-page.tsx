import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Space,
  Typography,
  notification
} from 'antd';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAsyncResource } from '@/shared/model/use-async-resource';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  fetchInstructorsSafe,
  isInstructorsSupabase,
  setInstructorStatusSafe
} from '../api/instructors-service';
import { useInstructorsQueryStore } from '../model/instructors-query-store';
import {
  buildInstructorSearchParams,
  filterInstructors,
  formatCurrentDateTime,
  instructorPageSizeOptions as pageSizeOptions,
  instructorSearchFieldOptions as searchFieldOptions,
  parseInstructorQuery,
  type InstructorActionState as ActionState
} from '../model/instructor-management-page-schema';
import { createInstructorColumns } from '../ui/instructor-columns';
import { InstructorDetailDrawer } from '../ui/instructor-detail-drawer';
import type {
  InstructorDetail,
  InstructorQuery,
  InstructorSearchField,
  InstructorStatus
} from '../model/types';
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
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';

const { Text, Title } = Typography;

export default function InstructorManagementPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedInstructorId = searchParams.get('selected') ?? '';
  const query = useInstructorsQueryStore((state) => state.query);
  const replaceQuery = useInstructorsQueryStore((state) => state.replaceQuery);
  const setQuery = useInstructorsQueryStore((state) => state.setQuery);
  const fetchInstructors = useCallback(
    (signal: AbortSignal) => fetchInstructorsSafe(signal),
    []
  );
  // 페이지 이동(query.page/pageSize) 시 전체 목록 재조회하던 기존 deps 는 오너 확인
  // (2026-08-19)으로 제거 — fetch 가 페이지 값을 쓰지 않아 같은 데이터를 재수신했다.
  const {
    state: instructorsState,
    reload: reloadInstructors,
    mutate: mutateInstructors
  } = useAsyncResource<InstructorDetail[]>(fetchInstructors, { initialData: [] });
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

      if (isInstructorsSupabase) {
        const result = await setInstructorStatusSafe({
          instructorId: actionState.instructor.id,
          nextStatus,
          reason
        });

        if (!result.ok) {
          notificationApi.error({
            message: `${actionLabel} 실패`,
            description: result.error.message
          });
          setActionState(null);
          return;
        }

        // DB 반영분을 다시 불러와 화면을 동기화한다.
        reloadInstructors();
      } else {
        mutateInstructors((data) =>
          data.map((item) =>
            item.id === actionState.instructor.id
              ? {
                  ...item,
                  status: nextStatus,
                  assignmentStatus:
                    nextStatus === '정지' ? '조정 필요' : item.assignmentStatus,
                  lastActionAt: formatCurrentDateTime()
                }
              : item
          )
        );
      }

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
    [actionState, mutateInstructors, notificationApi, reloadInstructors]
  );

  const handleRetryLoad = useCallback(() => {
    reloadInstructors();
  }, [reloadInstructors]);

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

  const columns = useMemo(
    () =>
      createInstructorColumns({
        onOpenMessageGroup: openMessageGroup,
        onSuspend: handleSuspend,
        onUnsuspend: handleUnsuspend
      }),
    [handleSuspend, handleUnsuspend, openMessageGroup]
  );

  const handleRowClick = useCallback(
    (record: InstructorDetail) => ({
      onClick: () => openDrawer(record.id),
      style: { cursor: 'pointer' }
    }),
    [openDrawer]
  );

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

      <InstructorDetailDrawer
        instructor={selectedInstructor}
        onClose={closeDrawer}
        onOpenMessageGroup={openMessageGroup}
        onSuspend={handleSuspend}
        onUnsuspend={handleUnsuspend}
      />

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
