import type {
  CommunityAdminMemo as AdminMemo,
  CommunityPolicyCode as PolicyCode,
  CommunityPost
} from './types';

// 게시글 관리 페이지의 정책 코드·메모 유형 카탈로그 — Phase 4 분해로 페이지에서 이동(값 동일).
export type MemoType =
  | 'SPAM'
  | '욕설/혐오'
  | '성인/불법'
  | '광고/홍보'
  | '개인정보 노출'
  | '중복 게시'
  | '기타';

export type PostActionState =
  | { type: 'show'; post: CommunityPost }
  | { type: 'hide'; post: CommunityPost }
  | { type: 'delete'; post: CommunityPost }
  | null;

export const postBoardFilterValues = ['자유게시판', '질문', '후기'] as const;
export const postStatusFilterValues = ['게시', '숨김'] as const;

export const moderationPolicyCodeOptions = [
  {
    label: 'SPAM · 스팸/도배',
    value: 'SPAM',
    description: '반복 게시, 도배, 자동 생성형 콘텐츠처럼 정상 이용을 방해하는 게시글입니다.'
  },
  {
    label: 'ABUSE · 욕설/혐오',
    value: 'ABUSE',
    description: '욕설, 혐오 표현, 괴롭힘 등 커뮤니티 운영 정책 위반 게시글입니다.'
  },
  {
    label: 'AD · 광고/홍보',
    value: 'AD',
    description: '허용되지 않은 외부 홍보, 제휴 링크, 영리 목적 광고 게시글입니다.'
  },
  {
    label: 'PRIVACY · 개인정보 노출',
    value: 'PRIVACY',
    description: '전화번호, 계좌, 주소 등 민감한 개인정보가 직접 노출된 게시글입니다.'
  },
  {
    label: 'DUPLICATE · 중복 게시',
    value: 'DUPLICATE',
    description: '동일 또는 유사한 내용을 반복 게시해 정리가 필요한 게시글입니다.'
  },
  {
    label: 'OTHER · 기타',
    value: 'OTHER',
    description: '정책 코드에 없는 사유이지만 운영 검토 결과 조치가 필요한 게시글입니다.'
  }
] as const;

export const moderationPolicyCodeLabelMap: Record<PolicyCode, string> = {
  SPAM: 'SPAM · 스팸/도배',
  ABUSE: 'ABUSE · 욕설/혐오',
  AD: 'AD · 광고/홍보',
  PRIVACY: 'PRIVACY · 개인정보 노출',
  DUPLICATE: 'DUPLICATE · 중복 게시',
  OTHER: 'OTHER · 기타'
};

export const memoTypeOptions = [
  { label: 'SPAM', value: 'SPAM' },
  { label: '욕설/혐오', value: '욕설/혐오' },
  { label: '성인/불법', value: '성인/불법' },
  { label: '광고/홍보', value: '광고/홍보' },
  { label: '개인정보 노출', value: '개인정보 노출' },
  { label: '중복 게시', value: '중복 게시' },
  { label: '기타', value: '기타' }
] as const;

export const memoTypeLabelMap: Record<MemoType, string> = {
  SPAM: 'SPAM',
  '욕설/혐오': '욕설/혐오',
  '성인/불법': '성인/불법',
  '광고/홍보': '광고/홍보',
  '개인정보 노출': '개인정보 노출',
  '중복 게시': '중복 게시',
  기타: '기타'
};

export function getMemoTypeLabel(type: string): string {
  return memoTypeLabelMap[type as MemoType] ?? type;
}

export function getLatestAdminMemo(post: CommunityPost): AdminMemo | null {
  return [...post.adminNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}
