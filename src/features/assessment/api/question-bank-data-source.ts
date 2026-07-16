import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

/**
 * 문항 은행 데이터 소스.
 *
 * - 'topik_writing' — 신규 스키마 읽기(추천 뷰 + 번호별 테이블) +
 *                     `admin_update_topik_question` 노출 통제 쓰기(P4 개방).
 *                     **P3 컷오버(2026-06-11) 이후 기본값.**
 * - 'mock'          — Supabase 미구성/`VITE_SUPABASE_DISABLED` 시 결정적 픽스처
 *                     (D-12: CI·스모크 e2e 실행 경로).
 *
 * 인바운드 모델(결정 기록 §0): 문항은 외부(공급) API에서 수신·적재되며 admin은
 * 조회 + 관리 포인트(태그) + 노출 통제만 수행한다(검수 개념 삭제).
 */
export type QuestionBankDataSource = 'topik_writing' | 'mock';

export function resolveQuestionBankDataSource(): QuestionBankDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return 'topik_writing';
}

export const questionBankDataSource = resolveQuestionBankDataSource();
