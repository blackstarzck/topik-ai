import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  notification,
  Space,
  Typography
} from 'antd';
import type { TableColumnsType } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { fetchUsersSafe } from '../api/users-service';
import {
  defaultUsersQuery,
  useUsersQueryStore
} from '../model/users-query-store';
import type {
  UserStatus,
  UserSummary,
  UsersQuery,
  UsersSearchField
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
import {
  matchesSearchDateRange,
  matchesSearchField,
  parseSearchDate
} from '../../../shared/ui/search-bar/search-bar-utils';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';
import { TableActionMenu } from '../../../shared/ui/table/table-action-menu';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';

const { Text } = Typography;

const pageSizeOptions = ['20', '50', '100'];

const searchFieldOptions: { label: string; value: UsersSearchField }[] = [
  { label: '전체', value: 'all' },
  { label: '사용자 ID', value: 'id' },
  { label: '이름', value: 'realName' },
  { label: '이메일', value: 'email' },
  { label: '닉네임', value: 'nickname' }
];

type ListActionState =
  | { type: 'suspend'; user: UserSummary }
  | { type: 'unsuspend'; user: UserSummary }
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

function parseSearchField(value: string | null): UsersSearchField {
  if (
    value === 'id' ||
    value === 'realName' ||
    value === 'email' ||
    value === 'nickname'
  ) {
    return value;
  }
  return defaultUsersQuery.searchField;
}

function parseUsersQuery(searchParams: URLSearchParams): UsersQuery {
  return {
    page: parsePositiveNumber(searchParams.get('page'), defaultUsersQuery.page),
    pageSize: parsePositiveNumber(
      searchParams.get('pageSize'),
      defaultUsersQuery.pageSize
    ),
    status: defaultUsersQuery.status,
    sort: defaultUsersQuery.sort,
    searchField: parseSearchField(searchParams.get('searchField')),
    startDate: parseSearchDate(searchParams.get('startDate')),
    endDate: parseSearchDate(searchParams.get('endDate')),
    keyword: searchParams.get('keyword') ?? ''
  };
}

function buildUsersSearchParams(query: UsersQuery): URLSearchParams {
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
  return params;
}

function filterUsers(users: UserSummary[], query: UsersQuery): UserSummary[] {
  const keyword = query.keyword.trim().toLowerCase();

  const filtered = users.filter((item) => {
    if (!matchesSearchDateRange(item.joinedAt, query.startDate, query.endDate)) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return matchesSearchField(keyword, query.searchField, {
      id: item.id,
      realName: item.realName,
      email: item.email,
      nickname: item.nickname
    });
  });

  const sorted = [...filtered].sort((left, right) => {
    if (query.sort === 'latest') {
      return right.joinedAt.localeCompare(left.joinedAt);
    }
    return left.joinedAt.localeCompare(right.joinedAt);
  });

  return sorted;
}

export default function UsersPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = useUsersQueryStore((state) => state.query);
  const replaceQuery = useUsersQueryStore((state) => state.replaceQuery);
  const setQuery = useUsersQueryStore((state) => state.setQuery);
  const [usersState, setUsersState] = useState<AsyncState<UserSummary[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [actionState, setActionState] = useState<ListActionState>(null);
  const [memoForm] = Form.useForm<{ memo: string }>();
  const [memoTarget, setMemoTarget] = useState<UserSummary | null>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const {
    draftStartDate,
    draftEndDate,
    handleDraftDateChange,
    handleDraftReset,
    handleDetailOpenChange
  } = useSearchBarDateDraft(query.startDate, query.endDate);

  useEffect(() => {
    const parsed = parseUsersQuery(searchParams);
    replaceQuery(parsed);
  }, [replaceQuery, searchParams]);

  useEffect(() => {
    const controller = new AbortController();

    setUsersState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchUsersSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setUsersState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setUsersState((prev) => ({
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
    (next: Partial<UsersQuery>) => {
      const merged = { ...query, ...next };
      setQuery(next);
      setSearchParams(buildUsersSearchParams(merged), { replace: true });
    },
    [query, setQuery, setSearchParams]
  );

  const filteredUsers = useMemo(
    () => filterUsers(usersState.data, query),
    [usersState.data, query]
  );

  const handleSuspend = useCallback((user: UserSummary) => {
    setActionState({ type: 'suspend', user });
  }, []);

  const handleUnsuspend = useCallback((user: UserSummary) => {
    setActionState({ type: 'unsuspend', user });
  }, []);

  const handleOpenDetail = useCallback(
    (userId: string) => {
      navigate(`/users/${userId}?tab=profile`);
    },
    [navigate]
  );

  const handleMemoOpen = useCallback(
    (user: UserSummary) => {
      setMemoTarget(user);
      memoForm.setFieldsValue({ memo: '' });
    },
    [memoForm]
  );

  const closeAction = useCallback(() => setActionState(null), []);
  const closeMemoModal = useCallback(() => setMemoTarget(null), []);

  const handleConfirmAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const nextStatus: UserStatus =
        actionState.type === 'suspend' ? '정지' : '정상';
      const actionLabel =
        actionState.type === 'suspend' ? '회원 정지' : '회원 정지 해제';

      setUsersState((prev) => {
        const nextData = prev.data.map((item) =>
          item.id === actionState.user.id ? { ...item, status: nextStatus } : item
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
            <Text>대상 유형: {getTargetTypeLabel('Users')}</Text>
            <Text>대상 ID: {actionState.user.id}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="Users" targetId={actionState.user.id} />
          </Space>
        )
      });
      setActionState(null);
    },
    [actionState, notificationApi]
  );

  const handleMemoSubmit = useCallback(async () => {
    if (!memoTarget) {
      return;
    }

    const values = await memoForm.validateFields();
    notificationApi.success({
      message: '관리자 메모 작성 완료',
      description: (
        <Space direction="vertical">
          <Text>대상 유형: {getTargetTypeLabel('Users')}</Text>
          <Text>대상 ID: {memoTarget.id}</Text>
          <Text>사유/근거: {values.memo}</Text>
          <AuditLogLink targetType="Users" targetId={memoTarget.id} />
        </Space>
      )
    });
    setMemoTarget(null);
  }, [memoForm, memoTarget, notificationApi]);

  const columns = useMemo<TableColumnsType<UserSummary>>(
    () => [
      {
        title: '사용자 ID',
        dataIndex: 'id',
        width: 110,
        ...createColumnFilterProps(filteredUsers, (record) => record.id),
        sorter: createTextSorter((record) => record.id)
      },
      {
        title: '이메일',
        dataIndex: 'email',
        width: 220,
        ...createColumnFilterProps(filteredUsers, (record) => record.email),
        sorter: createTextSorter((record) => record.email)
      },
      {
        title: '이름',
        dataIndex: 'realName',
        width: 120,
        ...createColumnFilterProps(filteredUsers, (record) => record.realName),
        sorter: createTextSorter((record) => record.realName)
      },
      {
        title: '닉네임',
        dataIndex: 'nickname',
        width: 160,
        ...createColumnFilterProps(filteredUsers, (record) => record.nickname),
        sorter: createTextSorter((record) => record.nickname)
      },
      {
        title: '가입일',
        dataIndex: 'joinedAt',
        width: 120,
        ...createColumnFilterProps(filteredUsers, (record) => record.joinedAt),
        sorter: createTextSorter((record) => record.joinedAt)
      },
      {
        title: '최근 접속',
        dataIndex: 'lastLoginAt',
        width: 120,
        ...createColumnFilterProps(filteredUsers, (record) => record.lastLoginAt),
        sorter: createTextSorter((record) => record.lastLoginAt)
      },
      {
        title: '등급',
        dataIndex: 'tier',
        width: 120,
        ...createColumnFilterProps(filteredUsers, (record) => record.tier),
        sorter: createTextSorter((record) => record.tier)
      },
      {
        title: createStatusColumnTitle('구독 상태', ['구독', '미구독']),
        dataIndex: 'subscriptionStatus',
        width: 120,
        ...createColumnFilterProps(filteredUsers, (record) => record.subscriptionStatus),
        sorter: createTextSorter((record) => record.subscriptionStatus)
      },
      {
        title: createStatusColumnTitle('회원 상태', ['정상', '정지', '탈퇴']),
        dataIndex: 'status',
        width: 120,
        ...createColumnFilterProps(filteredUsers, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        render: (status: UserStatus) => <StatusBadge status={status} />
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
                key: `suspend-${record.id}`,
                label: '회원 정지',
                danger: true,
                disabled: record.status !== '정상',
                onClick: () => handleSuspend(record)
              },
              {
                key: `unsuspend-${record.id}`,
                label: '회원 정지 해제',
                disabled: record.status !== '정지',
                onClick: () => handleUnsuspend(record)
              },
              {
                key: `memo-${record.id}`,
                label: '관리자 메모 작성',
                onClick: () => handleMemoOpen(record)
              }
            ]}
          />
        )
      }
    ],
    [filteredUsers, handleMemoOpen, handleSuspend, handleUnsuspend]
  );

  const handleRowClick = useCallback(
    (record: UserSummary) => ({
      onClick: () => handleOpenDetail(record.id),
      style: { cursor: 'pointer' }
    }),
    [handleOpenDetail]
  );

  const handleKeywordChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      commitQuery({
        keyword: event.target.value,
        page: 1
      });
    },
    [commitQuery]
  );

  const handleSearchFieldChange = useCallback(
    (value: string) => {
      commitQuery({
        searchField: value as UsersSearchField,
        page: 1
      });
    },
    [commitQuery]
  );

  const handleDateRangeChange = useCallback(
    (startDate: string, endDate: string) => {
      commitQuery({
        startDate,
        endDate,
        page: 1
      });
    },
    [commitQuery]
  );

  const handleApplyDateRange = useCallback(() => {
    handleDateRangeChange(draftStartDate, draftEndDate);
  }, [draftEndDate, draftStartDate, handleDateRangeChange]);

  const handleRetryLoad = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="회원 목록" />

      {usersState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="회원 목록 조회에 실패했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>{usersState.errorMessage ?? '일시적인 오류가 발생했습니다.'}</Text>
              <Text type="secondary">오류 코드: {usersState.errorCode ?? '-'}</Text>
              <Space>
                <Button onClick={handleRetryLoad}>재시도</Button>
                <Text type="secondary">마지막 성공 데이터는 유지됩니다.</Text>
              </Space>
            </Space>
          }
        />
      ) : null}

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
              <SearchBarDetailField label="가입일">
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
              <Text type="secondary">총 {filteredUsers.length.toLocaleString()}건</Text>
            }
          />
        }
      >
        {usersState.status === 'empty' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="조회된 회원 데이터가 없습니다."
            description="필터 조건을 확인하거나 잠시 후 다시 조회해주세요."
          />
        ) : null}
        <AdminDataTable<UserSummary>
          rowKey="id"
          virtual
          columns={columns}
          dataSource={filteredUsers}
          onRow={handleRowClick}
          loading={usersState.status === 'pending'}
          scroll={{ x: 1620, y: 560 }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            pageSizeOptions,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total.toLocaleString()}`,
            onChange: (page, pageSize) => {
              commitQuery({
                page,
                pageSize: pageSize ?? query.pageSize
              });
            }
          }}
        />
      </AdminListCard>

      {actionState ? (
        <ConfirmAction
          open
          title={actionState.type === 'suspend' ? '회원 정지' : '회원 정지 해제'}
          description={
            actionState.type === 'suspend'
              ? '회원 기능을 제한합니다. 조치 사유를 기록하세요.'
              : '회원 기능을 복구합니다. 해제 사유를 기록하세요.'
          }
          targetType="Users"
          targetId={actionState.user.id}
          confirmText={actionState.type === 'suspend' ? '정지 실행' : '해제 실행'}
          onCancel={closeAction}
          onConfirm={handleConfirmAction}
        />
      ) : null}

      <Modal
        open={Boolean(memoTarget)}
        title="관리자 메모 작성"
        okText="저장"
        cancelText="취소"
        onCancel={closeMemoModal}
        onOk={handleMemoSubmit}
        destroyOnClose
      >
        <Form form={memoForm} layout="vertical">
          <Text type="secondary">
            대상 유형: {getTargetTypeLabel('Users')} / 대상 ID: {memoTarget?.id ?? '-'}
          </Text>
          <Form.Item
            label="메모"
            name="memo"
            rules={[{ required: true, message: '메모 내용을 입력하세요.' }]}
            style={{ marginTop: 12, marginBottom: 0 }}
          >
            <Input.TextArea rows={4} placeholder="운영 메모를 입력하세요." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}


