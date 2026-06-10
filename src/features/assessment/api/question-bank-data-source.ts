import { isSupabaseConfigured } from '../../../shared/api/supabase-client';

/**
 * P3 컷오버 스위치 (실행계획안 §7.1·§12.2).
 *
 * - 'legacy'        — v13 `problems` 읽기 + `admin_update_problem` 쓰기(구 경로).
 *                     컷오버 전 기본값이자 컷오버 후 롤백 경로(P4 종료까지 보존).
 * - 'topik_writing' — 신규 스키마 읽기(추천 뷰 + 번호별 테이블) +
 *                     `admin_update_topik_question` 검수 쓰기.
 * - 'mock'          — Supabase 미구성/`VITE_SUPABASE_DISABLED` 시 결정적 픽스처
 *                     (D-12: CI·스모크 e2e 실행 경로).
 *
 * 컷오버 배포는 P2 채점 PASS 전환 후에만 한다: 그 시점에 기본값을
 * 'topik_writing'으로 플립(또는 env `VITE_QUESTION_BANK_SOURCE=topik_writing`)하고,
 * 롤백은 같은 스위치를 'legacy'로 되돌리는 것이다.
 */
export type QuestionBankDataSource = 'legacy' | 'topik_writing' | 'mock';

const env = import.meta.env as unknown as Record<string, string | undefined>;

export function resolveQuestionBankDataSource(): QuestionBankDataSource {
  if (!isSupabaseConfigured) {
    return 'mock';
  }

  return env.VITE_QUESTION_BANK_SOURCE === 'topik_writing'
    ? 'topik_writing'
    : 'legacy';
}

export const questionBankDataSource = resolveQuestionBankDataSource();
