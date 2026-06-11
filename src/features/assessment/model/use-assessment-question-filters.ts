import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  assessmentQuestionNumbers,
  parseAssessmentDifficultyLevel,
  parseAssessmentQuestionNumbers,
  parseAssessmentQuestionTypeName
} from './assessment-question-bank-schema';
import type { AssessmentQuestionNumber } from './assessment-question-bank-types';

/**
 * URL 파라미터: `topicMain`(+`topicDetail`), `serviceStatus`(노출 상태 —
 * manage 페이지), 난이도는 1~6 정수. `tag`는 P4 태그 필터 자리 확보용 예약
 * 키다. (`reviewStatus`는 2026-06-11 검수 개념 삭제로 제거 — 결정 기록 §0)
 */
export type QuestionFilterParamKey =
  | 'questionNo'
  | 'topicMain'
  | 'topicDetail'
  | 'questionType'
  | 'difficulty'
  | 'keyword'
  | 'serviceStatus'
  | 'tag';

type QuestionFilterParamValue = string | string[] | null;

export type AssessmentQuestionFilters = {
  searchParams: URLSearchParams;
  activeQuestionNumbers: AssessmentQuestionNumber[];
  topicMainFilter: string | null;
  topicDetailFilter: string | null;
  questionTypeFilter: string | null;
  difficultyFilter: number | null;
  keyword: string;
  draftTopicMainFilter: string | null;
  draftTopicDetailFilter: string | null;
  draftQuestionTypeFilter: string | null;
  draftDifficultyFilter: string | null;
  setDraftTopicMainFilter: (value: string | null) => void;
  setDraftTopicDetailFilter: (value: string | null) => void;
  setDraftQuestionTypeFilter: (value: string | null) => void;
  setDraftDifficultyFilter: (value: string | null) => void;
  commitParams: (
    next: Partial<Record<QuestionFilterParamKey, QuestionFilterParamValue>>
  ) => void;
  handleQuestionNumberToggle: (
    questionNumber: AssessmentQuestionNumber,
    checked: boolean
  ) => void;
  handleApplySearchDetail: () => void;
  handleResetSearchDetail: () => void;
  handleSearchDetailOpenChange: (open: boolean) => void;
};

/**
 * Common list-filter state shared by both split question-bank pages: the question
 * number multi-select, the keyword box, and the 주제(종합/세부)/유형/난이도 상세
 * 검색 popover. The manage page layers its serviceStatus param on top via
 * `commitParams`.
 */
export function useAssessmentQuestionFilters(): AssessmentQuestionFilters {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeQuestionNumbers = parseAssessmentQuestionNumbers(
    searchParams.getAll('questionNo')
  );
  const topicMainFilter = searchParams.get('topicMain');
  const topicDetailFilter = searchParams.get('topicDetail');
  const questionTypeFilter = parseAssessmentQuestionTypeName(
    searchParams.get('questionType')
  );
  const difficultyFilter = parseAssessmentDifficultyLevel(
    searchParams.get('difficulty')
  );
  const keyword = searchParams.get('keyword') ?? '';

  const [draftTopicMainFilter, setDraftTopicMainFilter] = useState<string | null>(
    topicMainFilter
  );
  const [draftTopicDetailFilter, setDraftTopicDetailFilter] = useState<
    string | null
  >(topicDetailFilter);
  const [draftQuestionTypeFilter, setDraftQuestionTypeFilter] = useState<
    string | null
  >(questionTypeFilter);
  const [draftDifficultyFilter, setDraftDifficultyFilter] = useState<
    string | null
  >(difficultyFilter == null ? null : String(difficultyFilter));

  useEffect(() => {
    setDraftTopicMainFilter(topicMainFilter);
    setDraftTopicDetailFilter(topicDetailFilter);
    setDraftQuestionTypeFilter(questionTypeFilter);
    setDraftDifficultyFilter(difficultyFilter == null ? null : String(difficultyFilter));
  }, [difficultyFilter, questionTypeFilter, topicDetailFilter, topicMainFilter]);

  const commitParams = useCallback(
    (next: Partial<Record<QuestionFilterParamKey, QuestionFilterParamValue>>) => {
      const merged = new URLSearchParams(searchParams);

      Object.entries(next).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          merged.delete(key);

          if (value.length === 0) {
            return;
          }

          value.forEach((item) => {
            if (!item || item === 'all') {
              return;
            }

            merged.append(key, item);
          });
          return;
        }

        if (!value || value === 'all') {
          merged.delete(key);
          return;
        }

        merged.set(key, value);
      });

      setSearchParams(merged, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const handleQuestionNumberToggle = useCallback(
    (questionNumber: AssessmentQuestionNumber, checked: boolean) => {
      const nextQuestionNumbers = checked
        ? assessmentQuestionNumbers.filter(
            (candidate) =>
              activeQuestionNumbers.includes(candidate) ||
              candidate === questionNumber
          )
        : activeQuestionNumbers.filter(
            (candidate) => candidate !== questionNumber
          );

      if (nextQuestionNumbers.length === 0) {
        return;
      }

      commitParams({
        questionNo:
          nextQuestionNumbers.length === assessmentQuestionNumbers.length
            ? null
            : nextQuestionNumbers
      });
    },
    [activeQuestionNumbers, commitParams]
  );

  const handleSearchDetailOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        return;
      }

      setDraftTopicMainFilter(topicMainFilter);
      setDraftTopicDetailFilter(topicDetailFilter);
      setDraftQuestionTypeFilter(questionTypeFilter);
      setDraftDifficultyFilter(
        difficultyFilter == null ? null : String(difficultyFilter)
      );
    },
    [difficultyFilter, questionTypeFilter, topicDetailFilter, topicMainFilter]
  );

  const handleResetSearchDetail = useCallback(() => {
    setDraftTopicMainFilter(null);
    setDraftTopicDetailFilter(null);
    setDraftQuestionTypeFilter(null);
    setDraftDifficultyFilter(null);
  }, []);

  const handleApplySearchDetail = useCallback(() => {
    commitParams({
      topicMain: draftTopicMainFilter,
      topicDetail: draftTopicDetailFilter,
      questionType: draftQuestionTypeFilter,
      difficulty: draftDifficultyFilter
    });
  }, [
    commitParams,
    draftDifficultyFilter,
    draftQuestionTypeFilter,
    draftTopicDetailFilter,
    draftTopicMainFilter
  ]);

  return {
    searchParams,
    activeQuestionNumbers,
    topicMainFilter,
    topicDetailFilter,
    questionTypeFilter,
    difficultyFilter,
    keyword,
    draftTopicMainFilter,
    draftTopicDetailFilter,
    draftQuestionTypeFilter,
    draftDifficultyFilter,
    setDraftTopicMainFilter,
    setDraftTopicDetailFilter,
    setDraftQuestionTypeFilter,
    setDraftDifficultyFilter,
    commitParams,
    handleQuestionNumberToggle,
    handleApplySearchDetail,
    handleResetSearchDetail,
    handleSearchDetailOpenChange
  };
}
