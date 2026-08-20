import { Alert, Button, Empty, Grid, Space, Tabs } from 'antd';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  fetchAssessmentQuestionDetailSafe,
  fetchAssessmentQuestionVersionDetailSafe,
  fetchAssessmentQuestionVersionEntriesSafe,
  fetchAssessmentQuestionVersionSummariesSafe
} from '../api/assessment-question-bank-service';
import { questionBankDataSource } from '../api/question-bank-data-source';
import type {
  AssessmentQuestionDetail,
  AssessmentQuestionVersionDetail,
  AssessmentQuestionVersionEntry,
  AssessmentQuestionVersionSummary
} from '../model/assessment-question-bank-types';
import type { AsyncState } from '@/shared/model/async-state';
import { AdminListCard } from '@/shared/ui/list-page-card/admin-list-card';
import { PageTitle } from '@/shared/ui/page-title/page-title';
import {
  buildQuestionBankListHref,
  buildQuestionDetailHref,
  parseQuestionVersionId
} from '../model/question-version-navigation';
import { QuestionVersionHistoryTable } from '../ui/question-version-history-table';
import { QuestionDetailPanel } from '../ui/assessment-question-detail-panel';

const { useBreakpoint } = Grid;

/**
 * TOPIK 쓰기 문항 상세 — 조회 전용 (인바운드 모델, 결정 기록 §0).
 * 수신·적재된 문항의 번호별 실메타데이터를 열람한다. 관리 포인트(태그·노출
 * 통제)는 /manage 페이지 담당이며, 이 페이지에 쓰기 액션은 없다.
 */

