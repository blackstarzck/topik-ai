import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchQuestionBankActiveTagsSafe,
  fetchQuestionBankTagMasterSafe,
  fetchQuestionBankTopicMasterSafe,
  fetchWritingQuestionInstitutionsSafe
} from '../api/assessment-question-bank-service';
import type {
  TopikWritingQuestionTagRow,
  TopikWritingTagMasterRow,
  TopikWritingTopicMasterRow,
  WritingQuestionInstitutionRow
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

export type UseQuestionBankTagsResult = {
  tagsByQuestionId: Record<string, TopikWritingQuestionTagRow[]>;
  tagCountByQuestionId: Record<string, number>;
  reload: () => void;
};

/**
 * 활성 태그 일괄 조인(목록 1회) — manage 목록의 태그 수 표시 + 태그 편집(P4
 * 관리 포인트)의 활성 태그 소스. write 후 reload로 재조회한다.
 */
export function useQuestionBankTags(): UseQuestionBankTagsResult {
  const [tags, setTags] = useState<TopikWritingQuestionTagRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const tagsByQuestionId = useMemo(() => {
    const byQuestion: Record<string, TopikWritingQuestionTagRow[]> = {};
    tags.forEach((tag) => {
      (byQuestion[tag.questionId] ??= []).push(tag);
    });
    return byQuestion;
  }, [tags]);

  const tagCountByQuestionId = useMemo(() => {
    const counts: Record<string, number> = {};
    tags.forEach((tag) => {
      counts[tag.questionId] = (counts[tag.questionId] ?? 0) + 1;
    });
    return counts;
  }, [tags]);

  return { tagsByQuestionId, tagCountByQuestionId, reload };
}

export type UseQuestionBankTagMasterResult = {
  tagMasterRows: TopikWritingTagMasterRow[];
  status: 'pending' | 'success' | 'error';
};

/** 태그 값 사전 로딩 — 태그 편집 옵션 축 + 그룹 판정(POL-018 ②③ 화면 가드). */
export function useQuestionBankTagMaster(): UseQuestionBankTagMasterResult {
  const [tagMasterRows, setTagMasterRows] = useState<TopikWritingTagMasterRow[]>([]);
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');

  useEffect(() => {
    const controller = new AbortController();

    void fetchQuestionBankTagMasterSafe(controller.signal).then((result) => {
      if (controller.signal.aborted) {
        return;
      }
      if (!result.ok) {
        setStatus('error');
        return;
      }
      setTagMasterRows(result.data);
      setStatus('success');
    });

    return () => {
      controller.abort();
    };
  }, []);

  return { tagMasterRows, status };
}

export type UseQuestionInstitutionsResult = {
  institutionsByQuestionId: Record<string, WritingQuestionInstitutionRow[]>;
  reload: () => void;
};

/**
 * 활성 기관 노출 매핑 일괄 조인(목록 1회) — manage 목록의 '기관 노출' 칩 + 설정
 * 모달의 현재 허용 기관 소스. write 후 reload로 재조회한다(useQuestionBankTags 대칭).
 */
export function useQuestionInstitutions(): UseQuestionInstitutionsResult {
  const [rows, setRows] = useState<WritingQuestionInstitutionRow[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void fetchWritingQuestionInstitutionsSafe(undefined, controller.signal).then(
      (result) => {
        if (controller.signal.aborted || !result.ok) {
          return;
        }
        setRows(result.data);
      }
    );

    return () => {
      controller.abort();
    };
  }, [reloadKey]);

  const reload = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const institutionsByQuestionId = useMemo(() => {
    const byQuestion: Record<string, WritingQuestionInstitutionRow[]> = {};
    rows.forEach((row) => {
      (byQuestion[row.questionId] ??= []).push(row);
    });
    return byQuestion;
  }, [rows]);

  return { institutionsByQuestionId, reload };
}
