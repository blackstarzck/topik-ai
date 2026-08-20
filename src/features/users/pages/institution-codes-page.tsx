import { Button, Space, Tag, Typography, notification } from 'antd';
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
import type { AsyncState } from '@/shared/model/async-state';
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
  const [codesState, setCodesState] = useState<AsyncState<InstitutionCode[]>>({
    status: 'pending',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<InstitutionCode | null>(null);

  // 기관별 노출 모드 원장. admin_list_institution_codes 는 반환 타입을 바꿀 수 없어
  // (expand 게이트가 drop function 차단) 별도 RPC 로 조회해 코드 목록과 병합한다.
  // 원장에 행이 없는 코드는 기본값(`배정분만`)으로 해석한다.
  // 계약 요약은 목록 RPC 와 별개다(admin_list_institution_codes 는 반환 타입을 바꿀 수
  // 없다 — expand 게이트가 함수 삭제·재생성을 차단한다). 모드 컬럼과 같은 방식으로
  // 별도 조회해 화면에서 코드별로 병합한다.
  const [contractStatuses, setContractStatuses] = useState<
    InstitutionContractStatusSummary[]
  >([]);
  const contractStatusByCode = useMemo(
    () => new Map(contractStatuses.map((row) => [row.code, row])),
    [contractStatuses]
  );

  const [exposureModes, setExposureModes] = useState<InstitutionExposureModeRow[]>([]);
  const exposureModeByCode = useMemo(
    () => new Map(exposureModes.map((row) => [row.code, row])),
    [exposureModes]
  );
  const resolveExposureMode = useCallback(
    (code: string): InstitutionExposureMode =>
      exposureModeByCode.get(code)?.exposureMode ?? defaultInstitutionExposureMode,
    [exposureModeByCode]
  );
  const resolveAssignedCount = useCallback(
    (code: string): number => exposureModeByCode.get(code)?.assignedQuestionCount ?? 0,
    [exposureModeByCode]
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

  useEffect(() => {
    const controller = new AbortController();

    setCodesState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchInstitutionCodesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (result.ok) {
        setCodesState({
          status: result.data.length === 0 ? 'empty' : 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }

      setCodesState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: result.error.message,
        errorCode: result.error.code
      }));
    });

    // 모드 원장은 목록과 독립적으로 실패할 수 있다. 실패하면 전 코드가 기본값
    // (`배정분만`)으로 표시되며 목록 자체는 계속 동작한다 — 노출 모드는 부가 정보다.
    void fetchInstitutionExposureModesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      setExposureModes(result.ok ? result.data : []);
    });

    // 계약 요약도 독립적으로 실패할 수 있다. 실패하면 계약 컬럼이 비고 목록은 계속 쓴다.
    void fetchInstitutionContractStatusSafe(null, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      setContractStatuses(result.ok ? result.data : []);
    });

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

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
      setReloadKey((prev) => prev + 1);
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
    [deleteTarget, notificationApi]
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
        ...createDefinedColumnFilterProps(institutionExposureModes, (record) =>
          resolveExposureMode(record.code)
        ),
        render: (_code: string, record: InstitutionCode) => (
          <InstitutionExposureModeTag
            mode={resolveExposureMode(record.code)}
            assignedQuestionCount={resolveAssignedCount(record.code)}
          />
        )
      },
      {
        // 마스터 관리자 요구: 목록에서 계약 기간과 만료 D-day 를 바로 본다. 만료된 기관을
        // 모르고 회원을 배정하거나 문항을 손대는 상황을 막는 것이 이 컬럼의 목적이다.
        title: '계약',
        dataIndex: 'code',
        key: 'contract',
        width: 220,
        render: (_code: string, record: InstitutionCode) => {
          const summary = contractStatusByCode.get(record.code);
          if (!summary) {
            return <Text type="secondary">-</Text>;
          }
          return <InstitutionContractDdayBadge summary={summary} showPeriod />;
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
    [buildCodeActionItems, contractStatusByCode, resolveAssignedCount, resolveExposureMode]
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
