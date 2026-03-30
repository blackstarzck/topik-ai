import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { Alert, Button, Space, Tooltip, Typography, notification } from 'antd';
import type { SortOrder, TableColumnsType, TableProps } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import {
  deleteNoticeSafe,
  fetchNoticesSafe,
  toggleNoticeStatusSafe
} from '../api/notices-service';
import type { OperationNotice } from '../model/types';
import type { AsyncState } from '../../../shared/model/async-state';
import { getTargetTypeLabel } from '../../../shared/model/target-type-label';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '../../../shared/ui/confirm-action/confirm-action';
import { HtmlPreviewModal } from '../../../shared/ui/html-preview-modal/html-preview-modal';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { AdminDataTable } from '../../../shared/ui/table/admin-data-table';
import { BinaryStatusSwitch } from '../../../shared/ui/table/binary-status-switch';
import { createStatusColumnTitle } from '../../../shared/ui/table/status-column-title';
import {
  createDefinedColumnFilterProps,
  createTextSorter
} from '../../../shared/ui/table/table-column-utils';

const { Text } = Typography;

const noticeStatusFilterValues = ['게시', '숨김'] as const;
const sortableFieldValues = ['id', 'title', 'author', 'createdAt', 'status'] as const;

type NoticeSortField = (typeof sortableFieldValues)[number];

type DangerState =
  | { type: 'delete'; notice: OperationNotice }
  | {
      type: 'toggle';
      notice: OperationNotice;
      nextStatus: OperationNotice['status'];
    }
  | null;

function parseStatusFilter(value: string | null): OperationNotice['status'] | null {
  if (value === '게시' || value === '숨김') {
    return value;
  }

  return null;
}

function parseSortField(value: string | null): NoticeSortField | null {
  if (
    value === 'id' ||
    value === 'title' ||
    value === 'author' ||
    value === 'createdAt' ||
    value === 'status'
  ) {
    return value;
  }

  return null;
}

function parseSortOrder(value: string | null): SortOrder | null {
  if (value === 'ascend' || value === 'descend') {
    return value;
  }

  return null;
}

