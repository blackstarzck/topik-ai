/**
 * 외부 공급 API에서 가져와 무손실 인박스(topik_writing_question_import)에 적재된
 * "가져온 문항"의 화면 표시 모델. 현재는 목록(/api/writing/tasks)의 얇은 필드
 * (제목·주제·난이도 등)만 담긴다 — 본문·정답은 상류 id별 상세 엔드포인트가
 * 생기면 보강(promote)한다. 표시값 일부(title/topic/generatedBy/difficulty)는
 * raw_payload(원문)에서 파생한다.
 */
export type ImportedTaskMappingStatus = 'raw' | 'mapped' | 'promoted' | 'held';

export type ImportedTaskVersionDecision =
  | 'legacy'
  | 'initial'
  | 'content_changed'
  | 'metadata_only'
  | 'out_of_order'
  | 'timestamp_conflict'
  | 'identity_conflict'
  | 'invalid_timestamp';

export type ImportedWritingTask = {
  importId: number;
  /** 상류 task.id (멱등 키). */
  sourceTaskId: string;
  /** 51/52/53/54 또는 미상(null). */
  itemNumber: number | null;
  title: string;
  topic: string;
  generatedBy: string;
  difficultyLevel: number | null;
  mappingStatus: ImportedTaskMappingStatus;
  /** 같은 question_id에서 가장 최근에 수신한 원문 행. 서비스 현재 버전과 무관하다. */
  isLatestReceived: boolean;
  versionDecision: ImportedTaskVersionDecision;
  holdReason: string;
  promotedQuestionId: string | null;
  sourceCreatedAt: string;
  sourceUpdatedAt: string;
  contentHash: string;
  sourceEndpoint: string;
  ingestCount: number;
  /** KST 분 단위 표시 문자열. */
  fetchedAt: string;
  lastSeenAt: string;
};
