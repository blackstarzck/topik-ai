import { useEffect, useMemo, useState } from 'react';

import {
  fetchQuestionBankActiveTagsSafe,
  fetchQuestionBankTopicMasterSafe
} from '../api/assessment-question-bank-service';
import type {
  TopikWritingQuestionTagRow,
  TopikWritingTopicMasterRow
} from './assessment-question-bank-types';

export type TopicAxisOption = {
  topicMain: string;
  topicDetails: string[];
};

export type UseQuestionBankTopicMasterResult = {
  topicOptions: TopicAxisOption[];
  status: 'pending' | 'success' | 'error';
};

/**
 * §7.2 마스터 로딩 훅: 주제 필터 축을 정적 8값 상수 대신
 * `topik_writing_topic_master`(17주제·세부 85쌍)에서 비동기 로딩한다.
 * legacy/mock 소스는 facade가 대체 축을 공급한다.
 */
export function useQuestionBankTopicMaster(): UseQuestionBankTopicMasterResult {
  const [rows, setRows] = useState<TopikWritingTopicMasterRow[]>([]);
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    const controller = new AbortController();

    void fetchQuestionBankTopicMasterSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }

      if (!result.ok) {
        setStatus('error');
        return;
      }

      setRows(result.data);
      setStatus('success');
    });

    return () => {
      controller.abort();
    };
  }, []);

  const topicOptions = useMemo<TopicAxisOption[]>(() => {
    const byMain = new Map<string, string[]>();
    rows.forEach((row) => {
      const details = byMain.get(row.topicMain) ?? [];
      if (row.topicDetail) {
        details.push(row.topicDetail);
      }
      byMain.set(row.topicMain, details);
    });
    return [...byMain.entries()].map(([topicMain, topicDetails]) => ({
      topicMain,
      topicDetails
    }));
  }, [rows]);

  return { topicOptions, status };
}

export type UseQuestionTagCountsResult = {
  tagCountByQuestionId: Record<string, number>;
};

/** 활성 태그 일괄 조인(목록 1회) — manage 목록의 태그 수 표시용(P4 편집 전 단계). */
export function useQuestionTagCounts(): UseQuestionTagCountsResult {
  const [tags, setTags] = useState<TopikWritingQuestionTagRow[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    void fetchQuestionBankActiveTagsSafe(controller.signal).then((result) => {
      if (controller.signal.aborted || !result.ok) {
        return;
      }
      setTags(result.data);
    });

    return () => {
      controller.abort();
    };
  }, []);

  const tagCountByQuestionId = useMemo(() => {
    const counts: Record<string, number> = {};
    tags.forEach((tag) => {
      counts[tag.questionId] = (counts[tag.questionId] ?? 0) + 1;
    });
    return counts;
  }, [tags]);

  return { tagCountByQuestionId };
}
