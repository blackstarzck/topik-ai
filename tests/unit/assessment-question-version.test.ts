import { describe, expect, it } from 'vitest';

import {
  mapAssessmentQuestionVersionEntryRow,
  mapAssessmentQuestionVersionSummaryRow
} from '../../src/features/assessment/api/topik-writing-question-bank-service';
import { loadMockQuestionVersionDetail } from '../../src/features/assessment/api/mock-question-bank-service';
import {
  buildQuestionBankListHref,
  buildQuestionDetailHref,
  parseQuestionVersionId
} from '../../src/features/assessment/model/question-version-navigation';

describe('Assessment 문항 버전 조회 계약', () => {
  it('DB bigint 문자열과 집계 값을 안전한 화면 모델로 변환한다', () => {
    expect(
      mapAssessmentQuestionVersionSummaryRow({
        question_id: 'question-51-a',
        canonical_import_id: '103',
        version_count: '3',
        revision_count: '2'
      })
    ).toEqual({
      questionId: 'question-51-a',
      canonicalImportId: 103,
      versionCount: 3,
      revisionCount: 2
    });

    expect(
      mapAssessmentQuestionVersionEntryRow({
        import_id: '102',
        promoted_question_id: 'question-51-a',
        item_number: '51',
        payload_hash: 'hash-102',
        content_hash: 'content-hash-102',
        source_created_at: '2026-07-01T00:00:00.000Z',
        source_updated_at: '2026-07-15T00:00:00.000Z',
        first_seen_at: '2026-07-15T01:02:03.000Z',
        last_seen_at: '2026-07-15T04:05:06.000Z',
        ingest_count: '4'
      })
    ).toEqual({
      questionId: 'question-51-a',
      importId: 102,
      itemNumber: '51',
      payloadHash: 'hash-102',
      contentHash: 'content-hash-102',
      sourceCreatedAt: '2026-07-01 00:00',
      sourceUpdatedAt: '2026-07-15 00:00',
      firstSeenAt: '2026-07-15 01:02',
      lastSeenAt: '2026-07-15 04:05',
      ingestCount: 4
    });
  });

  it('현재 포인터가 없으면 0회로 정규화하지 않는다', () => {
    expect(
      mapAssessmentQuestionVersionSummaryRow({
        question_id: 'question-unlinked',
        canonical_import_id: null,
        version_count: 0,
        revision_count: 0
      }).canonicalImportId
    ).toBeNull();
  });

  it('목록 필터를 보존하고 상세 전용 파라미터만 추가·제거한다', () => {
    const historyHref = buildQuestionDetailHref(
      'question-51-a',
      '?questionNo=51&keyword=%EA%B5%90%EC%9C%A1',
      'history',
      102
    );
    expect(historyHref).toContain('/assessment/question-bank/question-51-a?');
    expect(historyHref).toContain('questionNo=51');
    expect(historyHref).toContain('keyword=%EA%B5%90%EC%9C%A1');
    expect(historyHref).toContain('detailTab=history');
    expect(historyHref).toContain('versionId=102');

    expect(
      buildQuestionBankListHref(
        '?questionNo=51&selected=legacy&tab=legacy&detailTab=history&versionId=102'
      )
    ).toBe('/assessment/question-bank?questionNo=51&selected=legacy&tab=legacy');
  });

  it('양의 정수 버전 ID만 허용한다', () => {
    expect(parseQuestionVersionId('102')).toBe(102);
    expect(parseQuestionVersionId('0')).toBeNull();
    expect(parseQuestionVersionId('-1')).toBeNull();
    expect(parseQuestionVersionId('1.5')).toBeNull();
    expect(parseQuestionVersionId('abc')).toBeNull();
  });

  it('다른 문항에 속한 import ID의 과거 상세를 차단한다', async () => {
    await expect(
      loadMockQuestionVersionDetail('topik-writing-52-9901', 5102)
    ).rejects.toThrow('선택한 문항 버전을 찾을 수 없습니다.');

    const historical = await loadMockQuestionVersionDetail(
      'topik-writing-51-9901',
      5102
    );
    expect(historical.question.serviceStatus).toBeNull();
    expect(historical.question.questionId).toBe('topik-writing-51-9901');
  });
});
