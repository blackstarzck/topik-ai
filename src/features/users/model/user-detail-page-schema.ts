import type {
  UserActivityEvent,
  UserAdminMemo,
  UserCommunityPost,
  UserPaymentRecord
} from '../api/users-service';
import type { UserStatus } from '../model/types';

// 회원 상세 화면의 순수 스키마 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 조회 상태·조치/메모 핸들러·탭 상태는 페이지가 소유한다.

export const emptyProfileValue = '-';

export const detailPaymentStatusFilterValues = ['완료', '환불', '실패', '대기'] as const;
export const detailCommunityBoardFilterValues = ['자유게시판', '후기', '질문'] as const;
export const detailCommunityStatusFilterValues = ['게시', '숨김'] as const;

export const learningWeaknessSourceLabels: Record<string, string> = {
  tag: '태그',
  writing_dimension: '작문 영역',
  goal: '목표'
};

export const writingFeedbackStatusLabels: Record<string, string> = {
  complete: '완료',
  analyzing: '분석 중',
  pending: '대기',
  failed: '실패'
};

// 소요 시간(초) 표시. null = 미수집(소요시간 수집 계약 이전 제출)이며 0초와 구분한다.
export const formatElapsedSeconds = (value: number | null): string => {
  if (value == null) {
    return '미수집';
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  return minutes > 0 ? `${minutes}분 ${seconds}초` : `${seconds}초`;
};

// v13 온보딩(LearningGoalForm)의 weakAreas i18n과 동일한 약점 슬러그 → 한글 매핑.
// 출처가 goal인 약점은 v13 약점 슬러그로 저장되므로 사용자 화면과 동일한 한글 라벨로 표시한다.
// 매핑이 없는 값(태그/영역 등 다른 출처)은 원문을 그대로 노출한다.
export const learningWeaknessAreaLabels: Record<string, string> = {
  vocabulary: '어휘',
  grammar: '문법',
  'reading-comprehension': '읽기 이해',
  'listening-comprehension': '듣기 이해',
  'essay-thesis': '논술 주제',
  'essay-structure': '논술 구조',
  'short-answer': '단답 작성',
  'long-form-cohesion': '장문 결속'
};

export const formatWeaknessLabel = (label: string): string =>
  learningWeaknessAreaLabels[label] ?? label;

export type UsersDetailTabKey =
  | 'profile'
  | 'affiliation'
  | 'learning'
  | 'activity'
  | 'payments'
  | 'community'
  | 'admin-memo';

export type PendingAction = 'suspend' | 'unsuspend' | 'withdraw' | null;

export type ActionMeta = {
  title: string;
  confirmText: string;
  description: string;
  nextStatus: UserStatus;
};

export type DetailModalState = {
  title: string;
  record: Record<string, unknown>;
} | null;

export function renderProfileValue(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed : emptyProfileValue;
}

export const allowedTabs: readonly UsersDetailTabKey[] = [
  'profile',
  'affiliation',
  'learning',
  'activity',
  'payments',
  'community',
  'admin-memo'
];

export function isUsersDetailTab(value: string | null): value is UsersDetailTabKey {
  return typeof value === 'string' && allowedTabs.includes(value as UsersDetailTabKey);
}

export function buildActionMeta(
  currentStatus: UserStatus
): Record<Exclude<PendingAction, null>, ActionMeta> {
  return {
    suspend: {
      title: '회원 정지',
      confirmText: '정지 실행',
      description: '회원 기능을 즉시 제한합니다. 조치 사유와 근거를 기록하세요.',
      nextStatus: '정지'
    },
    unsuspend: {
      title: '회원 정지 해제',
      confirmText: '정지 해제',
      description: '회원 기능을 다시 활성화합니다. 해제 사유와 근거를 기록하세요.',
      nextStatus: '정상'
    },
    withdraw: {
      title: '회원 탈퇴 처리',
      confirmText: '탈퇴 처리',
      description: '복구가 어려운 조치입니다. 대상과 사유를 반드시 다시 확인하세요.',
      nextStatus: currentStatus === '탈퇴' ? '탈퇴' : '탈퇴'
    }
  };
}

// 아래 4종은 mock 표시용 행 파생 memo 본문을 그대로 옮긴 순수 함수다(supabase 모드는 미사용).
export function buildUserActivityRows(userId: string): UserActivityEvent[] {
  return [
  {
    id: `${userId}-A1`,
    type: '문제 제출',
    reference: 'PR 3f9a1c2b',
    createdAt: '2026-03-03 09:12'
  },
  {
    id: `${userId}-A2`,
    type: '작문 제출',
    reference: 'WS 7c2d4e10',
    createdAt: '2026-03-03 12:40'
  }
];
}

export function buildUserPaymentRows(userId: string): UserPaymentRecord[] {
  return [
  {
    id: `${userId}-P1`,
    product: 'TOPIK Premium Monthly',
    amount: '₩9,000',
    method: '카드',
    paidAt: '2026-02-14',
    status: '완료'
  },
  {
    id: `${userId}-P2`,
    product: 'TOPIK Mock Test',
    amount: '₩5,000',
    method: '계좌이체',
    paidAt: '2026-01-03',
    status: '환불'
  }
];
}

export function buildUserCommunityRows(userId: string): UserCommunityPost[] {
  return [
  {
    id: `${userId}-C1`,
    title: '필기 연습 노트도 공유합니다',
    board: '자유게시판',
    createdAt: '2026-02-21',
    reports: 0,
    status: '게시'
  },
  {
    id: `${userId}-C2`,
    title: '시험 후기 공유',
    board: '후기',
    createdAt: '2026-01-20',
    reports: 2,
    status: '숨김'
  }
];
}

export function buildUserMemoRows(userId: string): UserAdminMemo[] {
  return [
  {
    id: `${userId}-M1`,
    admin: 'admin_park',
    content: '결제 문의 확인 후 환불 처리 가이드 전달',
    createdAt: '2026-02-15'
  },
  {
    id: `${userId}-M2`,
    admin: 'admin_kim',
    content: '커뮤니티 신고 건 모니터링 필요',
    createdAt: '2026-02-22'
  }
];
}
