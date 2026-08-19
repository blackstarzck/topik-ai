import {
  Button,
  Checkbox,
  DatePicker,
  Divider,
  Drawer,
  Segmented,
  Select,
  Switch,
  Tag,
  Typography
} from 'antd';
import dayjs from 'dayjs';
import type { Dispatch, SetStateAction } from 'react';

import type { LearningAnalyticsFilterOptions } from '../api/analytics-learning-service';
import {
  defaultLearningAnalyticsQuery,
  learningDetailKeysByQuestion,
  learningQuestionLabels,
  resolveLearningAnalyticsDateRange,
  type LearningAnalyticsPeriod,
  type LearningAnalyticsQuery,
  type LearningQuestionNo
} from '../model/analytics-learning-query';
import {
  detailFilterLabels,
  getAppliedConditionTags,
  periodOptions
} from '../model/analytics-learning-page-schema';
import {
  DrawerFooter,
  DrawerTitle,
  mergeDrawerFrameStyles
} from '@/shared/ui/drawer-frame/drawer-frame';

const { Text, Title } = Typography;
const { RangePicker } = DatePicker;

// 분석 조건 Drawer — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 초안 상태와 적용 판정은 페이지가 소유하고, 파생 표시값(기간 범위·선택 문제·선택 주제)은
// 초안에서 다시 계산한다.

export type LearningConditionDrawerProps = {
  open: boolean;
  draftQuery: LearningAnalyticsQuery;
  draftChanged: boolean;
  filterOptions: LearningAnalyticsFilterOptions;
  onDraftChange: Dispatch<SetStateAction<LearningAnalyticsQuery>>;
  onApply: () => void;
  onClose: () => void;
};

