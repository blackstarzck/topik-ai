import { Alert, Button, Space, Tag, Typography, notification } from 'antd';
import type { TableColumnsType } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import {
  deleteInstitutionCodeSafe,
  fetchInstitutionCodesSafe,
  fetchInstitutionExposureModesSafe,
  isInstitutionCodesSupabase
} from '../api/institution-codes-service';
import { fetchInstitutionContractStatusSafe } from '../api/institution-contracts-service';
import type { InstitutionContractStatusSummary } from '../model/institution-contracts-types';
import { InstitutionContractDdayBadge } from '../ui/institution-contract-dday-badge';
import { InstitutionExposureModeTag } from '../ui/institution-exposure-mode-tag';
import {
  defaultInstitutionExposureMode,
  institutionCodeKinds,
  institutionCodeStatuses,
  institutionExposureModes
} from '../model/institution-codes-types';
import type {
  InstitutionCode,
  InstitutionCodeKind,
  InstitutionCodeStatus,
  InstitutionExposureMode,
  InstitutionExposureModeRow
} from '../model/institution-codes-types';
import { usePermissionStore } from '@/features/system/model/permission-store';
import { useAsyncResource } from '@/shared/model/use-async-resource';

import {
  isSideFetchFailed,
  resolveSideFetchOutcome,
  SIDE_FETCH_FAILED_LABEL,
  SIDE_FETCH_PENDING_LABEL
} from '../model/institution-side-fetch';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { SPACE } from '@/shared/styles/design-tokens';
import {
  createInfoColumnTitle,
  createStatusColumnTitle
} from '@/shared/ui/table/status-column-title';
import {
  TableActionMenu,
  type TableActionMenuItem
} from '@/shared/ui/table/table-action-menu';
import {
  createDefinedColumnFilterProps,
  createNumberSorter,
  createTextSorter
} from '@/shared/ui/table/table-column-utils';

const { Paragraph, Text } = Typography;

const pageSizeOptions = ['20', '50', '100'];
const DETAIL_BASE_PATH = '/users/institution-codes';

/**
 * Users > 기관 코드 목록. 코드 생성·수정·회원 관리·노출 문항은 전용 페이지로 분리했고
 * (`/users/institution-codes/create`, `/users/institution-codes/:code`), 이 화면에는
 * 목록 조회와 행 단위 삭제만 남는다. 삭제는 목록에서 바로 처리하는 파괴적 액션이라
 * 상세로 옮기지 않았다.
 */
