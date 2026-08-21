import { Alert, Button, Space, Tabs, Tag, Typography, notification } from 'antd';
import { useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  fetchInstitutionCodeSafe,
  fetchInstitutionExposureModesSafe,
  isInstitutionCodesSupabase
} from '../api/institution-codes-service';
import {
  fetchInstitutionContractStatusSafe,
  fetchInstitutionExposureOptionsSafe,
  fetchInstitutionSettingsSafe
} from '../api/institution-contracts-service';
import { defaultInstitutionExposureMode } from '../model/institution-codes-types';
import type {
  InstitutionCode,
  InstitutionExposureModeRow
} from '../model/institution-codes-types';
import type {
  InstitutionContractStatusSummary,
  InstitutionExposureOptions,
  InstitutionSettings
} from '../model/institution-contracts-types';
import { InstitutionContractDdayBadge } from '../ui/institution-contract-dday-badge';
import { InstitutionCodeContractTab } from '../ui/institution-code-detail/institution-code-contract-tab';
import { InstitutionCodeInfoTab } from '../ui/institution-code-detail/institution-code-info-tab';
import { InstitutionCodeMembersTab } from '../ui/institution-code-detail/institution-code-members-tab';
import { InstitutionCodeQuestionsTab } from '../ui/institution-code-detail/institution-code-questions-tab';
import { usePermissionStore } from '@/features/system/model/permission-store';
import { useAsyncResource } from '@/shared/model/use-async-resource';

import { resolveSideFetchOutcome } from '../model/institution-side-fetch';
import { useRouterStateNotice } from '@/shared/model/use-router-state-notice';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import { StatusBadge } from '@/shared/ui/status-badge/status-badge';
import { SPACE } from '@/shared/styles/design-tokens';

const { Paragraph, Text } = Typography;

const DETAIL_TAB_KEYS = ['info', 'contract', 'members', 'questions'] as const;
type InstitutionCodeDetailTabKey = (typeof DETAIL_TAB_KEYS)[number];

function isDetailTab(value: string | null): value is InstitutionCodeDetailTabKey {
  return value !== null && (DETAIL_TAB_KEYS as readonly string[]).includes(value);
}

/**
 * 기관 코드 상세 — 구 목록 화면의 수정/회원 관리/노출 문항 모달 3개를 탭으로 승격한 셸이다.
 *
 * 코드 메타와 노출 모드 원장 행을 여기서 한 번 조회해 탭에 내린다. 탭 안에서 무엇이 바뀌든
 * `onChanged` 로 이 셸이 재조회하므로, 배정 건수·회원 수처럼 여러 탭이 함께 읽는 값이
 * stale 해지지 않는다(구 모달의 `setReloadKey` 상승 경로를 그대로 옮긴 것).
 */
