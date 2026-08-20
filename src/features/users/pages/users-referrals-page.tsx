import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Row,
  Space,
  Typography,
  notification
} from 'antd';
import type {
  FilterValue,
  TablePaginationConfig
} from 'antd/es/table/interface';
import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAsyncResource } from '@/shared/model/use-async-resource';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  adjustReferralRewardSafe,
  fetchReferralsSafe,
  isReferralsSupabase,
  reviewReferralAnomalySafe,
  setReferralStatusSafe
} from '../api/referrals-service';
import { useReferralsQueryStore } from '../model/referrals-query-store';
import type {
  ReferralQuery,
  ReferralRewardLedgerEntry,
  ReferralSearchField,
  ReferralSummary
} from '../model/referrals-types';
import {
  buildReferralSearchParams,
  filterReferrals,
  formatCurrentDateTime,
  formatRewardAmount,
  getAdjustmentEntryType,
  pageSizeOptions,
  parseAnomalyFilter,
  parseReferralQuery,
  parseStatusFilter,
  searchFieldOptions,
  type ReferralActionState,
  type ReferralRewardAdjustmentFormValues
} from '../model/users-referrals-page-schema';
import { createReferralColumns } from '../ui/users-referrals-columns';
import { ReferralAdjustmentModal } from '../ui/users-referrals-adjustment-modal';
import { ReferralDetailDrawer } from '../ui/users-referrals-detail-drawer';
import { AuditLogLink } from '@/shared/ui/audit-log-link/audit-log-link';
import { ConfirmAction } from '@/shared/ui/confirm-action/confirm-action';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import {
  SearchBar,
  SearchBarDateRange,
  SearchBarDetailField
} from '@/shared/ui/search-bar/search-bar';
import { useSearchBarDateDraft } from '@/shared/ui/search-bar/use-search-bar-date-draft';
import { AdminDataTable } from '@/shared/ui/table/admin-data-table';
import { FONT_SIZE, SPACE } from '@/shared/styles/design-tokens';

const { Paragraph, Text, Title } = Typography;