export default function InstitutionCodesPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [notificationApi, notificationContextHolder] = notification.useNotification();
  const [deleteTarget, setDeleteTarget] = useState<InstitutionCode | null>(null);

  const fetchCodes = useCallback(
    (signal: AbortSignal) => fetchInstitutionCodesSafe(signal),
    []
  );
  const { state: codesState, reload: reloadCodes } = useAsyncResource<InstitutionCode[]>(
    fetchCodes,
    { initialData: [] }
  );

  // 기관별 노출 모드 원장. admin_list_institution_codes 는 반환 타입을 바꿀 수 없어
  // (expand 게이트가 drop function 차단) 별도 RPC 로 조회해 코드 목록과 병합한다.
  // 원장에 행이 없는 코드는 기본값(`배정분만`)으로 해석한다.
  // 계약 요약은 목록 RPC 와 별개다(admin_list_institution_codes 는 반환 타입을 바꿀 수
  // 없다 — expand 게이트가 함수 삭제·재생성을 차단한다). 모드 컬럼과 같은 방식으로
  // 별도 조회해 화면에서 코드별로 병합한다.
  /**
   * 🚨 부가 조회는 **조회별로** 나눈다. 이전에는 세 조회가 한 effect 에 묶여 있고 실패를
   * `result.ok ? result.data : []` 로 삼켜서, 조회 실패와 "원장에 행이 없음"이 화면에서
   * 구분되지 않았다 — 실패하면 전 코드가 `배정분만`·계약 `-` 로 보였다(둘 다 유효한
   * 도메인 상태라 틀린 값이 정상처럼 보인다). `keepDataOnError: false` 로 실패 시 데이터를
   * 비우고, 표시는 `resolveSideFetchOutcome` 이 네 갈래로 가른다.
   */
  const fetchContractStatuses = useCallback(
    (signal: AbortSignal) => fetchInstitutionContractStatusSafe(null, signal),
    []
  );
  const { state: contractStatusesState, reload: reloadContractStatuses } = useAsyncResource<
    InstitutionContractStatusSummary[]
  >(fetchContractStatuses, { initialData: [], keepDataOnError: false });
  const contractStatusByCode = useMemo(
    () => new Map(contractStatusesState.data.map((row) => [row.code, row])),
    [contractStatusesState.data]
  );

  const fetchExposureModes = useCallback(
    (signal: AbortSignal) => fetchInstitutionExposureModesSafe(signal),
    []
  );
  const { state: exposureModesState, reload: reloadExposureModes } = useAsyncResource<
    InstitutionExposureModeRow[]
  >(fetchExposureModes, { initialData: [], keepDataOnError: false });
  const exposureModeByCode = useMemo(
    () => new Map(exposureModesState.data.map((row) => [row.code, row])),
    [exposureModesState.data]
  );

  /** 조치 후에는 세 조회를 함께 다시 받는다(하나만 갱신하면 화면 안에서 기준 시각이 갈린다). */
  const reloadAll = useCallback(() => {
    reloadCodes();
    reloadContractStatuses();
    reloadExposureModes();
  }, [reloadCodes, reloadContractStatuses, reloadExposureModes]);

  const exposureModeFailed = isSideFetchFailed(
    resolveSideFetchOutcome(exposureModesState.status, null)
  );
  const contractStatusFailed = isSideFetchFailed(
    resolveSideFetchOutcome(contractStatusesState.status, null)
  );

  // 회원 배정/해제 권한(메뉴 게이팅과 동일 키). 권한 미보유자에겐 회원·노출 문항 진입점을 숨긴다.
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const canManageMembers = useMemo(() => {
    const me = admins.find((item) => item.adminId === currentAdminId);
    return me?.permissions.includes('users.institution-codes.manage') ?? false;
  }, [admins, currentAdminId]);

  // 감사 로그가 예전부터 `?selected=<code>` 로 이 화면에 딥링크한다. 상세 라우트가 생겼으니
  // 기존 링크·북마크를 상세로 흘려보낸다(구 링크는 여기서 아무 것도 열지 못했다).
  const selectedCode = searchParams.get('selected');
  useEffect(() => {
    if (!selectedCode) {
      return;
    }
    navigate(`${DETAIL_BASE_PATH}/${selectedCode}`, { replace: true });
  }, [navigate, selectedCode]);

  const summary = useMemo(
    () => ({
      total: codesState.data.length,
      active: codesState.data.filter((item) => item.status === '활성').length,
      members: codesState.data.reduce((sum, item) => sum + item.memberCount, 0)
    }),
    [codesState.data]
  );

  const openCreate = useCallback(() => {
    navigate({ pathname: `${DETAIL_BASE_PATH}/create`, search: location.search });
  }, [location.search, navigate]);

  const openDetail = useCallback(
    (code: string, tab: 'info' | 'members' | 'questions') => {
      navigate(`${DETAIL_BASE_PATH}/${code}?tab=${tab}`);
    },
    [navigate]
  );

  const openDelete = useCallback((record: InstitutionCode) => {
    setDeleteTarget(record);
  }, []);

  // 액션 메뉴 라벨 4종은 그대로 유지한다 — 운영자 동선과 e2e 단언이 이 라벨에 걸려 있고,
  // 바뀐 것은 목적지(모달 → 상세 탭)뿐이다.
  const buildCodeActionItems = useCallback(
    (record: InstitutionCode): TableActionMenuItem[] => {
      const items: TableActionMenuItem[] = [];

      if (canManageMembers) {
        items.push(
          {
            key: `members-${record.code}`,
            label: '회원 관리',
            onClick: () => openDetail(record.code, 'members')
          },
          {
            key: `questions-${record.code}`,
            label: '노출 문항',
            onClick: () => openDetail(record.code, 'questions')
          }
        );
      }

      items.push(
        {
          key: `edit-${record.code}`,
          label: '수정',
          onClick: () => openDetail(record.code, 'info')
        },
        {
          key: `delete-${record.code}`,
          label: '삭제',
          danger: true,
          disabled: record.memberCount > 0,
          title:
            record.memberCount > 0
              ? '가입 회원이 있는 코드는 먼저 회원 소속을 해제해야 합니다.'
              : undefined,
          onClick: () => openDelete(record)
        }
      );

      return items;
    },
    [canManageMembers, openDelete, openDetail]
  );

  const handleDeleteConfirm = useCallback(
    async (reason: string) => {
      if (!deleteTarget) {
        return;
      }

      const code = deleteTarget.code;
      const result = await deleteInstitutionCodeSafe({ code, reason });
      if (!result.ok) {
        notificationApi.error({
          message: '기관 코드 삭제 실패',
          description: result.error.message
        });
        return;
      }

      setDeleteTarget(null);
      reloadAll();
      notificationApi.success({
        message: '기관 코드 삭제 완료',
        description: (
          <Space direction="vertical">
            <Text>코드: {code}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink targetType="InstitutionCode" targetId={code} />
          </Space>
        )
      });
    },
    [deleteTarget, notificationApi, reloadAll]
  );

  const columns = useMemo<TableColumnsType<InstitutionCode>>(
    () => [
      {
        title: '코드',
        dataIndex: 'code',
        width: 200,
        sorter: createTextSorter((record) => record.code),
        render: (code: string) => (
          <Text strong copyable>
            {code}
          </Text>
        )
      },
      {
        title: '이름',
        dataIndex: 'label',
        width: 260,
        sorter: createTextSorter((record) => record.label)
      },
      {
        title: '종류',
        dataIndex: 'kind',
        width: 110,
        ...createDefinedColumnFilterProps(institutionCodeKinds, (record) => record.kind),
        render: (kind: InstitutionCodeKind) => <Tag>{kind}</Tag>
      },
      {
        title: createStatusColumnTitle('상태', institutionCodeStatuses),
        dataIndex: 'status',
        width: 110,
        ...createDefinedColumnFilterProps(institutionCodeStatuses, (record) => record.status),
        render: (status: InstitutionCodeStatus) => <StatusBadge status={status} />
      },
      {
        // 기관 축 설정이다 — 문항 축 라벨(`미배정`/`기관 N곳 배정`)과 다른 축이라
        // createStatusColumnTitle 의 전역 상태 사전을 쓰지 않고 값별 설명을 직접 준다.
        title: createInfoColumnTitle('노출 모드', [
          {
            label: '제한 없음',
            description:
              '이 기관 소속 학습자도 노출 허용(available) 문항을 모두 봅니다. 이후 추가되는 문항도 자동 포함됩니다. 배정 목록은 보존만 됩니다.'
          },
          {
            label: '배정분만',
            description:
              '이 기관 소속 학습자는 노출 문항에서 배정한 문항만 봅니다. 새 문항은 배정해야 보입니다.'
          }
        ]),
        dataIndex: 'code',
        key: 'exposureMode',
        width: 190,
        // 필터는 원장이 살아 있을 때만 의미가 있다 — 실패·조회 중에는 기본값으로 걸러지면
        // 실제와 다른 결과가 나오므로, 값을 아는 행만 기본값 해석에 넣는다.
        ...createDefinedColumnFilterProps(institutionExposureModes, (record) => {
          const outcome = resolveSideFetchOutcome(
            exposureModesState.status,
            exposureModeByCode.get(record.code)
          );
          return outcome.kind === 'loaded'
            ? outcome.row.exposureMode
            : defaultInstitutionExposureMode;
        }),
        render: (_code: string, record: InstitutionCode) => {
          const outcome = resolveSideFetchOutcome(
            exposureModesState.status,
            exposureModeByCode.get(record.code)
          );
          if (outcome.kind === 'pending') {
            return <Text type="secondary">{SIDE_FETCH_PENDING_LABEL}</Text>;
          }
          if (outcome.kind === 'failed') {
            // 🚨 기본값(`배정분만`)으로 그리면 제한된 기관처럼 보인다 — 실패는 실패로 적는다.
            return <Text type="secondary">{SIDE_FETCH_FAILED_LABEL}</Text>;
          }
          const mode: InstitutionExposureMode =
            outcome.kind === 'loaded'
              ? outcome.row.exposureMode
              : defaultInstitutionExposureMode;
          const assignedQuestionCount =
            outcome.kind === 'loaded' ? outcome.row.assignedQuestionCount : 0;
          return (
            <InstitutionExposureModeTag
              mode={mode}
              assignedQuestionCount={assignedQuestionCount}
            />
          );
        }
      },
      {
        // 마스터 관리자 요구: 목록에서 계약 기간과 만료 D-day 를 바로 본다. 만료된 기관을
        // 모르고 회원을 배정하거나 문항을 손대는 상황을 막는 것이 이 컬럼의 목적이다.
        title: '계약',
        dataIndex: 'code',
        key: 'contract',
        width: 220,
        render: (_code: string, record: InstitutionCode) => {
          const outcome = resolveSideFetchOutcome(
            contractStatusesState.status,
            contractStatusByCode.get(record.code)
          );
          if (outcome.kind === 'pending') {
            return <Text type="secondary">{SIDE_FETCH_PENDING_LABEL}</Text>;
          }
          if (outcome.kind === 'failed') {
            // 🚨 `-` 는 도메인에서 "계약 없음"이라는 유효한 상태다 — 실패를 그것으로 쓰면
            // 계약이 있는 기관을 없는 것처럼 보이게 한다.
            return <Text type="secondary">{SIDE_FETCH_FAILED_LABEL}</Text>;
          }
          if (outcome.kind === 'missing') {
            return <Text type="secondary">-</Text>;
          }
          return <InstitutionContractDdayBadge summary={outcome.row} showPeriod />;
        }
      },
      {
        title: '가입 수',
        dataIndex: 'memberCount',
        width: 110,
        align: 'right',
        sorter: createNumberSorter((record) => record.memberCount),
        render: (memberCount: number) => memberCount.toLocaleString()
      },
      {
        title: '생성일',
        dataIndex: 'createdAt',
        width: 130,
        sorter: createTextSorter((record) => record.createdAt)
      },
      {
        title: '액션',
        key: 'action',
        width: 120,
        onCell: () => ({
          onClick: (event) => {
            event.stopPropagation();
          }
        }),
        render: (_, record) => <TableActionMenu items={buildCodeActionItems(record)} />
      }
    ],
    [
      buildCodeActionItems,
      contractStatusByCode,
      contractStatusesState.status,
      exposureModeByCode,
      exposureModesState.status
    ]
  );

  const toolbar = (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: SPACE.sm,
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <Space size="large" wrap>
        <Text type="secondary">총 {summary.total.toLocaleString()}건</Text>
        <Text type="secondary">활성 {summary.active.toLocaleString()}건</Text>
        <Text type="secondary">누적 가입 {summary.members.toLocaleString()}명</Text>
      </Space>
      <Button type="primary" size="large" onClick={openCreate}>
        코드 생성
      </Button>
    </div>
  );

  return (
    <>
      {notificationContextHolder}
      <PageTitle title="기관 코드" />
      <Paragraph type="secondary" style={{ marginBottom: SPACE.base }}>
        박람회/기관 유입 QR에 싣는 코드를 등록·관리합니다. 회원이 이 코드를 달고 가입하면 기관 회원으로 추적됩니다.
        {!isInstitutionCodesSupabase && ' (현재 mock 데이터 — 생성/수정/삭제는 화면에만 반영됩니다.)'}
      </Paragraph>

      {exposureModeFailed ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: SPACE.sm }}
          message="노출 모드를 불러오지 못했습니다. 목록의 노출 모드 컬럼은 실제 값이 아닙니다."
          description={exposureModesState.errorMessage ?? undefined}
          action={
            <Button size="small" onClick={reloadExposureModes}>
              다시 시도
            </Button>
          }
        />
      ) : null}
      {contractStatusFailed ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: SPACE.sm }}
          message="계약 정보를 불러오지 못했습니다. 목록의 계약 컬럼은 실제 값이 아닙니다."
          description={contractStatusesState.errorMessage ?? undefined}
          action={
            <Button size="small" onClick={reloadContractStatuses}>
              다시 시도
            </Button>
          }
        />
      ) : null}

      <AdminListCard toolbar={toolbar}>
        <AdminDataTable<InstitutionCode>
          rowKey="code"
          columns={columns}
          dataSource={codesState.data}
          loading={codesState.status === 'pending'}
          onRow={(record) => ({
            onClick: () => openDetail(record.code, 'info')
          })}
          pagination={{
            pageSize: 20,
            pageSizeOptions,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total.toLocaleString()}건`
          }}
        />
      </AdminListCard>

      {deleteTarget ? (
        <ConfirmAction
          open
          title="기관 코드 삭제"
          description={`${deleteTarget.code} 코드를 삭제합니다. 가입 수가 1명 이상이면 서버에서 삭제를 차단하며, 삭제된 코드는 가입/QR 유입과 기관별 쓰기 문항 배정 대상에서 더 이상 사용할 수 없습니다.`}
          targetType="InstitutionCode"
          targetId={deleteTarget.code}
          confirmText="삭제 실행"
          reasonPlaceholder="삭제 사유를 입력하세요."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}
    </>
  );
}