export default function AssessmentQuestionDetailPage(): JSX.Element {
  const { questionId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [questionState, setQuestionState] = useState<AsyncState<AssessmentQuestionDetail | null>>({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [versionSummaryState, setVersionSummaryState] = useState<
    AsyncState<AssessmentQuestionVersionSummary | null>
  >({
    status: 'pending',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [versionHistoryState, setVersionHistoryState] = useState<
    AsyncState<AssessmentQuestionVersionEntry[]>
  >({
    status: 'idle',
    data: [],
    errorMessage: null,
    errorCode: null
  });
  const [selectedVersionState, setSelectedVersionState] = useState<
    AsyncState<AssessmentQuestionVersionDetail | null>
  >({
    status: 'idle',
    data: null,
    errorMessage: null,
    errorCode: null
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [versionSummaryReloadKey, setVersionSummaryReloadKey] = useState(0);
  const [versionHistoryReloadKey, setVersionHistoryReloadKey] = useState(0);
  const [selectedVersionReloadKey, setSelectedVersionReloadKey] = useState(0);
  const screens = useBreakpoint();

  const detailParams = new URLSearchParams(location.search);
  const detailTab = detailParams.get('detailTab') === 'history' ? 'history' : 'current';
  const rawVersionId = detailParams.get('versionId');
  const selectedVersionId = parseQuestionVersionId(rawVersionId);

  useEffect(() => {
    const controller = new AbortController();

    setQuestionState((prev) => ({
      ...prev,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchAssessmentQuestionDetailSafe(questionId, controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (!result.ok) {
        setQuestionState({
          status: 'error',
          data: null,
          errorMessage: result.error.message,
          errorCode: result.error.code
        });
        return;
      }

      setQuestionState({
        status: 'success',
        data: result.data,
        errorMessage: null,
        errorCode: null
      });
    });

    return () => {
      controller.abort();
    };
  }, [questionId, reloadKey]);

  useEffect(() => {
    const controller = new AbortController();
    setVersionSummaryState((previous) => ({
      ...previous,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchAssessmentQuestionVersionSummariesSafe(
      [questionId],
      controller.signal
    ).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (!result.ok) {
        setVersionSummaryState({
          status: 'error',
          data: null,
          errorMessage: result.error.message,
          errorCode: result.error.code
        });
        return;
      }

      setVersionSummaryState({
        status: 'success',
        data: result.data[0] ?? null,
        errorMessage: null,
        errorCode: null
      });
    });

    return () => controller.abort();
  }, [questionId, versionSummaryReloadKey]);

  useEffect(() => {
    if (detailTab !== 'history') {
      return;
    }

    const controller = new AbortController();
    setVersionHistoryState((previous) => ({
      ...previous,
      status: 'pending',
      errorMessage: null,
      errorCode: null
    }));

    void fetchAssessmentQuestionVersionEntriesSafe(
      questionId,
      controller.signal
    ).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (!result.ok) {
        setVersionHistoryState((previous) => ({
          ...previous,
          status: 'error',
          errorMessage: result.error.message,
          errorCode: result.error.code
        }));
        return;
      }

      setVersionHistoryState({
        status: 'success',
        data: result.data,
        errorMessage: null,
        errorCode: null
      });
    });

    return () => controller.abort();
  }, [detailTab, questionId, versionHistoryReloadKey]);

  useEffect(() => {
    if (detailTab !== 'history' || rawVersionId == null) {
      setSelectedVersionState({
        status: 'idle',
        data: null,
        errorMessage: null,
        errorCode: null
      });
      return;
    }

    if (selectedVersionId == null) {
      setSelectedVersionState({
        status: 'error',
        data: null,
        errorMessage: '버전 ID 형식이 올바르지 않습니다.',
        errorCode: 'invalid_version_id'
      });
      return;
    }

    if (versionSummaryState.status !== 'success') {
      return;
    }
    if (versionSummaryState.data?.canonicalImportId == null) {
      setSelectedVersionState({
        status: 'error',
        data: null,
        errorMessage: '현재 버전 포인터가 없어 과거 버전을 구분할 수 없습니다.',
        errorCode: 'missing_canonical_version'
      });
      return;
    }
    if (versionSummaryState.data.canonicalImportId === selectedVersionId) {
      setSelectedVersionState({
        status: 'error',
        data: null,
        errorMessage: '선택한 ID는 과거 버전이 아니라 현재 노출 버전입니다.',
        errorCode: 'current_version_selected'
      });
      return;
    }

    const controller = new AbortController();
    setSelectedVersionState({
      status: 'pending',
      data: null,
      errorMessage: null,
      errorCode: null
    });

    void fetchAssessmentQuestionVersionDetailSafe(
      questionId,
      selectedVersionId,
      controller.signal
    ).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (!result.ok) {
        setSelectedVersionState({
          status: 'error',
          data: null,
          errorMessage: result.error.message,
          errorCode: result.error.code
        });
        return;
      }

      setSelectedVersionState({
        status: 'success',
        data: result.data,
        errorMessage: null,
        errorCode: null
      });
    });

    return () => controller.abort();
  }, [
    detailTab,
    questionId,
    rawVersionId,
    selectedVersionId,
    selectedVersionReloadKey,
    versionSummaryState.data,
    versionSummaryState.status
  ]);

  const question = questionState.data;
  const backHref = buildQuestionBankListHref(location.search);
  const descriptionColumn = screens.lg ? 2 : 1;

  const pageTitle = question
    ? `TOPIK ${question.questionNumber}번 문항 상세`
    : '문항 상세';

  const navigateToCurrentVersion = useCallback(() => {
    navigate(buildQuestionDetailHref(questionId, location.search, 'current'));
  }, [location.search, navigate, questionId]);

  const navigateToHistory = useCallback(() => {
    navigate(buildQuestionDetailHref(questionId, location.search, 'history'));
  }, [location.search, navigate, questionId]);

  const openHistoricalVersion = useCallback(
    (entry: AssessmentQuestionVersionEntry) => {
      navigate(
        buildQuestionDetailHref(
          questionId,
          location.search,
          'history',
          entry.importId
        )
      );
    },
    [location.search, navigate, questionId]
  );

  const currentVersionTabLabel =
    versionSummaryState.data?.canonicalImportId != null
      ? `버전 #${versionSummaryState.data.canonicalImportId}`
      : versionSummaryState.status === 'pending'
        ? '버전 확인 중'
        : versionSummaryState.status === 'error'
          ? '버전 확인 실패'
          : '버전 연결 없음';

  const currentTabContent = (
    <>
      {questionState.status === 'error' ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          message="문항을 불러오지 못했습니다."
          description={questionState.errorMessage ?? ''}
          action={
            <Button size="small" onClick={() => setReloadKey((previous) => previous + 1)}>
              다시 시도
            </Button>
          }
        />
      ) : null}

      {questionState.status === 'pending' ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="문항 상세 데이터를 불러오는 중입니다."
        />
      ) : null}

      {questionState.status === 'error' ? (
        <Empty
          description="문항 상세를 불러오지 못했습니다."
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : null}

      {question ? (
        <QuestionDetailPanel
          question={question}
          descriptionColumn={descriptionColumn}
          headerActions={
            <Button size="large" onClick={() => navigate(backHref)}>
              목록으로 돌아가기
            </Button>
          }
        />
      ) : null}
    </>
  );

  let historyTabContent: ReactNode;
  if (versionSummaryState.status === 'error') {
    historyTabContent = (
      <Alert
        type="error"
        showIcon
        message="현재 버전 정보를 불러오지 못했습니다."
        description={versionSummaryState.errorMessage ?? ''}
        action={
          <Button
            size="small"
            onClick={() => setVersionSummaryReloadKey((previous) => previous + 1)}
          >
            다시 시도
          </Button>
        }
      />
    );
  } else if (versionSummaryState.status === 'pending') {
    historyTabContent = (
      <Alert type="info" showIcon message="현재 버전 정보를 확인하는 중입니다." />
    );
  } else if (versionSummaryState.data?.canonicalImportId == null) {
    historyTabContent = (
      <Alert
        type="warning"
        showIcon
        message="버전 연결 없음"
        description="현재 버전 포인터가 없어 수정 횟수와 과거 버전을 안전하게 구분할 수 없습니다."
        action={
          <Button size="small" onClick={navigateToCurrentVersion}>
            현재 문항 보기
          </Button>
        }
      />
    );
  } else if (rawVersionId == null) {
    historyTabContent = (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space wrap>
          <Button size="large" onClick={navigateToCurrentVersion}>
            현재 버전 보기
          </Button>
          <Button size="large" onClick={() => navigate(backHref)}>
            목록으로 돌아가기
          </Button>
        </Space>
        <QuestionVersionHistoryTable
          state={versionHistoryState}
          currentImportId={versionSummaryState.data.canonicalImportId}
          onOpenVersion={openHistoricalVersion}
          onRetry={() =>
            setVersionHistoryReloadKey((previous) => previous + 1)
          }
        />
      </Space>
    );
  } else if (selectedVersionState.status === 'success' && selectedVersionState.data) {
    historyTabContent = (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="warning"
          showIcon
          message={`과거 버전 #${selectedVersionState.data.importId} · 현재 노출 버전 아님`}
          description="사용자에게 현재 노출되는 문항이 아니라 관리자 변경 이력용 불변 payload입니다."
        />
        <QuestionDetailPanel
          question={selectedVersionState.data.question}
          historicalVersion={selectedVersionState.data}
          descriptionColumn={descriptionColumn}
          headerActions={
            <Space wrap>
              <Button size="large" onClick={navigateToHistory}>
                변경 이력 목록으로
              </Button>
              <Button size="large" type="primary" onClick={navigateToCurrentVersion}>
                현재 버전 보기
              </Button>
            </Space>
          }
        />
      </Space>
    );
  } else if (selectedVersionState.status === 'error') {
    historyTabContent = (
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="error"
          showIcon
          message="과거 버전을 불러오지 못했습니다."
          description={selectedVersionState.errorMessage ?? ''}
          action={
            <Button
              size="small"
              onClick={() => setSelectedVersionReloadKey((previous) => previous + 1)}
            >
              다시 시도
            </Button>
          }
        />
        <Space wrap>
          <Button size="large" onClick={navigateToHistory}>
            변경 이력 목록으로
          </Button>
          <Button size="large" onClick={navigateToCurrentVersion}>
            현재 버전 보기
          </Button>
        </Space>
      </Space>
    );
  } else {
    historyTabContent = (
      <Alert type="info" showIcon message="과거 버전 상세를 불러오는 중입니다." />
    );
  }

  return (
    <div>
      <PageTitle title={pageTitle} />

      <AdminListCard>
        {questionBankDataSource === 'mock' ? (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="모크 모드로 동작 중입니다."
            description="Supabase가 구성되지 않아 화면 검증용 고정 데이터를 표시합니다. 실데이터·감사 로그에는 기록되지 않습니다."
          />
        ) : null}

        <Tabs
          activeKey={detailTab}
          onChange={(key) =>
            key === 'history' ? navigateToHistory() : navigateToCurrentVersion()
          }
          items={[
            {
              key: 'current',
              label: currentVersionTabLabel,
              children: currentTabContent
            },
            {
              key: 'history',
              label: '변경 이력보기',
              children: historyTabContent
            }
          ]}
        />
      </AdminListCard>
    </div>
  );
}