export default function OperationNoticesPage(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = parseStatusFilter(searchParams.get('status'));
  const sortField = parseSortField(searchParams.get('sortField'));
  const sortOrder = parseSortOrder(searchParams.get('sortOrder'));
  const previewNoticeId = searchParams.get('preview');
  const [noticesState, setNoticesState] = useState<AsyncState<OperationNotice[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [dangerState, setDangerState] = useState<DangerState>(null);
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  const listSearch = useMemo(() => {
    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete('preview');
    const search = nextSearchParams.toString();
    return search ? `?${search}` : '';
  }, [searchParams]);

  const commitParams = useCallback(
    (
      next: Partial<Record<'status' | 'sortField' | 'sortOrder' | 'preview', string | null>>
    ) => {
      const merged = new URLSearchParams(searchParams);

      Object.entries(next).forEach(([key, value]) => {
        if (!value) {
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

    setNoticesState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchNoticesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setNoticesState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setNoticesState((prev) => ({
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
          operationNoticeSaved?: {
            noticeId: string;
            mode: 'create' | 'edit';
          };
        }
      | null;

    if (!state?.operationNoticeSaved) {
      return;
    }

    notificationApi.success({
      message:
        state.operationNoticeSaved.mode === 'create' ? '공지 등록 완료' : '공지 수정 완료',
      description: (
        <Space direction="vertical">
          <Text>대상?좏삎: {getTargetTypeLabel('Operation')}</Text>
          <Text>대상ID: {state.operationNoticeSaved.noticeId}</Text>
          <Text>
            사유/洹쇨굅:{' '}
            {state.operationNoticeSaved.mode === 'create'
              ? '?좉퇋 공지 대상珥덇린 상태: 숨김)'
              : '공지 제목/蹂몃Ц ?섏젙'}
          </Text>
          <AuditLogLink
            targetType="Operation"
            targetId={state.operationNoticeSaved.noticeId}
          />
        </Space>
      )
    });

    navigate(
      {
        pathname: location.pathname,
        search: location.search
      },
      {
        replace: true,
        state: null
      }
    );
  }, [location.pathname, location.search, location.state, navigate, notificationApi]);

  useEffect(() => {
    if (!previewNoticeId) {
      return;
    }

    const canValidatePreview =
      noticesState.status === 'success' ||
      noticesState.status === 'empty' ||
      (noticesState.status === 'error' && noticesState.data.length > 0);

    if (!canValidatePreview) {
      return;
    }

    const hasPreviewTarget = noticesState.data.some((notice) => notice.id === previewNoticeId);

    if (hasPreviewTarget) {
      return;
    }

    commitParams({ preview: null });
  }, [commitParams, noticesState.data, noticesState.status, previewNoticeId]);

  const previewNotice = useMemo(
    () =>
      previewNoticeId
        ? noticesState.data.find((notice) => notice.id === previewNoticeId) ?? null
        : null,
    [noticesState.data, previewNoticeId]
  );

  const filteredNoticeCount = useMemo(() => {
    if (!statusFilter) {
      return noticesState.data.length;
    }

    return noticesState.data.filter((notice) => notice.status === statusFilter).length;
  }, [noticesState.data, statusFilter]);

  const openCreateDetail = useCallback(() => {
    navigate({
      pathname: '/operation/notices/create',
      search: listSearch
    });
  }, [listSearch, navigate]);

  const openEditDetail = useCallback(
    (notice: OperationNotice) => {
      navigate({
        pathname: `/operation/notices/create/${notice.id}`,
        search: listSearch
      });
    },
    [listSearch, navigate]
  );

  const openPreviewModal = useCallback(
    (notice: OperationNotice) => {
      commitParams({ preview: notice.id });
    },
    [commitParams]
  );

  const promptDelete = useCallback((notice: OperationNotice) => {
    setDangerState({ type: 'delete', notice });
  }, []);

  const promptToggleStatus = useCallback((notice: OperationNotice) => {
    setDangerState({
      type: 'toggle',
      notice,
      nextStatus: notice.status === '게시' ? '숨김' : '게시'
    });
  }, []);

  const closeDangerModal = useCallback(() => setDangerState(null), []);
  const closePreviewModal = useCallback(() => commitParams({ preview: null }), [commitParams]);
  const handleReload = useCallback(() => setReloadKey((prev) => prev + 1), []);

  const handleDangerAction = useCallback(
    async (reason: string) => {
      if (!dangerState) {
        return;
      }

      if (dangerState.type === 'delete') {
        const result = await deleteNoticeSafe(dangerState.notice.id);
        if (!result.ok) {
          notificationApi.error({
            message: '공지 삭제 실패',
            description: (
              <Space direction="vertical">
                <Text>{result.error.message}</Text>
                <Text type="secondary">?ㅻ쪟 肄붾뱶: {result.error.code}</Text>
              </Space>
            )
          });
          return;
        }

        setNoticesState((prev) => {
          const nextData = prev.data.filter((notice) => notice.id !== result.data.id);

          return {
            status: nextData.length === 0 ? 'empty' : 'success',
            data: nextData,
            errorMessage: null,
            errorCode: null
          };
        });

        notificationApi.success({
          message: '공지 삭제 완료',
          description: (
            <Space direction="vertical">
              <Text>대상?좏삎: {getTargetTypeLabel('Operation')}</Text>
              <Text>대상ID: {result.data.id}</Text>
              <Text>사유/洹쇨굅: {reason}</Text>
              <AuditLogLink targetType="Operation" targetId={result.data.id} />
            </Space>
          )
        });
      }

      if (dangerState.type === 'toggle') {
        const result = await toggleNoticeStatusSafe({
          noticeId: dangerState.notice.id,
          nextStatus: dangerState.nextStatus
        });

        if (!result.ok) {
          notificationApi.error({
            message:
              dangerState.nextStatus === '게시' ? '공지 게시 실패' : '공지 숨김 실패',
            description: (
              <Space direction="vertical">
                <Text>{result.error.message}</Text>
                <Text type="secondary">?ㅻ쪟 肄붾뱶: {result.error.code}</Text>
              </Space>
            )
          });
          return;
        }

        setNoticesState((prev) => ({
          status: prev.data.length === 0 ? 'empty' : 'success',
          data: prev.data.map((notice) =>
            notice.id === result.data.id ? result.data : notice
          ),
          errorMessage: null,
          errorCode: null
        }));

        notificationApi.success({
          message: result.data.status === '게시' ? '공지 게시 완료' : '공지 숨김 완료',
          description: (
            <Space direction="vertical">
              <Text>대상?좏삎: {getTargetTypeLabel('Operation')}</Text>
              <Text>대상ID: {result.data.id}</Text>
              <Text>사유/洹쇨굅: {reason}</Text>
              <AuditLogLink targetType="Operation" targetId={result.data.id} />
            </Space>
          )
        });
      }

      setDangerState(null);
    },
    [dangerState, notificationApi]
  );

  const columns = useMemo<TableColumnsType<OperationNotice>>(
    () => [
      {
        title: '공지 ID',
        dataIndex: 'id',
        width: 130,
        sorter: createTextSorter((record) => record.id),
        sortOrder: sortField === 'id' ? sortOrder : null
      },
      {
        title: '제목',
        dataIndex: 'title',
        width: 320,
        sorter: createTextSorter((record) => record.title),
        sortOrder: sortField === 'title' ? sortOrder : null
      },
      {
        title: '작성일,
        dataIndex: 'author',
        width: 130,
        sorter: createTextSorter((record) => record.author),
        sortOrder: sortField === 'author' ? sortOrder : null,
        render: (author: string) => (
          <Link
            className="table-navigation-link"
            to="/system/admins"
            onClick={(event) => event.stopPropagation()}
          >
            {author}
          </Link>
        )
      },
      {
        title: '작성일,
        dataIndex: 'createdAt',
        width: 120,
        sorter: createTextSorter((record) => record.createdAt),
        sortOrder: sortField === 'createdAt' ? sortOrder : null
      },
      {
        title: createStatusColumnTitle('상태', ['게시', '숨김']),
        dataIndex: 'status',
        width: 132,
        filteredValue: statusFilter ? [statusFilter] : null,
        ...createDefinedColumnFilterProps(noticeStatusFilterValues, (record) => record.status),
        sorter: createTextSorter((record) => record.status),
        sortOrder: sortField === 'status' ? sortOrder : null,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <BinaryStatusSwitch
            checked={record.status === '게시'}
            checkedLabel="게시"
            uncheckedLabel="숨김"
            onToggle={() => promptToggleStatus(record)}
          />
        )
      },
      {
        title: '?≪뀡',
        key: 'action',
        width: 88,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => (
          <Tooltip title="공지 삭제">
            <Button
              danger
              type="text"
              icon={<DeleteOutlined />}
              onClick={() => promptDelete(record)}
            />
          </Tooltip>
        )
      }
    ],
    [promptDelete, promptToggleStatus, sortField, sortOrder, statusFilter]
  );

  const handleTableChange = useCallback<NonNullable<TableProps<OperationNotice>['onChange']>>(
    (_, filters, sorter) => {
      const nextStatusFilter = Array.isArray(filters.status)
        ? String(filters.status[0] ?? '')
        : '';
      const nextSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const nextField =
        nextSorter && typeof nextSorter.field === 'string'
          ? parseSortField(nextSorter.field)
          : null;

      commitParams({
        status: nextStatusFilter || null,
        sortField: nextField,
        sortOrder: nextField ? nextSorter?.order ?? null : null
      });
    },
    [commitParams]
  );

  const handleRowClick = useCallback(
    (record: OperationNotice) => ({
      onClick: () => openPreviewModal(record),
      style: { cursor: 'pointer' }
    }),
    [openPreviewModal]
  );

  const previewDescriptionItems = previewNotice
    ? [
        {
          key: 'noticeId',
          label: '공지 ID',
          children: previewNotice.id
        },
        {
          key: 'title',
          label: '제목',
          children: previewNotice.title
        },
        {
          key: 'status',
          label: '상태',
          children: previewNotice.status
        }
      ]
    : [];

  const previewFooterActions = previewNotice
    ? [
        <Button
          key="edit"
          type="primary"
          icon={<EditOutlined />}
          onClick={() => openEditDetail(previewNotice)}
        >
          공지 수정
        </Button>
      ]
    : undefined;

  const hasCachedNotices = noticesState.data.length > 0;
  const isFilteredEmpty =
    noticesState.status !== 'empty' &&
    noticesState.data.length > 0 &&
    filteredNoticeCount === 0;

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="공지사항" />

      <AdminListCard
        toolbar={
          <div className="admin-list-card-toolbar-side">
            <Text className="admin-list-card-toolbar-summary" type="secondary">
              珥?{filteredNoticeCount.toLocaleString()}嫄?            </Text>
            <div className="admin-list-card-toolbar-actions">
              <Button type="primary" size="large" onClick={openCreateDetail}>
                공지 등록
              </Button>
            </div>
          </div>
        }
      >
        {noticesState.status === 'error' ? (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="공지사항??遺덈윭?ㅼ? 紐삵뻽?듬땲??"
            description={
              <Space direction="vertical">
                <Text>{noticesState.errorMessage ?? '?쇱떆?곸씤 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.'}</Text>
                {noticesState.errorCode ? (
                  <Text type="secondary">?ㅻ쪟 肄붾뱶: {noticesState.errorCode}</Text>
                ) : null}
                {hasCachedNotices ? (
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

        {noticesState.status === 'pending' && hasCachedNotices ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="理쒖떊 공지사항???ㅼ떆 遺덈윭?ㅻ뒗 以묒엯?덈떎."
            description="留덉?留?성공 상태瑜??좎???梨??꾩옱 ?곗씠?곕? ?뺤씤?⑸땲??"
          />
        ) : null}

        {noticesState.status === 'empty' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="?깅줉??공지媛 ?놁뒿?덈떎."
            description="공지 등록 踰꾪듉?쇰줈 泥?공지瑜??묒꽦?댁＜?몄슂. ?좉퇋 공지??湲곕낯?곸쑝濡?숨김 상태濡???λ맗?덈떎."
          />
        ) : null}

        {isFilteredEmpty ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="?좏깮??상태 議곌굔??留욌뒗 공지媛 ?놁뒿?덈떎."
            description="상태 ?꾪꽣瑜??댁젣?섍굅???ㅻⅨ 상태瑜??좏깮???ㅼ떆 ?뺤씤?댁＜?몄슂."
          />
        ) : null}

        <AdminDataTable<OperationNotice>
          rowKey="id"
          pagination={false}
          scroll={{ x: 1120 }}
          loading={noticesState.status === 'pending' && !hasCachedNotices}
          columns={columns}
          dataSource={noticesState.data}
          onRow={handleRowClick}
          onChange={handleTableChange}
        />
      </AdminListCard>

      {dangerState ? (
        <ConfirmAction
          open
          title={
            dangerState.type === 'delete'
              ? '공지 삭제'
              : dangerState.nextStatus === '게시'
                ? '공지 게시'
                : '공지 숨김'
          }
          description={
            dangerState.type === 'delete'
              ? '공지瑜???젣?⑸땲?? ??젣 사유瑜??낅젰?댁＜?몄슂.'
              : dangerState.nextStatus === '게시'
                ? '숨김 상태 공지瑜??ㅼ떆 게시?⑸땲?? 게시 사유瑜??낅젰?댁＜?몄슂.'
                : '공지 노출을 중단합니다. 숨김 사유瑜??낅젰?댁＜?몄슂.'
          }
          targetType="Operation"
          targetId={dangerState.notice.id}
          confirmText={
            dangerState.type === 'delete'
              ? '삭제 실행'
              : dangerState.nextStatus === '게시'
                ? '게시 ?ㅽ뻾'
                : '숨김 실행'
          }
          onCancel={closeDangerModal}
          onConfirm={handleDangerAction}
        />
      ) : null}

      <HtmlPreviewModal
        open={Boolean(previewNotice)}
        title="공지 誘몃━蹂닿린"
        descriptionItems={previewDescriptionItems}
        bodyHtml={previewNotice?.bodyHtml}
        footerActions={previewFooterActions}
        onClose={closePreviewModal}
      />
    </div>
  );
}