export function LearningConditionDrawer({
  open,
  draftQuery,
  draftChanged,
  filterOptions,
  onDraftChange,
  onApply,
  onClose
}: LearningConditionDrawerProps): JSX.Element {
  const draftRange = resolveLearningAnalyticsDateRange(draftQuery);
  const selectedQuestion =
    draftQuery.questions.length === 1 ? draftQuery.questions[0] : null;
  const selectedTopic = filterOptions.topics.find(
    (topic) => topic.topicMain === draftQuery.topicMain
  );

  return (
    <Drawer
      className="analytics-condition-drawer"
      rootClassName="analytics-condition-drawer-root"
      width={320}
      mask={false}
      push={false}
      open={open}
      onClose={onClose}
      title={<DrawerTitle>분석 조건</DrawerTitle>}
      styles={mergeDrawerFrameStyles({
        body: { padding: '0 16px 20px' },
        footer: { padding: '20px 12px' }
      })}
      footer={
        <DrawerFooter
          start={<Button size="large" onClick={onClose}>취소</Button>}
          end={
            <>
              <Button size="large" onClick={() => onDraftChange(defaultLearningAnalyticsQuery)}>초기화</Button>
              <Button size="large" type="primary" onClick={onApply}>분석 적용</Button>
            </>
          }
        />
      }
    >
      <div className="analytics-condition-drawer__body">
        <div className="condition-drawer-intro">
          <Text>모든 분석 섹션에 동일하게 적용됩니다.</Text>
          <Tag color={draftChanged ? 'gold' : 'blue'}>{draftChanged ? '미적용 변경 있음' : '현재 적용 중'}</Tag>
        </div>

        <section className="condition-section">
          <Title level={5}>기간</Title>
          <Segmented
            block
            size="small"
            value={draftQuery.period}
            options={periodOptions}
            onChange={(value) =>
              onDraftChange((current) => ({
                ...current,
                period: value as LearningAnalyticsPeriod,
                compare: value === 'all' ? false : current.compare
              }))
            }
          />
          <RangePicker
            aria-label="직접 분석 기간"
            allowEmpty={[true, true]}
            format="YYYY-MM-DD"
            value={
              draftQuery.from && draftQuery.to
                ? [dayjs(draftQuery.from), dayjs(draftQuery.to)]
                : null
            }
            disabled={draftQuery.period !== 'custom'}
            onChange={(values) =>
              onDraftChange((current) => ({
                ...current,
                from: values?.[0]?.format('YYYY-MM-DD') ?? null,
                to: values?.[1]?.format('YYYY-MM-DD') ?? null
              }))
            }
          />
          <div className="condition-switch-row">
            <Text>이전 동일 기간 비교</Text>
            <Switch
              checked={draftQuery.compare && draftQuery.period !== 'all'}
              disabled={draftQuery.period === 'all'}
              onChange={(checked) => onDraftChange((current) => ({ ...current, compare: checked }))}
            />
          </div>
          <Text type="secondary" className="condition-helper">
            {draftRange.startDate && draftRange.endDate
              ? `${draftRange.startDate}~${draftRange.endDate} · KST · 종료일 포함`
              : '전체 기간 · 이전 기간 비교 없음'}
          </Text>
        </section>

        <Divider />

        <section className="condition-section">
          <Title level={5}>문제 유형</Title>
          <Text type="secondary" className="condition-helper">선택 항목 내부는 OR로 집계합니다.</Text>
          <Checkbox.Group
            className="question-checkbox-group"
            value={draftQuery.questions}
            onChange={(values) => {
              const questions = values
                .map(Number)
                .filter((value): value is LearningQuestionNo => value >= 51 && value <= 54)
                .sort();
              onDraftChange((current) => ({
                ...current,
                questions,
                detailFilters: questions.length === 1 ? current.detailFilters : {}
              }));
            }}
            options={([51, 52, 53, 54] as LearningQuestionNo[]).map((question) => ({
              label: learningQuestionLabels[question],
              value: question
            }))}
          />
        </section>

        <Divider />

        <section className="condition-section">
          <Title level={5}>주제</Title>
          <Text type="secondary" className="condition-helper">문제 유형과 독립된 필터 축이며, 축 사이는 AND입니다.</Text>
          <label className="condition-field">
            <span>대주제</span>
            <Select
              value={draftQuery.topicMain}
              placeholder="전체"
              allowClear
              options={filterOptions.topics.map((topic) => ({ label: topic.topicMain, value: topic.topicMain }))}
              onChange={(value) => onDraftChange((current) => ({ ...current, topicMain: value ?? null, topicDetail: null }))}
            />
          </label>
          <label className="condition-field">
            <span>세부 주제</span>
            <Select
              value={draftQuery.topicDetail}
              placeholder="전체"
              allowClear
              disabled={!draftQuery.topicMain}
              options={(selectedTopic?.topicDetails ?? []).map((topic) => ({ label: topic, value: topic }))}
              onChange={(value) => onDraftChange((current) => ({ ...current, topicDetail: value ?? null }))}
            />
          </label>
        </section>

        <Divider />

        <section className="condition-section">
          <Title level={5}>유형별 세부</Title>
          {!selectedQuestion ? (
            <Select disabled placeholder="문제 유형 1개 선택 시 사용" />
          ) : (
            learningDetailKeysByQuestion[selectedQuestion].map((key) => (
              <label className="condition-field" key={key}>
                <span>{detailFilterLabels[key]}</span>
                <Select
                  mode="multiple"
                  allowClear
                  maxTagCount="responsive"
                  value={draftQuery.detailFilters[key] ?? []}
                  placeholder="전체"
                  options={(filterOptions.detailFilters[String(selectedQuestion) as `${LearningQuestionNo}`]?.[key] ?? []).map((value) => ({ label: value, value }))}
                  onChange={(values) =>
                    onDraftChange((current) => ({
                      ...current,
                      detailFilters: { ...current.detailFilters, [key]: values }
                    }))
                  }
                />
              </label>
            ))
          )}
          <Text type="secondary" className="condition-helper">같은 필드의 값은 OR, 서로 다른 필드는 AND로 집계합니다.</Text>
        </section>

        <Divider />

        <section className="condition-section condition-summary">
          <Title level={5}>적용될 조건</Title>
          <div className="analytics-condition-tags">
            {getAppliedConditionTags(draftQuery).map((tag) => <Tag key={tag}>{tag}</Tag>)}
          </div>
          <Text type="secondary">예상 범위: {draftRange.startDate && draftRange.endDate ? `${draftRange.startDate}~${draftRange.endDate}` : '전체 기간'}</Text>
        </section>
      </div>
    </Drawer>
  );
}
