import { Checkbox, Form, Select, Space, Typography } from 'antd';

import {
  assessmentDifficultyLevels,
  assessmentQuestionNumberTabItems,
  assessmentQuestionTypeNames
} from '../model/assessment-question-bank-schema';
import type { AssessmentQuestionFilters } from '../model/use-assessment-question-filters';
import type { TopicAxisOption } from '../model/use-question-bank-masters';
import type { AssessmentQuestionNumber } from '../model/assessment-question-bank-types';
import {
  SearchBar,
  SearchBarDetailField
} from '../../../shared/ui/search-bar/search-bar';

const { Text } = Typography;

type AssessmentQuestionBankToolbarProps = {
  filters: AssessmentQuestionFilters;
  topicOptions: TopicAxisOption[];
  resultCount: number;
};

/**
 * Shared toolbar for both split question-bank pages (문항 목록 / 문항 관리): the
 * 51~54 question-number multi-select plus the common 목록형 `SearchBar` with the
 * 주제(종합/세부, topic_master 기반 2단 셀렉트)/유형/난이도(1~6) 상세 검색
 * popover (§7.2). Page-specific status filters live in each page's summary
 * cards, not here.
 */
export function AssessmentQuestionBankToolbar({
  filters,
  topicOptions,
  resultCount
}: AssessmentQuestionBankToolbarProps): JSX.Element {
  const {
    activeQuestionNumbers,
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
  } = filters;

  const activeTopicDetails =
    topicOptions.find((option) => option.topicMain === draftTopicMainFilter)
      ?.topicDetails ?? [];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div role="group" aria-label="문제 번호 필터">
        <Space wrap size={[16, 8]}>
          {assessmentQuestionNumberTabItems.map((item) => (
            <Checkbox
              key={item.key}
              checked={activeQuestionNumbers.includes(
                item.key as AssessmentQuestionNumber
              )}
              onChange={(event) =>
                handleQuestionNumberToggle(
                  item.key as AssessmentQuestionNumber,
                  event.target.checked
                )
              }
            >
              {item.label}
            </Checkbox>
          ))}
        </Space>
      </div>
      <SearchBar
        searchField="all"
        searchFieldOptions={[{ label: '전체', value: 'all' }]}
        showSingleFieldSelect
        searchFieldAriaLabel="검색 범위"
        keyword={keyword}
        keywordAriaLabel="문항 검색어"
        onSearchFieldChange={() => undefined}
        onKeywordChange={(event) =>
          commitParams({
            keyword: event.target.value || null
          })
        }
        keywordPlaceholder="문항 ID, 주제, 상황 요약, 키워드를 검색하세요."
        detailTitle="상세 검색"
        detailContent={
          <Form layout="vertical">
            <SearchBarDetailField label="주제(종합)">
              <Select
                aria-label="주제 종합 필터"
                popupMatchSelectWidth={false}
                value={draftTopicMainFilter ?? 'all'}
                options={[
                  { label: '전체', value: 'all' },
                  ...topicOptions.map((option) => ({
                    label: option.topicMain,
                    value: option.topicMain
                  }))
                ]}
                onChange={(value) => {
                  setDraftTopicMainFilter(value === 'all' ? null : value);
                  setDraftTopicDetailFilter(null);
                }}
                style={{ width: '100%' }}
              />
            </SearchBarDetailField>
            <SearchBarDetailField label="주제(세부)">
              <Select
                aria-label="주제 세부 필터"
                popupMatchSelectWidth={false}
                value={draftTopicDetailFilter ?? 'all'}
                disabled={!draftTopicMainFilter || activeTopicDetails.length === 0}
                options={[
                  { label: '전체', value: 'all' },
                  ...activeTopicDetails.map((topicDetail) => ({
                    label: topicDetail,
                    value: topicDetail
                  }))
                ]}
                onChange={(value) =>
                  setDraftTopicDetailFilter(value === 'all' ? null : value)
                }
                style={{ width: '100%' }}
              />
            </SearchBarDetailField>
            <SearchBarDetailField label="유형">
              <Select
                aria-label="유형 필터"
                popupMatchSelectWidth={false}
                value={draftQuestionTypeFilter ?? 'all'}
                options={[
                  { label: '전체', value: 'all' },
                  ...assessmentQuestionTypeNames.map((questionType) => ({
                    label: questionType,
                    value: questionType
                  }))
                ]}
                onChange={(value) =>
                  setDraftQuestionTypeFilter(value === 'all' ? null : value)
                }
                style={{ width: '100%' }}
              />
            </SearchBarDetailField>
            <SearchBarDetailField label="난이도">
              <Select
                aria-label="난이도 필터"
                popupMatchSelectWidth={false}
                value={draftDifficultyFilter ?? 'all'}
                options={[
                  { label: '전체', value: 'all' },
                  ...assessmentDifficultyLevels.map((difficulty) => ({
                    label: `난이도 ${difficulty}`,
                    value: String(difficulty)
                  }))
                ]}
                onChange={(value) =>
                  setDraftDifficultyFilter(value === 'all' ? null : value)
                }
                style={{ width: '100%' }}
              />
            </SearchBarDetailField>
          </Form>
        }
        onApply={handleApplySearchDetail}
        onDetailOpenChange={handleSearchDetailOpenChange}
        onReset={handleResetSearchDetail}
        summary={
          <Text type="secondary">
            현재 결과 {resultCount.toLocaleString()}문항
          </Text>
        }
      />
    </Space>
  );
}
