import { Alert, Button, Space, Tabs, Tag, Typography, notification } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import {
  fetchInstitutionCodeSafe,
  fetchInstitutionExposureModesSafe,
  isInstitutionCodesSupabase
} from '../api/institution-codes-service';
import { defaultInstitutionExposureMode } from '../model/institution-codes-types';
import type {
  InstitutionCode,
  InstitutionExposureModeRow
} from '../model/institution-codes-types';
import { InstitutionCodeInfoTab } from '../ui/institution-code-detail/institution-code-info-tab';
import { InstitutionCodeMembersTab } from '../ui/institution-code-detail/institution-code-members-tab';
import { InstitutionCodeQuestionsTab } from '../ui/institution-code-detail/institution-code-questions-tab';
import { usePermissionStore } from '../../system/model/permission-store';
import type { AsyncState } from '../../../shared/model/async-state';
import { AuditLogLink } from '../../../shared/ui/audit-log-link/audit-log-link';
import { AdminListCard } from '../../../shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '../../../shared/ui/page-title/page-title';
import { StatusBadge } from '../../../shared/ui/status-badge/status-badge';

const { Paragraph, Text } = Typography;

const DETAIL_TAB_KEYS = ['info', 'members', 'questions'] as const;
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notificationApi, notificationContextHolder] = notification.useNotification();

  const [codeState, setCodeState] = useState<AsyncState<InstitutionCode | null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [exposureModeRow, setExposureModeRow] = useState<InstitutionExposureModeRow | null>(
    null
  );
  const [reloadKey, setReloadKey] = useState(0);

  const listPath = '/users/institution-codes';

  // 회원 배정/해제 권한(메뉴 게이팅과 동일 키). 코드 수정(is_admin)과 달리 회원 관리는
  // platform_admin RPC라, 권한 미보유자에겐 회원 관리 컨트롤을 숨긴다.
  const currentAdminId = usePermissionStore((state) => state.currentAdminId);
  const admins = usePermissionStore((state) => state.admins);
  const canManageMembers = useMemo(() => {
    const me = admins.find((item) => item.adminId === currentAdminId);
    return me?.permissions.includes('users.institution-codes.manage') ?? false;
  }, [admins, currentAdminId]);

  useEffect(() => {
    if (!code) {
      return;
    }
    const controller = new AbortController();

    setCodeState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchInstitutionCodeSafe(code, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (result.ok) {
        setCodeState({
          status: 'success',
          data: result.data,
          errorMessage: null,
          errorCode: null
        });
        return;
      }
      setCodeState({
        status: 'error',
        data: null,
        errorMessage: result.error.message,
        errorCode: result.error.code
      });
    });

    // 모드 원장은 코드 조회와 독립적으로 실패할 수 있다. 실패하면 기본값(`배정분만`)으로
    // 해석되며 나머지 탭은 계속 동작한다 — 노출 모드는 부가 정보다.
    void fetchInstitutionExposureModesSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      setExposureModeRow(
        result.ok ? (result.data.find((row) => row.code === code) ?? null) : null
      );
    });

    return () => {
      controller.abort();
    };
  }, [code, reloadKey]);

  // 생성 페이지는 성공 알림을 자기 화면에서 띄울 수 없다(즉시 이동으로 contextHolder 가
  // 사라진다). 공지 등록 선례처럼 router state 로 받아 여기서 띄운다.
  //
  // ref 가드가 필요한 이유: StrictMode 는 effect 를 두 번 실행하고, 두 번째 실행은
  // `navigate(state: null)` 이 반영되기 전에 같은 state 를 다시 본다 → 알림 2개.
  // (같은 패턴의 공지 목록 화면에는 이 가드가 없어 dev 에서 2개가 뜬다.)
  const notifiedCreatedCodeRef = useRef<string | null>(null);
  useEffect(() => {
    const state = location.state as
      | { institutionCodeCreated?: { code: string; label: string } }
      | null;
    if (!state?.institutionCodeCreated) {
      return;
    }
    const created = state.institutionCodeCreated;
    if (notifiedCreatedCodeRef.current === created.code) {
      return;
    }
    notifiedCreatedCodeRef.current = created.code;
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
    // 새로고침·뒤로 가기에서 같은 알림이 되살아나지 않게 state 를 비운다.
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate, notificationApi]);

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
    setReloadKey((prev) => prev + 1);
  }, []);

  const handleBackToList = useCallback(() => {
    navigate(listPath);
  }, [navigate]);

  const institution = codeState.data;
  const exposureMode = exposureModeRow?.exposureMode ?? defaultInstitutionExposureMode;
  const assignedQuestionCount = exposureModeRow?.assignedQuestionCount ?? 0;

  if (codeState.status === 'error' || (codeState.status === 'success' && !institution)) {
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
          <Button style={{ marginTop: 12 }} onClick={handleBackToList}>
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
      <Paragraph type="secondary" style={{ marginBottom: 16 }}>
        <Space size={8} wrap>
          <Text type="secondary">{institution?.label ?? '불러오는 중…'}</Text>
          {institution ? <StatusBadge status={institution.status} /> : null}
          {institution ? <Tag>{institution.kind}</Tag> : null}
          {institution ? (
            <Text type="secondary">
              가입 {institution.memberCount.toLocaleString()}명
            </Text>
          ) : null}
        </Space>
        {!isInstitutionCodesSupabase ? (
          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
            현재 mock 데이터 — 변경은 화면에만 반영됩니다.
          </Text>
        ) : null}
      </Paragraph>

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
                  assignedQuestionCount={assignedQuestionCount}
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
