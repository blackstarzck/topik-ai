import { Descriptions, Empty, Space, Spin, Table, Tag, Typography } from 'antd';
import { useMemo } from 'react';

import {
  formatElapsedSeconds,
  formatWeaknessLabel
} from '../model/user-detail-page-schema';
import type { UserLearningOverview, UserSummary } from '../model/types';
import type { AsyncState } from '@/shared/model/async-state';
import { DRAWER_TABLE_PAGINATION } from '@/shared/ui/table/drawer-table';
import {
  createLearningQuestionColumns,
  createLearningTagColumns,
  createLearningWeaknessColumns,
  createLearningWritingColumns,
  renderTermsConsentStatus
} from './user-detail-columns';

const { Text } = Typography;

// 학습 현황 탭 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 조회 상태는 페이지가 소유하고, 온보딩 요약 같은 파생 표시값은 탭 내부에서 계산한다.

export type UserDetailLearningTabProps = {
  user: UserSummary | null;
  learningState: AsyncState<UserLearningOverview | null>;
  onOpenDetail: (title: string, record: Record<string, unknown>) => void;
};

export function UserDetailLearningTab({
  user,
  learningState,
  onOpenDetail
}: UserDetailLearningTabProps): JSX.Element {
  const learningQuestionColumns = useMemo(() => createLearningQuestionColumns(), []);
  const learningTagColumns = useMemo(() => createLearningTagColumns(), []);
  const learningWeaknessColumns = useMemo(() => createLearningWeaknessColumns(), []);
  const learningWritingColumns = useMemo(() => createLearningWritingColumns(), []);

  const onboardingSummary = useMemo(() => {
    const ob = learningState.data?.onboarding;
    if (!ob) {
      return null;
    }
    const verificationPending = user?.emailVerificationStatus === '미인증';
    const consentDone = user?.termsConsentStatus === '동의 완료';
    let statusLabel = '학습 목표 설정 대기';
    if (verificationPending) {
      statusLabel = '이메일 인증 대기';
    } else if (!consentDone) {
      statusLabel = '약관 동의 대기';
    } else if (ob.hasGoal) {
      statusLabel = '완료';
    }
    const statusColor = statusLabel === '완료' ? 'green' : 'orange';
    return { ob, statusLabel, statusColor };
  }, [learningState.data, user]);

  return (
learningState.status === 'pending' ? (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
    <Spin />
  </div>
) : learningState.status === 'error' ? (
  <Empty
    description={learningState.errorMessage ?? '학습 현황을 불러오지 못했습니다.'}
    image={Empty.PRESENTED_IMAGE_SIMPLE}
  />
) : learningState.data ? (
  <Space direction="vertical" size={16} style={{ width: '100%' }}>
    {onboardingSummary ? (
      <Descriptions bordered column={2} size="small" title="온보딩 현황">
        <Descriptions.Item label="온보딩 상태">
          <Tag color={onboardingSummary.statusColor}>
            {onboardingSummary.statusLabel}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="가입일">{user?.joinedAt || '-'}</Descriptions.Item>
        <Descriptions.Item label="약관 동의">
          {user ? renderTermsConsentStatus(user) : '-'}
          {user?.termsConsentAt && user.emailVerificationStatus !== '미인증' ? (
            <Typography.Text type="secondary"> · {user.termsConsentAt}</Typography.Text>
          ) : null}
        </Descriptions.Item>
        <Descriptions.Item label="학습 목표">
          {onboardingSummary.ob.hasGoal ? (
            `${onboardingSummary.ob.topikLevel || '-'} · 목표 ${
              onboardingSummary.ob.targetGrade ?? '-'
            }급`
          ) : (
            <Tag color="orange">미설정</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="시험 예정일">
          {onboardingSummary.ob.examDate || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="주간 목표">
          {onboardingSummary.ob.weeklyGoalMinutes == null
            ? '-'
            : `${onboardingSummary.ob.weeklyGoalMinutes}분`}
        </Descriptions.Item>
        <Descriptions.Item label="관심·약점 영역" span={2}>
          {onboardingSummary.ob.weakAreas.length
            ? onboardingSummary.ob.weakAreas.map(formatWeaknessLabel).join(', ')
            : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="목표 설정일" span={2}>
          {onboardingSummary.ob.goalUpdatedAt || '-'}
        </Descriptions.Item>
      </Descriptions>
    ) : null}

    <Descriptions bordered column={3} size="small" title="TOPIK 쓰기 요약">
      <Descriptions.Item label="총 제출 수">
        {learningState.data.kpis.totalSubmissions}
      </Descriptions.Item>
      <Descriptions.Item label="피드백(완료/대기/실패)">
        {learningState.data.kpis.feedbackComplete} /{' '}
        {learningState.data.kpis.feedbackPending} /{' '}
        {learningState.data.kpis.feedbackFailed}
      </Descriptions.Item>
      <Descriptions.Item label="평균 점수(100점 환산)">
        {learningState.data.kpis.avgScoreNormalized == null
          ? '-'
          : `${learningState.data.kpis.avgScoreNormalized}점`}
      </Descriptions.Item>
      <Descriptions.Item label="피드백 열람률">
        {learningState.data.kpis.feedbackViewRate == null
          ? '-'
          : `${learningState.data.kpis.feedbackViewRate}% (${learningState.data.kpis.feedbackViewedCount}건)`}
      </Descriptions.Item>
      <Descriptions.Item label="재제출 수">
        {learningState.data.kpis.resubmissionCount}
      </Descriptions.Item>
      <Descriptions.Item label="연속 학습일(학습 이벤트 기준)">
        {learningState.data.kpis.streakDays}일
      </Descriptions.Item>
      <Descriptions.Item label="평균 소요 시간">
        {learningState.data.kpis.metricsCount === 0
          ? '미수집'
          : formatElapsedSeconds(learningState.data.kpis.avgElapsedSeconds)}
      </Descriptions.Item>
      <Descriptions.Item label="주간 학습(실적/목표)">
        {learningState.data.kpis.weeklyStudiedMinutes == null
          ? '미수집'
          : `${learningState.data.kpis.weeklyStudiedMinutes}분`}{' '}
        /{' '}
        {learningState.data.kpis.weeklyGoalMinutes == null
          ? '목표 미설정'
          : `${learningState.data.kpis.weeklyGoalMinutes}분`}
      </Descriptions.Item>
      <Descriptions.Item label="최근 활동일">
        {learningState.data.kpis.latestActivityAt || '-'}
      </Descriptions.Item>
    </Descriptions>

    <div>
      <Text strong>문항별 성과 (51~54번)</Text>
      <Table
        rowKey="questionNo"
        showSorterTooltip={false}
        size="small"
        pagination={false}
        style={{ marginTop: 8 }}
        dataSource={learningState.data.perQuestion}
        columns={learningQuestionColumns}
      />
    </div>

    <div>
      <Text strong>태그별 성과</Text>
      <Table
        rowKey="tag"
        showSorterTooltip={false}
        size="small"
        pagination={DRAWER_TABLE_PAGINATION}
        style={{ marginTop: 8 }}
        dataSource={learningState.data.tagStats}
        columns={learningTagColumns}
      />
    </div>

    <div>
      <Text strong>약점 영역</Text>
      <Table
        rowKey={(record) => `${record.source}:${record.label}`}
        showSorterTooltip={false}
        size="small"
        pagination={DRAWER_TABLE_PAGINATION}
        style={{ marginTop: 8 }}
        dataSource={learningState.data.weaknesses}
        columns={learningWeaknessColumns}
      />
    </div>

    <div>
      <Text strong>최근 작문 채점</Text>
      <Table
        rowKey="submissionId"
        showSorterTooltip={false}
        size="small"
        pagination={DRAWER_TABLE_PAGINATION}
        style={{ marginTop: 8 }}
        dataSource={learningState.data.recentWriting}
        columns={learningWritingColumns}
        onRow={(record) => ({
          onClick: () => onOpenDetail('작문 채점 상세', record),
          style: { cursor: 'pointer' }
        })}
      />
    </div>

    <div>
      <Descriptions
        bordered
        column={3}
        size="small"
        title="객관식 학습(별도 원천)"
      >
        <Descriptions.Item label="총 풀이 수">
          {learningState.data.objectiveAttempts.totalAttempts}
        </Descriptions.Item>
        <Descriptions.Item label="정답률">
          {learningState.data.objectiveAttempts.correctRate == null
            ? '-'
            : `${learningState.data.objectiveAttempts.correctRate}%`}
        </Descriptions.Item>
        <Descriptions.Item label="평균 점수">
          {learningState.data.objectiveAttempts.averageScore ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label="누적 학습시간">
          {learningState.data.objectiveAttempts.totalStudyMinutes}분
        </Descriptions.Item>
        <Descriptions.Item label="북마크">
          {learningState.data.objectiveAttempts.bookmarkedCount}
        </Descriptions.Item>
        <Descriptions.Item label="최근 풀이일">
          {learningState.data.objectiveAttempts.latestAttemptAt || '-'}
        </Descriptions.Item>
      </Descriptions>
      <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
        객관식(읽기/듣기) 풀이 기록(problem_attempts) 원천입니다. 객관식 기능 도입
        전까지는 수집 전 상태로 0이 표시됩니다. TOPIK 쓰기 지표와 원천이 다릅니다.
      </Text>
    </div>
  </Space>
) : (
  <Empty description="학습 데이터가 없습니다." image={Empty.PRESENTED_IMAGE_SIMPLE} />
)
  );
}