export default function UsersReferralsPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const selectedReferralId = searchParams.get('selected') ?? '';
  const query = useReferralsQueryStore((state) => state.query);
  const replaceQuery = useReferralsQueryStore((state) => state.replaceQuery);
  const setQuery = useReferralsQueryStore((state) => state.setQuery);
  const fetchReferrals = useCallback(
    (signal: AbortSignal) => fetchReferralsSafe(signal),
    []
  );
  // 페이지 이동(query.page/pageSize) 시 전체 목록 재조회하던 기존 deps 는 오너 확인
  // (2026-08-19)으로 제거 — fetch 가 페이지 값을 쓰지 않아 같은 데이터를 재수신했다.
  const {
    state: referralsState,
    reload: reloadReferrals,
    mutate: mutateReferrals
  } = useAsyncResource<ReferralSummary[]>(fetchReferrals, { initialData: [] });
  const [actionState, setActionState] = useState<ReferralActionState>(null);
  const [adjustmentTarget, setAdjustmentTarget] = useState<ReferralSummary | null>(
    null
  );
  const [adjustmentForm] = Form.useForm<ReferralRewardAdjustmentFormValues>();
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
    replaceQuery(parseReferralQuery(searchParams));
  }, [replaceQuery, searchParams]);


  const commitQuery = useCallback(
    (next: Partial<ReferralQuery>) => {
      const merged = { ...query, ...next };
      setQuery(next);
      setSearchParams(
        buildReferralSearchParams(merged, selectedReferralId || undefined),
        { replace: true }
      );
    },
    [query, selectedReferralId, setQuery, setSearchParams]
  );

  const visibleReferrals = useMemo(
    () => filterReferrals(referralsState.data, query),
    [query, referralsState.data]
  );

  const selectedReferral = useMemo(
    () =>
      referralsState.data.find((item) => item.id === selectedReferralId) ?? null,
    [referralsState.data, selectedReferralId]
  );

  const summary = useMemo(
    () => ({
      activeCodeCount: referralsState.data.filter((item) => item.status === '활성')
        .length,
      totalReferralCount: referralsState.data.reduce(
        (total, item) => total + item.referredCount,
        0
      ),
      rewardPayoutCount: referralsState.data.reduce(
        (total, item) =>
          total +
          item.rewardLedger.filter((entry) => entry.status === '완료').length,
        0
      ),
      reviewNeededCount: referralsState.data.filter(
        (item) => item.anomalyStatus === '검토 필요'
      ).length
    }),
    [referralsState.data]
  );

  const openDrawer = useCallback(
    (referralId: string) => {
      setSearchParams(buildReferralSearchParams(query, referralId), {
        replace: true
      });
    },
    [query, setSearchParams]
  );

  const closeDrawer = useCallback(() => {
    setSearchParams(buildReferralSearchParams(query), { replace: true });
  }, [query, setSearchParams]);

  const openPointsPage = useCallback(
    (userId: string) => {
      navigate(`/commerce/points?keyword=${encodeURIComponent(userId)}`);
    },
    [navigate]
  );

  const handleDeactivate = useCallback((referral: ReferralSummary) => {
    setActionState({ type: 'deactivate', referral });
  }, []);

  const handleActivate = useCallback((referral: ReferralSummary) => {
    setActionState({ type: 'activate', referral });
  }, []);

  const handleReviewAnomaly = useCallback((referral: ReferralSummary) => {
    setActionState({ type: 'review-anomaly', referral });
  }, []);

  const handleOpenAdjustment = useCallback(
    (referral: ReferralSummary) => {
      setAdjustmentTarget(referral);
      adjustmentForm.setFieldsValue({
        amount: 1000,
        reason: ''
      });
    },
    [adjustmentForm]
  );

  const closeAction = useCallback(() => {
    setActionState(null);
  }, []);

  const closeAdjustmentModal = useCallback(() => {
    setAdjustmentTarget(null);
  }, []);

  const handleConfirmAction = useCallback(
    async (reason: string) => {
      if (!actionState) {
        return;
      }

      const actionLabelMap = {
        deactivate: '추천 코드 비활성화',
        activate: '추천 코드 재활성화',
        'review-anomaly': '이상치 검토 완료 처리'
      } as const;

      if (isReferralsSupabase) {
        const result =
          actionState.type === 'review-anomaly'
            ? await reviewReferralAnomalySafe({
                referralId: actionState.referral.id,
                reason
              })
            : await setReferralStatusSafe({
                referralId: actionState.referral.id,
                nextStatus: actionState.type === 'deactivate' ? '비활성' : '활성',
                reason
              });

        if (!result.ok) {
          notificationApi.error({
            message: `${actionLabelMap[actionState.type]} 실패`,
            description: result.error.message
          });
          setActionState(null);
          return;
        }

        // DB 반영분을 다시 불러와 화면을 동기화한다.
        reloadReferrals();
      } else {
        mutateReferrals((data) =>
          data.map((item) => {
            if (item.id !== actionState.referral.id) {
              return item;
            }

            if (actionState.type === 'review-anomaly') {
              return {
                ...item,
                // as const 없이는 리터럴이 string 으로 넓어져 ReferralSummary 에 안 맞는다.
                anomalyStatus: '검토 완료' as const,
                lastActionAt: formatCurrentDateTime(),
                adminMemo: `${item.adminMemo}\n- ${formatCurrentDateTime()} 이상치 검토 완료: ${reason}`
              };
            }

            return {
              ...item,
              status:
                actionState.type === 'deactivate'
                  ? ('비활성' as const)
                  : ('활성' as const),
              lastActionAt: formatCurrentDateTime()
            };
          })
        );
      }

      notificationApi.success({
        message: `${actionLabelMap[actionState.type]} 완료`,
        description: (
          <Space direction="vertical">
            <Text>대상 유형: 추천인</Text>
            <Text>대상 ID: {actionState.referral.id}</Text>
            <Text>사유/근거: {reason}</Text>
            <AuditLogLink
              targetType="Referral"
              targetId={actionState.referral.id}
            />
          </Space>
        )
      });

      setActionState(null);
    },
    [actionState, mutateReferrals, notificationApi, reloadReferrals]
  );

  const handleSubmitAdjustment = useCallback(async () => {
    if (!adjustmentTarget) {
      return;
    }

    const values = await adjustmentForm.validateFields();
    const reason = values.reason.trim();
    let adjustmentId = `ADJ-${Date.now()}`;

    if (isReferralsSupabase) {
      const result = await adjustReferralRewardSafe({
        referralId: adjustmentTarget.id,
        amount: values.amount,
        reason
      });

      if (!result.ok) {
        notificationApi.error({
          message: '보상 수동 조정 실패',
          description: result.error.message
        });
        return; // 모달 유지 — 사유/금액 수정 후 재시도
      }

      adjustmentId = result.data; // RPC가 생성한 원장 ID
      reloadReferrals();
    } else {
      const entryType = getAdjustmentEntryType(values.amount);
      const nextEntry: ReferralRewardLedgerEntry = {
        id: adjustmentId,
        relationId: '',
        entryType,
        rewardMethodLabel: '정책 미확정',
        amount: values.amount,
        status: '완료',
        actedAt: formatCurrentDateTime(),
        reason
      };

      mutateReferrals((data) =>
        data.map((item) => {
          if (item.id !== adjustmentTarget.id) {
            return item;
          }

          const rewardLedger = [nextEntry, ...item.rewardLedger];
          return {
            ...item,
            rewardLedger,
            totalRewardAmount: item.totalRewardAmount + values.amount,
            lastActionAt: nextEntry.actedAt
          };
        })
      );
    }

    notificationApi.success({
      message: '보상 수동 조정 완료',
      description: (
        <Space direction="vertical">
          <Text>대상 유형: 추천인</Text>
          <Text>대상 ID: {adjustmentTarget.id}</Text>
          <Text>조정 ID: {adjustmentId}</Text>
          <Text>조정 금액: {formatRewardAmount(values.amount)}</Text>
          <Text>사유/근거: {values.reason.trim()}</Text>
          <AuditLogLink targetType="Referral" targetId={adjustmentTarget.id} />
        </Space>
      )
    });

    setAdjustmentTarget(null);
  }, [adjustmentForm, adjustmentTarget, mutateReferrals, notificationApi, reloadReferrals]);

  const handleRetryLoad = useCallback(() => {
    reloadReferrals();
  }, [reloadReferrals]);

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
        searchField: value as ReferralSearchField,
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

  const handleTableChange = useCallback(
    (
      pagination: TablePaginationConfig,
      filters: Record<string, FilterValue | null>
    ) => {
      const nextStatus = parseStatusFilter(
        typeof filters.status?.[0] === 'string' ? String(filters.status[0]) : null
      );
      const nextAnomalyStatus = parseAnomalyFilter(
        typeof filters.anomalyStatus?.[0] === 'string'
          ? String(filters.anomalyStatus[0])
          : null
      );

      commitQuery({
        page: pagination.current ?? query.page,
        pageSize: pagination.pageSize ?? query.pageSize,
        status: nextStatus,
        anomalyStatus: nextAnomalyStatus
      });
    },
    [commitQuery, query.page, query.pageSize]
  );

  const columns = useMemo(
    () =>
      createReferralColumns({
        statusFilter: query.status,
        anomalyFilter: query.anomalyStatus,
        onDeactivate: handleDeactivate,
        onActivate: handleActivate,
        onReviewAnomaly: handleReviewAnomaly,
        onOpenAdjustment: handleOpenAdjustment,
        onOpenPoints: openPointsPage
      }),
    [
      handleActivate,
      handleDeactivate,
      handleOpenAdjustment,
      handleReviewAnomaly,
      openPointsPage,
      query.anomalyStatus,
      query.status,
    ]
  );

  const handleRowClick = useCallback(
    (record: ReferralSummary) => ({
      onClick: () => openDrawer(record.id),
      style: { cursor: 'pointer' }
    }),
    [openDrawer]
  );

  return (
    <div>
      {notificationContextHolder}
      <PageTitle title="추천인 관리" />

      <Paragraph type="secondary" style={{ marginBottom: SPACE.base }}>
        추천 코드, 추천 관계, 보상 원장을 같은 운영 흐름에서 관리합니다. 사용자
        화면은 아직 구현되지 않았기 때문에, 이 화면의 상태값과 조치 이력은 향후
        가입 프로모션, 친구 초대, 보상 내역 UI의 기준 데이터로 사용됩니다.
      </Paragraph>

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: SPACE.base }}
        message="미확정 정책 확인 필요"
        description={
          <Space direction="vertical" size={4}>
            <Text>추천 확정 시점: 가입 완료 / 첫 결제 / 첫 학습 완료 중 미확정</Text>
            <Text>보상 수단: 포인트 / 쿠폰 / 혼합 중 미확정</Text>
            <Text>수동 보정 권한과 회수 규칙: 별도 권한 분리 여부 및 취소 조건 미확정</Text>
          </Space>
        }
      />

      {referralsState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: SPACE.sm }}
          message="추천인 목록 조회에 실패했습니다."
          description={
            <Space direction="vertical" size={4}>
              <Text>
                {referralsState.errorMessage ?? '일시적인 오류가 발생했습니다.'}
              </Text>
              <Text type="secondary">
                오류 코드: {referralsState.errorCode ?? '-'}
              </Text>
              <Space>
                <Button onClick={handleRetryLoad}>재시도</Button>
                <Text type="secondary">마지막 성공 데이터는 유지됩니다.</Text>
              </Space>
            </Space>
          }
        />
      ) : null}

      <Row gutter={[16, 16]} style={{ marginBottom: SPACE.base }}>
        <Col xs={24} md={6}>
          <Card>
            <Title level={5} style={{ marginTop: 0, marginBottom: SPACE.xs }}>
              활성 코드 수
            </Title>
            <Text strong style={{ fontSize: FONT_SIZE.metric }}>
              {summary.activeCodeCount.toLocaleString()}건
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Title level={5} style={{ marginTop: 0, marginBottom: SPACE.xs }}>
              총 추천 수
            </Title>
            <Text strong style={{ fontSize: FONT_SIZE.metric }}>
              {summary.totalReferralCount.toLocaleString()}건
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Title level={5} style={{ marginTop: 0, marginBottom: SPACE.xs }}>
              보상 지급 건수
            </Title>
            <Text strong style={{ fontSize: FONT_SIZE.metric }}>
              {summary.rewardPayoutCount.toLocaleString()}건
            </Text>
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card>
            <Title level={5} style={{ marginTop: 0, marginBottom: SPACE.xs }}>
              검토 필요 건수
            </Title>
            <Text strong style={{ fontSize: FONT_SIZE.metric }}>
              {summary.reviewNeededCount.toLocaleString()}건
            </Text>
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
            keywordPlaceholder="추천 코드, 추천인 ID/이름 검색"
            detailTitle="상세 검색"
            detailContent={
              <SearchBarDetailField label="최근 사용일">
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
                총 {visibleReferrals.length.toLocaleString()}건
              </Text>
            }
          />
        }
      >
        {referralsState.status !== 'pending' && visibleReferrals.length === 0 ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: SPACE.sm }}
            message="조건에 맞는 추천 코드가 없습니다."
            description="검색어 또는 필터 조건을 조정한 뒤 다시 확인하세요."
          />
        ) : null}

      <AdminDataTable<ReferralSummary>
        rowKey="id"
        columns={columns}
          dataSource={visibleReferrals}
          onChange={handleTableChange}
          onRow={handleRowClick}
          loading={referralsState.status === 'pending'}
          scroll={{ x: 1560, y: 560 }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            pageSizeOptions,
            showSizeChanger: true,
            showTotal: (total) => `총 ${total.toLocaleString()}건`
          }}
        />
      </AdminListCard>

      <ReferralDetailDrawer
        referral={selectedReferral}
        onClose={closeDrawer}
        onOpenPoints={openPointsPage}
        onOpenAdjustment={handleOpenAdjustment}
        onReviewAnomaly={handleReviewAnomaly}
        onDeactivate={handleDeactivate}
        onActivate={handleActivate}
      />

      {actionState ? (
        <ConfirmAction
          open
          title={
            actionState.type === 'deactivate'
              ? '추천 코드 비활성화'
              : actionState.type === 'activate'
                ? '추천 코드 재활성화'
                : '이상치 검토 완료 처리'
          }
          description={
            actionState.type === 'deactivate'
              ? '추천 코드 사용을 중단합니다. 사용자 화면 입력 차단과 운영 사유를 함께 기록하세요.'
              : actionState.type === 'activate'
                ? '추천 코드 사용을 다시 허용합니다. 재활성화 사유와 근거를 기록하세요.'
                : '추천 관계와 보상 원장을 검토 완료 상태로 전환합니다. 검토 사유와 판단 근거를 기록하세요.'
          }
          targetType="Referral"
          targetId={actionState.referral.id}
          confirmText={
            actionState.type === 'deactivate'
              ? '비활성화 실행'
              : actionState.type === 'activate'
                ? '재활성화 실행'
                : '검토 완료'
          }
          onCancel={closeAction}
          onConfirm={handleConfirmAction}
        />
      ) : null}

      <ReferralAdjustmentModal
        target={adjustmentTarget}
        form={adjustmentForm}
        onOk={handleSubmitAdjustment}
        onCancel={closeAdjustmentModal}
      />
    </div>
  );
}