export default function InstitutionCodeDetailPage(): JSX.Element {
  const { code = '' } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  /**
   * 조회 5개를 **각각** 훅으로 나눈다.
   *
   * 이전에는 한 effect 에 묶여 있고 부가 조회 4개가 실패를 `null` 로 삼켜서, 화면이 "조회
   * 실패"와 "원장에 행이 없음"을 구분하지 못했다 — 특히 노출 모드는 실패 시 도메인 기본값
   * `배정분만` 으로 해석돼 **제한된 기관처럼** 보였다(gap-register §3.13 ⑤).
   *
   * 계약 요약·운영 설정·노출 옵션은 여러 탭이 함께 읽으므로 셸에서 한 번 읽어 내린다
   * (탭을 옮길 때마다 다시 받거나 서로 stale 해지지 않게).
   */
  const fetchCode = useCallback(
    (signal: AbortSignal) => fetchInstitutionCodeSafe(code, signal),
    [code]
  );
  const { state: codeState, reload: reloadCode } = useAsyncResource<InstitutionCode | null>(
    fetchCode,
    { initialData: null, enabled: Boolean(code), keepDataOnError: false }
  );

  const fetchExposureModes = useCallback(
    (signal: AbortSignal) => fetchInstitutionExposureModesSafe(signal),
    []
  );
  const { state: exposureModesState, reload: reloadExposureModes } = useAsyncResource<
    InstitutionExposureModeRow[]
  >(fetchExposureModes, { initialData: [], enabled: Boolean(code), keepDataOnError: false });

  const fetchContractStatus = useCallback(
    (signal: AbortSignal) => fetchInstitutionContractStatusSafe(code, signal),
    [code]
  );
  const { state: contractStatusState, reload: reloadContractStatus } = useAsyncResource<
    InstitutionContractStatusSummary[]
  >(fetchContractStatus, { initialData: [], enabled: Boolean(code), keepDataOnError: false });

  const fetchSettings = useCallback(
    (signal: AbortSignal) => fetchInstitutionSettingsSafe(code, signal),
    [code]
  );
  const { state: settingsState, reload: reloadSettings } =
    useAsyncResource<InstitutionSettings | null>(fetchSettings, {
      initialData: null,
      enabled: Boolean(code),
      keepDataOnError: false
    });

  const fetchExposureOptions = useCallback(
    (signal: AbortSignal) => fetchInstitutionExposureOptionsSafe(code, signal),
    [code]
  );
  const { state: exposureOptionsState, reload: reloadExposureOptions } =
    useAsyncResource<InstitutionExposureOptions | null>(fetchExposureOptions, {
      initialData: null,
      enabled: Boolean(code),
      keepDataOnError: false
    });

  const reloadAll = useCallback(() => {
    reloadCode();
    reloadExposureModes();
    reloadContractStatus();
    reloadSettings();
    reloadExposureOptions();
  }, [
    reloadCode,
    reloadContractStatus,
    reloadExposureModes,
    reloadExposureOptions,
    reloadSettings
  ]);

  const listPath = '/users/institution-codes';

  // 회원 배정/해제 권한(메뉴 게이팅과 동일 키). 코드 수정(is_admin)과 달리 회원 관리는
  // platform_admin RPC라, 권한 미보유자에겐 회원 관리 컨트롤을 숨긴다.
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const canManageMembers = useMemo(() => {
    const me = admins.find((item) => item.adminId === currentAdminId);
    return me?.permissions.includes('users.institution-codes.manage') ?? false;
  }, [admins, currentAdminId]);

  // 생성 페이지는 성공 알림을 자기 화면에서 띄울 수 없다(즉시 이동으로 contextHolder 가
  // 사라진다). router state 로 받아 여기서 한 번만 띄운다 — 소비 기록과 state 초기화 계약은
  // 공용 훅이 담당한다(gap-register §3.8).
  useRouterStateNotice(
    'institutionCodeCreated',
    (created) => created.code,
    (created) => {
      notificationApi.success({
        message: '기관 코드 생성 완료',
        description: (
          <Space direction="vertical">
            <Text>코드: {created.code}</Text>
            <Text>이름: {created.label}</Text>
            <AuditLogLink targetType="InstitutionCode" targetId={created.code} />
          </Space>
        )
      });
    }
  );

  const activeTab = useMemo<InstitutionCodeDetailTabKey>(() => {
    const tab = searchParams.get('tab');
    return isDetailTab(tab) ? tab : 'info';
  }, [searchParams]);

  const handleTabChange = useCallback(
    (nextTab: string) => {
      if (!isDetailTab(nextTab)) {
        return;
      }
      const next = new URLSearchParams(searchParams);
      next.set('tab', nextTab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleChanged = useCallback(() => {
    reloadAll();
  }, [reloadAll]);

  const handleBackToList = useCallback(() => {
    navigate(listPath);
  }, [navigate]);

  /**
   * 🚨 코드가 바뀌는 동안(재조회 pending)에는 **직전 코드의 값을 쓰지 않는다** — 훅은 재조회
   * 중 직전 데이터를 유지하므로, 그대로 그리면 다른 기관의 이름·상태가 잠깐 보인다.
   */
  const institution = codeState.data?.code === code ? codeState.data : null;

  const exposureModeOutcome = resolveSideFetchOutcome(
    exposureModesState.status,
    exposureModesState.data.find((row) => row.code === code)
  );
  // 실패면 도메인 기본값으로 해석하지 않는다 — 표시는 탭이 '조회 실패'로 그린다.
  const exposureMode =
    exposureModeOutcome.kind === 'loaded'
      ? exposureModeOutcome.row.exposureMode
      : defaultInstitutionExposureMode;
  const assignedQuestionCount =
    exposureModeOutcome.kind === 'loaded' ? exposureModeOutcome.row.assignedQuestionCount : 0;

  const contractOutcome = resolveSideFetchOutcome(
    contractStatusState.status,
    contractStatusState.data.find((row) => row.code === code)
  );
  const contractStatus = contractOutcome.kind === 'loaded' ? contractOutcome.row : null;
  const settings = settingsState.data;
  const exposureOptions = exposureOptionsState.data;

  /** 부가 조회 실패 안내 — 어떤 값이 실제가 아닌지 이름으로 알린다. */
  const sideFetchFailures = [
    exposureModeOutcome.kind === 'failed'
      ? {
          key: 'exposureMode',
          label: '노출 모드',
          message: exposureModesState.errorMessage,
          retry: reloadExposureModes
        }
      : null,
    contractOutcome.kind === 'failed'
      ? {
          key: 'contract',
          label: '계약 정보',
          message: contractStatusState.errorMessage,
          retry: reloadContractStatus
        }
      : null,
    settingsState.status === 'error'
      ? {
          key: 'settings',
          label: '운영 설정(담당자·정원·초대 기본값)',
          message: settingsState.errorMessage,
          retry: reloadSettings
        }
      : null,
    exposureOptionsState.status === 'error'
      ? {
          key: 'exposureOptions',
          label: '노출 옵션',
          message: exposureOptionsState.errorMessage,
          retry: reloadExposureOptions
        }
      : null
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (codeState.status === 'error' || (codeState.status === 'success' && !codeState.data)) {
    return (
      <>
        <PageTitle title="기관 코드 상세" />
        <AdminListCard>
          <Alert
            type="error"
            showIcon
            message={codeState.errorMessage ?? `기관 코드를 찾을 수 없습니다: ${code}`}
            description="삭제되었거나 주소가 잘못되었을 수 있습니다."
          />
          <Button style={{ marginTop: SPACE.sm }} onClick={handleBackToList}>
            기관 코드 목록으로
          </Button>
        </AdminListCard>
      </>
    );
  }

  return (
    <>
      {notificationContextHolder}
      <PageTitle title={`기관 코드 · ${code}`} />
      <Paragraph type="secondary" style={{ marginBottom: SPACE.base }}>
        <Space size={8} wrap>
          <Text type="secondary">{institution?.label ?? '불러오는 중…'}</Text>
          {institution ? <StatusBadge status={institution.status} /> : null}
          {institution ? <Tag>{institution.kind}</Tag> : null}
          {institution ? (
            <Text type="secondary">
              가입 {institution.memberCount.toLocaleString()}명
            </Text>
          ) : null}
          {/* 계약 상태는 어느 탭에 있든 보여야 한다 — 만료된 기관을 모르고 회원을
              배정하거나 문항을 손대는 것이 이 기능이 막으려는 상황이다. */}
          {contractStatus ? (
            <InstitutionContractDdayBadge summary={contractStatus} showPeriod />
          ) : null}
        </Space>
        {!isInstitutionCodesSupabase ? (
          <Text type="secondary" style={{ display: 'block', marginTop: SPACE.xxs }}>
            현재 mock 데이터 — 변경은 화면에만 반영됩니다.
          </Text>
        ) : null}
      </Paragraph>

      {sideFetchFailures.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: SPACE.sm }}
          // 라벨을 문장에 붙이면 조사(을/를)를 맞출 수 없다 — 목록 형태로 적는다.
          message={`불러오지 못한 항목: ${sideFetchFailures
            .map((entry) => entry.label)
            .join(', ')}. 해당 값은 실제가 아닙니다.`}
          description={sideFetchFailures.find((entry) => entry.message)?.message ?? undefined}
          action={
            <Space size={4}>
              {sideFetchFailures.map((entry) => (
                <Button key={entry.key} size="small" onClick={entry.retry}>
                  {entry.label} 다시 시도
                </Button>
              ))}
            </Space>
          }
        />
      ) : null}

      <AdminListCard>
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          destroyOnHidden
          items={[
            {
              key: 'info',
              label: '기본 정보',
              children: institution ? (
                <InstitutionCodeInfoTab
                  institution={institution}
                  settings={settings}
                  canManage={canManageMembers}
                  notificationApi={notificationApi}
                  onChanged={handleChanged}
                />
              ) : null
            },
            {
              key: 'contract',
              label: '계약',
              children: institution ? (
                <InstitutionCodeContractTab
                  institution={institution}
                  contractStatus={contractStatus}
                  canManage={canManageMembers}
                  notificationApi={notificationApi}
                  onChanged={handleChanged}
                />
              ) : null
            },
            {
              key: 'members',
              label: '회원',
              children: institution ? (
                <InstitutionCodeMembersTab
                  institution={institution}
                  settings={settings}
                  contractStatus={contractStatus}
                  canManage={canManageMembers}
                  notificationApi={notificationApi}
                  onChanged={handleChanged}
                />
              ) : null
            },
            {
              key: 'questions',
              label: '노출 문항',
              children: institution ? (
                <InstitutionCodeQuestionsTab
                  institution={institution}
                  exposureMode={exposureMode}
                  exposureModeUnavailable={exposureModeOutcome.kind !== 'loaded' && exposureModeOutcome.kind !== 'missing'}
                  assignedQuestionCount={assignedQuestionCount}
                  exposureOptions={exposureOptions}
                  contractStatus={contractStatus}
                  canManage={canManageMembers}
                  notificationApi={notificationApi}
                  onChanged={handleChanged}
                />
              ) : null
            }
          ]}
        />
      </AdminListCard>
    </>
  );
}
