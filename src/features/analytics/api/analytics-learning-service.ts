import { toSafeResult } from '../../../shared/api/safe-request';
import {
  isSupabaseConfigured,
  supabaseClient
} from '../../../shared/api/supabase-client';

/**
 * 학습 분석 집계 — get_admin_learning_analytics (is_admin, 20260708140000).
 * TOPIK 쓰기(51~54) 전체 사용자 학습 지표. 개인 식별자는 반환하지 않는다.
 *
 * 계약 요점(학습 데이터 수집 Phase 3):
 *   - 학습 활성 사용자 = 기간 내 study_events 1건 이상(로그인 기준 아님 —
 *     통계 개요의 "활성 사용자(로그인)"와 정의가 다르다).
 *   - 점수 = 원점수 + 100점 정규화 병기(행별 score_max 기준).
 *   - 소요 시간 = writing_submission_metrics. metricsCount=0 이면 "미수집"
 *     으로 표시하고 0분으로 렌더하지 않는다.
 *   - periodDays 0 = 전체 기간(직전 기간 비교값은 null).
 * Supabase 미설정(mock 모드)에서는 null 을 반환하고 페이지가 목업을 유지한다.
 */

export type LearningAnalyticsSummary = {
  periodDays: number;
  activeLearners: number;
  activeLearnersPrev: number | null;
  submitters: number;
  submissions: number;
  submissionsPrev: number | null;
  feedbackComplete: number;
  feedbackPending: number;
  feedbackFailed: number;
  completionRate: number | null;
  failureRate: number | null;
  resubmissions: number;
  avgScoreNormalized: number | null;
  avgScoreNormalizedPrev: number | null;
  feedbackViewedCount: number;
  feedbackViewRate: number | null;
  avgProcessingSeconds: number | null;
  medianProcessingSeconds: number | null;
  metricsCount: number;
  avgElapsedSeconds: number | null;
  medianElapsedSeconds: number | null;
  dimensionCoverageSubmissions: number;
};

export type LearningAnalyticsQuestionStat = {
  questionNo: number;
  submissions: number;
  feedbackComplete: number;
  avgScoreRaw: number | null;
  scoreMax: number | null;
  avgScoreNormalized: number | null;
  avgElapsedSeconds: number | null;
  metricsCount: number;
};

export type LearningAnalyticsScoreBucket = {
  bucket: number;
  label: string;
  count: number;
};

export type LearningAnalyticsWeakDimension = {
  dimension: string;
  weaknessOccurrences: number;
  submissions: number;
  maxSeverity: number;
};

export type LearningAnalyticsTagStat = {
  tag: string;
  submissions: number;
  avgScoreNormalized: number | null;
};

export type LearningAnalytics = {
  summary: LearningAnalyticsSummary;
  perQuestion: LearningAnalyticsQuestionStat[];
  scoreDistribution: LearningAnalyticsScoreBucket[];
  weakDimensions: LearningAnalyticsWeakDimension[];
  tagStats: LearningAnalyticsTagStat[];
};

type LearningAnalyticsRow = {
  summary: LearningAnalyticsSummary;
  per_question: LearningAnalyticsQuestionStat[];
  score_distribution: LearningAnalyticsScoreBucket[];
  weak_dimensions: LearningAnalyticsWeakDimension[];
  tag_stats: LearningAnalyticsTagStat[];
};

export function fetchLearningAnalyticsSafe(periodDays: number, signal?: AbortSignal) {
  return toSafeResult<LearningAnalytics | null>(async () => {
    if (!isSupabaseConfigured || !supabaseClient) {
      return null;
    }
    const { data, error } = await supabaseClient.rpc('get_admin_learning_analytics', {
      period_days: periodDays
    });
    if (signal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }
    if (error) {
      throw new Error(error.message);
    }
    const row = ((data ?? []) as LearningAnalyticsRow[])[0];
    if (!row) {
      throw new Error('학습 분석 응답이 비어 있습니다.');
    }
    return {
      summary: row.summary,
      perQuestion: row.per_question ?? [],
      scoreDistribution: row.score_distribution ?? [],
      weakDimensions: row.weak_dimensions ?? [],
      tagStats: row.tag_stats ?? []
    };
  });
}
