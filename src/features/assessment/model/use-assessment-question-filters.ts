import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  assessmentQuestionNumbers,
  parseAssessmentQuestionDifficulty,
  parseAssessmentQuestionDomain,
  parseAssessmentQuestionNumbers,
  parseAssessmentQuestionTypeLabel
} from './assessment-question-bank-schema';
import type {
  AssessmentQuestionDifficulty,
  AssessmentQuestionDomain,
  AssessmentQuestionNumber,
  AssessmentQuestionTypeLabel
} from './assessment-question-bank-types';

export type QuestionFilterParamKey =
  | 'questionNo'
  | 'domain'
  | 'questionType'
  | 'difficulty'
  | 'keyword'
  | 'reviewStatus'
  | 'operationStatus';

type QuestionFilterParamValue = string | string[] | null;

export type AssessmentQuestionFilters = {
  searchParams: URLSearchParams;
  activeQuestionNumbers: AssessmentQuestionNumber[];
  domainFilter: AssessmentQuestionDomain | null;
  questionTypeFilter: AssessmentQuestionTypeLabel | null;
  difficultyFilter: AssessmentQuestionDifficulty | null;
  keyword: string;
  draftDomainFilter: string | null;
  draftQuestionTypeFilter: string | null;
  draftDifficultyFilter: string | null;
  setDraftDomainFilter: (value: string | null) => void;
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
 * number multi-select, the keyword box, and the domain/type/difficulty 상세 검색
 * popover. Each page layers its own status param (reviewStatus / operationStatus)
 * on top via `commitParams`. The `tab` param is gone now that the two modes are
 * separate routes.
 */
export function useAssessmentQuestionFilters(): AssessmentQuestionFilters {
  const [searchParams, setSearchParams] = useSearchParams();

  const activeQuestionNumbers = parseAssessmentQuestionNumbers(
    searchParams.getAll('questionNo')
  );
  const domainFilter = parseAssessmentQuestionDomain(searchParams.get('domain'));
  const questionTypeFilter = parseAssessmentQuestionTypeLabel(
    searchParams.get('questionType')
  );
  const difficultyFilter = parseAssessmentQuestionDifficulty(
    searchParams.get('difficulty')
  );
  const keyword = searchParams.get('keyword') ?? '';

  const [draftDomainFilter, setDraftDomainFilter] = useState<string | null>(
    domainFilter
  );
  const [draftQuestionTypeFilter, setDraftQuestionTypeFilter] = useState<
    string | null
  >(questionTypeFilter);
  const [draftDifficultyFilter, setDraftDifficultyFilter] = useState<
    string | null
  >(difficultyFilter);

  useEffect(() => {
    setDraftDomainFilter(domainFilter);
    setDraftQuestionTypeFilter(questionTypeFilter);
    setDraftDifficultyFilter(difficultyFilter);
  }, [difficultyFilter, domainFilter, questionTypeFilter]);

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

      setDraftDomainFilter(domainFilter);
      setDraftQuestionTypeFilter(questionTypeFilter);
      setDraftDifficultyFilter(difficultyFilter);
    },
    [difficultyFilter, domainFilter, questionTypeFilter]
  );

  const handleResetSearchDetail = useCallback(() => {
    setDraftDomainFilter(null);
    setDraftQuestionTypeFilter(null);
    setDraftDifficultyFilter(null);
  }, []);

  const handleApplySearchDetail = useCallback(() => {
    commitParams({
      domain: draftDomainFilter,
      questionType: draftQuestionTypeFilter,
      difficulty: draftDifficultyFilter
    });
  }, [
    commitParams,
    draftDifficultyFilter,
    draftDomainFilter,
    draftQuestionTypeFilter
  ]);

  return {
    searchParams,
    activeQuestionNumbers,
    domainFilter,
    questionTypeFilter,
    difficultyFilter,
    keyword,
    draftDomainFilter,
    draftQuestionTypeFilter,
    draftDifficultyFilter,
    setDraftDomainFilter,
    setDraftQuestionTypeFilter,
    setDraftDifficultyFilter,
    commitParams,
    handleQuestionNumberToggle,
    handleApplySearchDetail,
    handleResetSearchDetail,
    handleSearchDetailOpenChange
  };
}
