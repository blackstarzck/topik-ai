import { create } from 'zustand';

import type {
  OperationPolicy,
  OperationPolicyCategory,
  OperationPolicyExposureSurface,
  OperationPolicyHistoryAction,
  OperationPolicyHistoryEntry,
  OperationPolicyRelatedAdminPage,
  OperationPolicyRelatedUserPage,
  OperationPolicyStatus,
  OperationPolicyTrackingStatus,
  OperationPolicyType
} from './policy-types';
import { inferOperationPolicyRelatedUserPages } from './policy-types';

const CURRENT_ACTOR = 'admin_current';

type SavePolicyPayload = {
  id?: string;
  category: OperationPolicyCategory;
  policyType: OperationPolicyType;
  title: string;
  versionLabel: string;
  effectiveDate: string;
  exposureSurfaces: OperationPolicyExposureSurface[];
  requiresConsent: boolean;
  trackingStatus: OperationPolicyTrackingStatus;
  relatedAdminPages: OperationPolicyRelatedAdminPage[];
  relatedUserPages: OperationPolicyRelatedUserPage[];
  sourceDocuments: string[];
  summary: string;
  legalReferences: string[];
  bodyHtml: string;
  adminMemo: string;
};

type TogglePolicyStatusPayload = {
  policyId: string;
  nextStatus: OperationPolicyStatus;
};

type DeletePolicyPayload = {
  policyId: string;
  reason: string;
};

type PublishPolicyHistoryVersionPayload = {
  policyId: string;
  historyId: string;
  reason: string;
};

type OperationPolicyStore = {
  policies: OperationPolicy[];
  policyHistories: OperationPolicyHistoryEntry[];
  savePolicy: (payload: SavePolicyPayload) => OperationPolicy;
  togglePolicyStatus: (
    payload: TogglePolicyStatusPayload
  ) => OperationPolicy | null;
  publishPolicyHistoryVersion: (
    payload: PublishPolicyHistoryVersionPayload
  ) => OperationPolicy | null;
  deletePolicy: (payload: DeletePolicyPayload) => OperationPolicy | null;
};

type SeedOperationPolicy = Omit<OperationPolicy, 'relatedUserPages'> & {
  relatedUserPages?: OperationPolicyRelatedUserPage[];
};

function formatNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function toDateString(dateTime: string): string {
  return dateTime.slice(0, 10);
}

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeStringList(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => normalizeText(value)).filter(Boolean))
  );
}

function normalizeLegalReferences(values: string[]): string[] {
  return normalizeStringList(values);
}

function normalizeRelatedAdminPages(
  values: OperationPolicyRelatedAdminPage[]
): OperationPolicyRelatedAdminPage[] {
  return normalizeStringList(values) as OperationPolicyRelatedAdminPage[];
}

function normalizeRelatedUserPages(
  values: OperationPolicyRelatedUserPage[]
): OperationPolicyRelatedUserPage[] {
  return normalizeStringList(values) as OperationPolicyRelatedUserPage[];
}

function normalizeHistoryNote(value: string): string {
  return normalizeText(value);
}

function clonePolicySnapshot(policy: OperationPolicy): OperationPolicy {
  return {
    ...policy,
    exposureSurfaces: [...policy.exposureSurfaces],
    relatedAdminPages: [...policy.relatedAdminPages],
    relatedUserPages: [...policy.relatedUserPages],
    sourceDocuments: [...policy.sourceDocuments],
    legalReferences: [...policy.legalReferences]
  };
}

function getNextPolicyId(policies: OperationPolicy[]): string {
  const sequence =
    policies
      .map((policy) => Number(policy.id.split('-')[1] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `POL-${String(sequence).padStart(3, '0')}`;
}

function getNextPolicyHistoryId(
  policyHistories: OperationPolicyHistoryEntry[]
): string {
  const sequence =
    policyHistories
      .map((entry) => Number(entry.id.split('-')[1] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `PH-${String(sequence).padStart(4, '0')}`;
}

function createPolicyHistoryEntry(
  policy: OperationPolicy,
  action: OperationPolicyHistoryAction,
  note: string,
  historyId: string,
  changedAt = policy.updatedAt,
  changedBy = policy.updatedBy
): OperationPolicyHistoryEntry {
  return {
    id: historyId,
    policyId: policy.id,
    action,
    versionLabel: policy.versionLabel,
    status: policy.status,
    trackingStatus: policy.trackingStatus,
    changedAt,
    changedBy,
    note: normalizeHistoryNote(note),
    snapshot: clonePolicySnapshot(policy)
  };
}

function appendPolicyHistory(
  policyHistories: OperationPolicyHistoryEntry[],
  policy: OperationPolicy,
  action: OperationPolicyHistoryAction,
  note: string,
  changedAt = policy.updatedAt,
  changedBy = policy.updatedBy
): OperationPolicyHistoryEntry[] {
  return [
    ...policyHistories,
    createPolicyHistoryEntry(
      policy,
      action,
      note,
      getNextPolicyHistoryId(policyHistories),
      changedAt,
      changedBy
    )
  ];
}

function createSeedPolicy(policy: SeedOperationPolicy): OperationPolicy {
  return {
    ...policy,
    relatedUserPages:
      policy.relatedUserPages ??
      inferOperationPolicyRelatedUserPages(
        policy.policyType,
        policy.exposureSurfaces
      )
  };
}

const initialPolicies: OperationPolicy[] = ([
  {
    id: 'POL-001',
    category: '법률/약관',
    policyType: '이용약관',
    title: 'TOPIK AI 이용약관',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-20',
    exposureSurfaces: ['회원가입', '마이페이지', '고객센터'],
    requiresConsent: true,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Operation > 정책 관리', 'Users > 회원 목록', 'Users > 회원 상세'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-policies-page-ia.md',
      'docs/specs/admin-data-usage-map.md'
    ],
    summary:
      '서비스 이용 조건, 계정 운영 기준, 결제 및 콘텐츠 이용 제한 사항을 정리한 기본 약관입니다.',
    legalReferences: ['전자상거래 등에서의 소비자보호에 관한 법률', '민법'],
    bodyHtml:
      '<h2>TOPIK AI 이용약관</h2><p>회원은 계정 생성 시 본 약관에 동의하며, 학습 서비스와 커뮤니티 기능을 약관 범위 내에서 이용할 수 있습니다.</p><table><tbody><tr><th>항목</th><th>내용</th></tr><tr><td>계정</td><td>1인 1계정 원칙</td></tr><tr><td>결제</td><td>결제ㆍ환불 정책을 별도 참조</td></tr></tbody></table>',
    adminMemo: '회원가입, 고객센터, 마이페이지 약관 링크의 기준 문서입니다.',
    status: '게시',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-20 09:10',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-002',
    category: '법률/약관',
    policyType: '개인정보 처리방침',
    title: 'TOPIK AI 개인정보 처리방침',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-20',
    exposureSurfaces: ['회원가입', '마이페이지', '고객센터', '앱 설정'],
    requiresConsent: true,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Operation > 정책 관리', 'Users > 회원 상세', 'Message > 메일'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-policies-page-ia.md',
      'docs/specs/admin-data-usage-map.md'
    ],
    summary:
      '수집 항목, 처리 목적, 보관 기간, 파기 절차와 같은 개인정보 처리 기준을 공지합니다.',
    legalReferences: ['개인정보 보호법', '정보통신망 이용촉진 및 정보보호 등에 관한 법률'],
    bodyHtml:
      '<h2>개인정보 처리방침</h2><p>회사는 회원가입, 결제, 학습 서비스 제공 과정에서 필요한 최소한의 개인정보를 수집합니다.</p><ul><li>수집 항목: 이메일, 닉네임, 결제 이력</li><li>보관 기간: 법령 및 내부 정책 기준</li></ul>',
    adminMemo: '앱 설정 법적 고지와 회원가입 하단 노출 기준 문서입니다.',
    status: '게시',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-20 09:25',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-003',
    category: '결제/리워드',
    policyType: '결제ㆍ환불 정책',
    title: '결제ㆍ환불 정책',
    versionLabel: 'v2026.04',
    effectiveDate: '2026-04-01',
    exposureSurfaces: ['결제', '마이페이지', '고객센터', '관리자 콘솔'],
    requiresConsent: true,
    trackingStatus: '문서 추적',
    relatedAdminPages: ['Commerce > 결제 내역', 'Commerce > 환불 관리', 'Commerce > 포인트 관리'],
    sourceDocuments: [
      'docs/specs/page-ia/commerce-refunds-page-ia.md',
      'docs/specs/page-ia/commerce-payments-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '결제 승인, 환불 가능 조건, 부분 환불 제한과 고객 안내 기준을 함께 추적하는 정책 문서입니다.',
    legalReferences: ['전자상거래 등에서의 소비자보호에 관한 법률', '전자상거래 등에서의 소비자보호 지침'],
    bodyHtml:
      '<h2>결제ㆍ환불 정책</h2><p>결제 후 7일 이내이면서 학습 이력이 없는 경우 전액 환불을 원칙으로 검토합니다.</p><ol><li>마이페이지 또는 고객센터에서 환불 요청 접수</li><li>운영 검토 후 승인/거절</li><li>결제 수단별 환불 완료 처리</li></ol><p>부분 환불과 고객 안내 메시지 연동은 후속 정책 확정이 필요합니다.</p>',
    adminMemo: '결제 내역/환불 관리 화면의 부분 환불, 고객 안내 규칙을 함께 추적합니다.',
    status: '게시',
    createdAt: '2026-03-21',
    updatedAt: '2026-03-24 15:40',
    updatedBy: 'admin_kim'
  },
  {
    id: 'POL-004',
    category: '커뮤니티/안전',
    policyType: '청소년 보호정책',
    title: '청소년 보호정책',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-22',
    exposureSurfaces: ['고객센터', '앱 설정', '관리자 콘솔'],
    requiresConsent: false,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Community > 게시글 관리', 'Community > 신고 관리', 'Operation > 정책 관리'],
    sourceDocuments: [
      'docs/specs/page-ia/community-posts-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '유해 정보 차단, 신고 접수, 청소년 보호 책임자 안내 등 커뮤니티 안전 운영 기준을 제공합니다.',
    legalReferences: ['청소년 보호법', '정보통신망 이용촉진 및 정보보호 등에 관한 법률'],
    bodyHtml:
      '<h2>청소년 보호정책</h2><p>회사는 청소년 유해 정보 노출 방지와 신고 처리 기준을 운영 정책으로 관리합니다.</p><ul><li>유해 정보 차단과 신고 접수 절차</li><li>청소년 보호 책임자 및 후속 안내 기준</li><li>커뮤니티 제재 정책과의 연결 규칙</li></ul>',
    adminMemo: '커뮤니티 안전 정책과 법적 고지 영역을 연결하는 기준 문서입니다.',
    status: '게시',
    createdAt: '2026-03-19',
    updatedAt: '2026-03-22 10:15',
    updatedBy: 'admin_han'
  },
  {
    id: 'POL-005',
    category: '커뮤니티/안전',
    policyType: '커뮤니티 게시글 제재 정책',
    title: '커뮤니티 게시글 제재 정책',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-25',
    exposureSurfaces: ['고객센터', '앱 설정', '관리자 콘솔'],
    requiresConsent: false,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Community > 게시글 관리', 'Community > 신고 관리', 'System > 감사 로그'],
    sourceDocuments: [
      'docs/specs/page-ia/community-posts-page-ia.md',
      'src/features/community/pages/community-posts-page.tsx'
    ],
    summary:
      '게시글 숨김/삭제 시 쓰는 정책 코드, 사유 입력, 내부 메모 기록 규칙을 정리한 제재 기준입니다.',
    legalReferences: ['정보통신망 이용촉진 및 정보보호 등에 관한 법률', '청소년 보호법'],
    bodyHtml:
      '<h2>커뮤니티 게시글 제재 정책</h2><p>게시글 조치 시 정책 코드와 자유 사유를 함께 기록하고, 감사 로그와 내부 메모를 남깁니다.</p><ul><li>SPAM · 스팸/도배</li><li>ABUSE · 욕설/혐오</li><li>AD · 광고/홍보</li><li>PRIVACY · 개인정보 노출</li><li>DUPLICATE · 중복 게시</li><li>OTHER · 기타</li></ul>',
    adminMemo: '게시글 관리의 ConfirmAction 정책 코드와 상세 IA를 기준으로 작성했습니다.',
    status: '게시',
    createdAt: '2026-03-22',
    updatedAt: '2026-03-25 11:05',
    updatedBy: 'admin_lee'
  },
  {
    id: 'POL-006',
    category: '결제/리워드',
    policyType: '추천인 보상 정책',
    title: '추천인 보상 정책',
    versionLabel: 'v2026.03-draft',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['관리자 콘솔', '마이페이지'],
    requiresConsent: false,
    trackingStatus: '문서 추적',
    relatedAdminPages: ['Users > 추천인 관리', 'Commerce > 포인트 관리', 'System > 감사 로그'],
    sourceDocuments: [
      'docs/specs/page-ia/users-referrals-page-ia.md',
      'src/features/users/pages/users-referrals-page.tsx'
    ],
    summary:
      '추천 코드 확정 시점, 보상 수단, 회수 규칙, 수동 보정 권한을 함께 정리하는 운영 정책 초안입니다.',
    legalReferences: ['서비스 운영 정책 초안', '추천인 관리 상세 IA'],
    bodyHtml:
      '<h2>추천인 보상 정책</h2><p>추천 코드는 추천인 1명당 1개를 기준으로 관리하며, 추천 확정과 보상 지급은 정책 스냅샷으로 기록합니다.</p><ul><li>확정 시점: 가입 완료 / 첫 결제 / 첫 학습 완료 후보</li><li>보상 수단: 포인트 / 쿠폰 / 혼합 후보</li><li>후속 검수: 추천 관계와 포인트 원장을 함께 확인</li></ul>',
    adminMemo: '추천인 페이지의 policySnapshot과 오픈 이슈를 정책 관리로 승격한 초안입니다.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 09:40',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-007',
    category: '결제/리워드',
    policyType: '포인트 운영정책',
    title: '포인트 운영정책',
    versionLabel: 'v2026.03-draft',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['관리자 콘솔', '결제', '마이페이지'],
    requiresConsent: false,
    trackingStatus: '문서 추적',
    relatedAdminPages: ['Commerce > 포인트 관리', 'Users > 추천인 관리', 'Operation > 이벤트'],
    sourceDocuments: [
      'docs/specs/page-ia/commerce-points-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '적립 원천 분류, 차감 우선순위, 소멸/보류/복구 기준, 수동 조정 승인 체계를 추적하는 운영 정책입니다.',
    legalReferences: ['포인트 관리 상세 IA', '서비스 운영 정책 초안'],
    bodyHtml:
      '<h2>포인트 운영정책</h2><p>포인트는 추천, 미션, 이벤트, 결제, 환불, 관리자, 시스템 원천으로 발생할 수 있으며 원장 단위로 검수합니다.</p><ul><li>차감 우선순위와 음수 잔액 허용 여부는 후속 확정 필요</li><li>소멸 예정/보류/복구 정책은 별도 승인 흐름 검토 필요</li><li>수동 조정은 감사 로그와 증빙 메모를 함께 남김</li></ul>',
    adminMemo: '포인트 관리 living IA의 정책 후보를 운영 정책으로 집약했습니다.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 09:55',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-008',
    category: '결제/리워드',
    policyType: '쿠폰 운영정책',
    title: '쿠폰 운영정책',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-24',
    exposureSurfaces: ['관리자 콘솔', '결제', '마이페이지'],
    requiresConsent: false,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Commerce > 쿠폰 관리', 'Operation > 이벤트', 'Message > 메일'],
    sourceDocuments: [
      'docs/specs/page-ia/commerce-coupons-page-ia.md',
      'docs/specs/page-ia/operation-events-page-ia.md'
    ],
    summary:
      '고객 다운로드, 자동 발행, 쿠폰 코드 생성, 지정 발행의 유형별 운영 규칙과 검증 기준을 모은 정책 문서입니다.',
    legalReferences: ['쿠폰 관리 상세 IA', '아임웹 운영 정책 확인 메모'],
    bodyHtml:
      '<h2>쿠폰 운영정책</h2><p>쿠폰은 고객 다운로드, 자동 발행, 쿠폰 코드 생성, 지정 발행 4가지 유형으로 운영합니다.</p><ul><li>첫 회원가입/첫 주문 완료/등급 변경/생일 자동 발행 규칙</li><li>무료 플랜 제한, 코드 수정 불가, 시크릿 링크 운영 기준</li><li>발행 중지/재개와 삭제는 사유 입력 및 감사 로그 추적 필수</li></ul>',
    adminMemo: '쿠폰 관리 상세 IA와 이벤트 보상 연결 규칙을 함께 반영했습니다.',
    status: '게시',
    createdAt: '2026-03-24',
    updatedAt: '2026-03-26 10:05',
    updatedBy: 'admin_lee'
  },
  {
    id: 'POL-009',
    category: '운영/콘텐츠',
    policyType: '이벤트 운영정책',
    title: '이벤트 운영정책',
    versionLabel: 'v2026.03-draft',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['관리자 콘솔', '고객센터'],
    requiresConsent: false,
    trackingStatus: '문서 추적',
    relatedAdminPages: ['Operation > 이벤트', 'Commerce > 쿠폰 관리', 'Message > 대상 그룹'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-events-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '이벤트 노출, 참여 조건, 보상 연결, 메시지/쿠폰 연동, 종료 후 복구 여부를 추적하는 운영 정책입니다.',
    legalReferences: ['이벤트 상세 IA', '서비스 운영 정책 초안'],
    bodyHtml:
      '<h2>이벤트 운영정책</h2><p>이벤트는 목록 검수와 등록 상세 페이지를 분리해 운영하고, 게시 예약과 종료 조치 후 감사 로그를 남깁니다.</p><ul><li>참여 대상 그룹과 중복 참여 제한 검수</li><li>보상 정책/메시지 템플릿/쿠폰 정책 참조</li><li>공개 이벤트의 노출/SEO 메타 관리</li></ul>',
    adminMemo: '이벤트 보상 수단과 종료 후 복구 가능 여부는 아직 후속 확정 대상입니다.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 10:12',
    updatedBy: 'admin_kim'
  },
  {
    id: 'POL-010',
    category: '운영/콘텐츠',
    policyType: 'FAQ 노출 정책',
    title: 'FAQ 노출 정책',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-25',
    exposureSurfaces: ['관리자 콘솔', '고객센터'],
    requiresConsent: false,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Operation > FAQ', 'Operation > 챗봇 설정', 'System > 감사 로그'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-faq-page-ia.md',
      'docs/specs/admin-data-usage-map.md'
    ],
    summary:
      'FAQ 원문 공개/비공개와 홈 추천, 결제 도움말, 온보딩 FAQ 같은 노출 큐레이션 규칙을 정의합니다.',
    legalReferences: ['FAQ 상세 IA'],
    bodyHtml:
      '<h2>FAQ 노출 정책</h2><p>FAQ는 원문 관리와 노출 관리, 지표 보기 3개 축으로 운영합니다.</p><ul><li>노출 위치: help_center, home_top, payment_help, onboarding</li><li>설정 방식: manual / auto</li><li>공개 상태 변경 시 연결된 노출 규칙 상태를 함께 검토</li></ul>',
    adminMemo: 'FAQ 노출 관리와 챗봇 지식 참조 기준을 동시에 추적합니다.',
    status: '게시',
    createdAt: '2026-03-25',
    updatedAt: '2026-03-26 10:18',
    updatedBy: 'admin_han'
  },
  {
    id: 'POL-011',
    category: '운영/콘텐츠',
    policyType: '챗봇 상담 전환 정책',
    title: '챗봇 상담 전환 정책',
    versionLabel: 'v2026.03-candidate',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['관리자 콘솔', '고객센터'],
    requiresConsent: false,
    trackingStatus: '정책 미확정',
    relatedAdminPages: ['Operation > 챗봇 설정', 'Operation > FAQ', 'Message > 메일'],
    sourceDocuments: [
      'docs/specs/page-ia/operation-chatbot-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '챗봇 fallback, 상담 인계, FAQ 지식 참조, 버전 비교 기준을 placeholder 단계에서 추적하는 정책 후보입니다.',
    legalReferences: ['챗봇 설정 상세 IA'],
    bodyHtml:
      '<h2>챗봇 상담 전환 정책</h2><p>챗봇 설정 화면은 아직 placeholder이며, 시나리오 버전 정책과 상담 전환 기준을 먼저 확정해야 합니다.</p><ul><li>fallback 규칙</li><li>상담 인계 조건</li><li>FAQ 참조와 후속 안내 연결</li></ul>',
    adminMemo: '현재는 문서 추적용 후보 정책이며 실페이지 구현 전 상세 규칙 확정이 필요합니다.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 10:22',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-012',
    category: '메시지/알림',
    policyType: '메일 발송 운영정책',
    title: '메일 발송 운영정책',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-25',
    exposureSurfaces: ['관리자 콘솔', '앱 설정'],
    requiresConsent: false,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Message > 메일', 'Message > 대상 그룹', 'Message > 발송 이력'],
    sourceDocuments: [
      'docs/specs/page-ia/message-mail-page-ia.md',
      'docs/specs/page-ia/message-history-page-ia.md'
    ],
    summary:
      '메일 템플릿 메타 등록, TinyMCE 본문 작성, 즉시/예약 발송, 수신 그룹 연동 규칙을 정리합니다.',
    legalReferences: ['메일 상세 IA', '정보통신망 이용촉진 및 정보보호 등에 관한 법률'],
    bodyHtml:
      '<h2>메일 발송 운영정책</h2><p>메일 템플릿은 목록에서 메타를 등록하고, 등록 상세 페이지에서 TinyMCE 본문을 최종 작성합니다.</p><ul><li>환경변수 토큰 삽입과 HTML 본문 검수</li><li>즉시/예약 발송 시 사유 입력과 감사 로그 추적</li><li>자동 발송 템플릿 활성/비활성 전환 규칙</li></ul>',
    adminMemo: '메일 템플릿과 발송 이력 후속 검수 정책을 함께 묶었습니다.',
    status: '게시',
    createdAt: '2026-03-25',
    updatedAt: '2026-03-26 10:28',
    updatedBy: 'admin_lee'
  },
  {
    id: 'POL-013',
    category: '메시지/알림',
    policyType: '푸시 발송 운영정책',
    title: '푸시 발송 운영정책',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-25',
    exposureSurfaces: ['관리자 콘솔', '앱 설정'],
    requiresConsent: false,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Message > 푸시', 'Message > 대상 그룹', 'Message > 발송 이력'],
    sourceDocuments: [
      'docs/specs/page-ia/message-push-page-ia.md',
      'docs/specs/page-ia/message-history-page-ia.md'
    ],
    summary:
      '푸시 템플릿 메타 등록, TinyMCE 본문 작성, 즉시/예약 발송과 상태 전환 기준을 정리합니다.',
    legalReferences: ['푸시 상세 IA', '정보통신망 이용촉진 및 정보보호 등에 관한 법률'],
    bodyHtml:
      '<h2>푸시 발송 운영정책</h2><p>푸시 템플릿은 메타 등록 후 본문 상세에서 HTML 기반 콘텐츠를 작성하고, 발송 그룹과 예약 시각을 함께 검수합니다.</p><ul><li>자동 발송 템플릿 활성/비활성 규칙</li><li>즉시/예약 발송의 사유 입력과 감사 로그 추적</li><li>발송 결과는 발송 이력에서 후속 검수</li></ul>',
    adminMemo: '푸시 템플릿 운영과 발송 이력 검수 규칙의 공통 기준입니다.',
    status: '게시',
    createdAt: '2026-03-25',
    updatedAt: '2026-03-26 10:31',
    updatedBy: 'admin_lee'
  },
  {
    id: 'POL-014',
    category: '메시지/알림',
    policyType: '발송 실패/재시도 정책',
    title: '발송 실패/재시도 정책',
    versionLabel: 'v2026.03-candidate',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['관리자 콘솔'],
    requiresConsent: false,
    trackingStatus: '정책 미확정',
    relatedAdminPages: ['Message > 발송 이력', 'Message > 메일', 'Message > 푸시'],
    sourceDocuments: [
      'docs/specs/page-ia/message-history-page-ia.md',
      'docs/specs/admin-page-gap-register.md'
    ],
    summary:
      '발송 실패 건 재시도 범위, 중복 발송 방지, CSV 내보내기 감사 여부를 추적하는 정책 후보입니다.',
    legalReferences: ['발송 이력 상세 IA'],
    bodyHtml:
      '<h2>발송 실패/재시도 정책</h2><p>발송 실패 이력은 재시도 범위와 중복 발송 방지 기준이 확정되어야 합니다.</p><ul><li>재시도 대상 판정 기준</li><li>재시도 횟수와 간격</li><li>CSV 내보내기 및 수신자 목록 보존 기간</li></ul>',
    adminMemo: '발송 이력 페이지 오픈 이슈를 정책 관리에서 추적하도록 추가한 후보 문서입니다.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 10:36',
    updatedBy: 'admin_kim'
  },
  {
    id: 'POL-015',
    category: '관리자/보안',
    policyType: '관리자 권한 변경 정책',
    title: '관리자 권한 변경 정책',
    versionLabel: 'v2026.03-draft',
    effectiveDate: '2026-03-26',
    exposureSurfaces: ['관리자 콘솔'],
    requiresConsent: false,
    trackingStatus: '문서 추적',
    relatedAdminPages: ['System > 권한 관리', 'System > 관리자 계정', 'System > 감사 로그'],
    sourceDocuments: [
      'docs/specs/page-ia/system-permissions-page-ia.md',
      'docs/specs/admin-page-gap-register.md',
      'src/features/system/pages/system-permissions-page.tsx'
    ],
    summary:
      '권한 부여, 수정, 회수의 사유 입력, 감사 추적, 승인 체계 미확정 항목을 함께 관리하는 내부 정책입니다.',
    legalReferences: ['권한 관리 상세 IA', '내부 보안 운영 지침 초안'],
    bodyHtml:
      '<h2>관리자 권한 변경 정책</h2><p>권한 변경은 대상 관리자, 변경 권한, 사유, 수행자를 함께 기록하고 감사 로그에서 역추적할 수 있어야 합니다.</p><ul><li>권한 회수는 확인 단계와 사유 입력 필수</li><li>고위험 권한의 2인 승인 여부는 후속 확정 필요</li><li>역할 템플릿과 개별 permission 편집 정책을 함께 검토</li></ul>',
    adminMemo: '현재 화면은 actor 하드코딩과 승인 체계 미확정이 남아 있어 문서 추적 상태로 관리합니다.',
    status: '숨김',
    createdAt: '2026-03-26',
    updatedAt: '2026-03-26 10:42',
    updatedBy: 'admin_park'
  },
  {
    id: 'POL-016',
    category: '메시지/알림',
    policyType: '마케팅 정보 수신 동의',
    title: '마케팅 정보 수신 동의',
    versionLabel: 'v2026.03',
    effectiveDate: '2026-03-20',
    exposureSurfaces: ['회원가입', '마이페이지', '앱 설정', '관리자 콘솔'],
    requiresConsent: true,
    trackingStatus: '코드 반영',
    relatedAdminPages: ['Message > 메일', 'Message > 푸시', 'Users > 회원 상세'],
    sourceDocuments: [
      'docs/specs/page-ia/message-mail-page-ia.md',
      'docs/specs/page-ia/message-push-page-ia.md',
      'docs/specs/admin-data-usage-map.md'
    ],
    summary:
      '프로모션 메일/푸시 발송을 위한 수신 동의 항목과 철회 방법을 정리한 사용자 동의 문서입니다.',
    legalReferences: ['정보통신망 이용촉진 및 정보보호 등에 관한 법률'],
    bodyHtml:
      '<h2>마케팅 정보 수신 동의</h2><p>회원은 메일, 앱 푸시, 문자 수신 동의를 선택적으로 설정할 수 있으며 언제든지 철회할 수 있습니다.</p><ul><li>회원가입/마이페이지/앱 설정 노출</li><li>메일/푸시 운영 정책과 함께 검수</li></ul>',
    adminMemo: '메일/푸시 템플릿 운영과 수신 거부 처리의 기준 동의 문서입니다.',
    status: '게시',
    createdAt: '2026-03-18',
    updatedAt: '2026-03-20 09:30',
    updatedBy: 'admin_park'
  }
] as SeedOperationPolicy[]).map(createSeedPolicy);

const initialPolicyHistories = initialPolicies.map((policy, index) =>
  createPolicyHistoryEntry(
    policy,
    'created',
    '초기 정책 스냅샷 등록',
    `PH-${String(index + 1).padStart(4, '0')}`
  )
);

export const useOperationPolicyStore = create<OperationPolicyStore>((set, get) => ({
  policies: initialPolicies,
  policyHistories: initialPolicyHistories,
  savePolicy: (payload) => {
    const now = formatNow();
    const target = payload.id
      ? get().policies.find((policy) => policy.id === payload.id) ?? null
      : null;

    const nextPolicy: OperationPolicy = target
      ? {
          ...target,
          category: payload.category,
          policyType: payload.policyType,
          title: normalizeText(payload.title),
          versionLabel: normalizeText(payload.versionLabel),
          effectiveDate: payload.effectiveDate,
          exposureSurfaces: [...payload.exposureSurfaces],
          requiresConsent: payload.requiresConsent,
          trackingStatus: payload.trackingStatus,
          relatedAdminPages: normalizeRelatedAdminPages(payload.relatedAdminPages),
          relatedUserPages: normalizeRelatedUserPages(payload.relatedUserPages),
          sourceDocuments: normalizeStringList(payload.sourceDocuments),
          summary: normalizeText(payload.summary),
          legalReferences: normalizeLegalReferences(payload.legalReferences),
          bodyHtml: payload.bodyHtml,
          adminMemo: normalizeText(payload.adminMemo),
          updatedAt: now,
          updatedBy: CURRENT_ACTOR
        }
      : {
          id: getNextPolicyId(get().policies),
          category: payload.category,
          policyType: payload.policyType,
          title: normalizeText(payload.title),
          versionLabel: normalizeText(payload.versionLabel),
          effectiveDate: payload.effectiveDate,
          exposureSurfaces: [...payload.exposureSurfaces],
          requiresConsent: payload.requiresConsent,
          trackingStatus: payload.trackingStatus,
          relatedAdminPages: normalizeRelatedAdminPages(payload.relatedAdminPages),
          relatedUserPages: normalizeRelatedUserPages(payload.relatedUserPages),
          sourceDocuments: normalizeStringList(payload.sourceDocuments),
          summary: normalizeText(payload.summary),
          legalReferences: normalizeLegalReferences(payload.legalReferences),
          bodyHtml: payload.bodyHtml,
          adminMemo: normalizeText(payload.adminMemo),
          status: '숨김',
          createdAt: toDateString(now),
          updatedAt: now,
          updatedBy: CURRENT_ACTOR
        };

    set((state) => ({
      policies: target
        ? state.policies.map((policy) =>
            policy.id === nextPolicy.id ? nextPolicy : policy
          )
        : [nextPolicy, ...state.policies],
      policyHistories: appendPolicyHistory(
        state.policyHistories,
        nextPolicy,
        target ? 'updated' : 'created',
        target ? '정책 메타/본문 수정' : '새 정책 등록',
        now,
        CURRENT_ACTOR
      )
    }));

    return nextPolicy;
  },
  togglePolicyStatus: ({ policyId, nextStatus }) => {
    const target = get().policies.find((policy) => policy.id === policyId);

    if (!target) {
      return null;
    }

    const nextPolicy: OperationPolicy = {
      ...target,
      status: nextStatus,
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      policies: state.policies.map((policy) =>
        policy.id === policyId ? nextPolicy : policy
      ),
      policyHistories: appendPolicyHistory(
        state.policyHistories,
        nextPolicy,
        'status_changed',
        `상태를 ${nextStatus}로 변경`,
        nextPolicy.updatedAt,
        CURRENT_ACTOR
      )
    }));

    return nextPolicy;
  },
  publishPolicyHistoryVersion: ({ policyId, historyId, reason }) => {
    const target = get().policies.find((policy) => policy.id === policyId);
    const historyEntry = get().policyHistories.find(
      (entry) => entry.id === historyId && entry.policyId === policyId
    );

    if (!target || !historyEntry) {
      return null;
    }

    const now = formatNow();
    const snapshot = historyEntry.snapshot;
    const nextPolicy: OperationPolicy = {
      ...target,
      category: snapshot.category,
      policyType: snapshot.policyType,
      title: snapshot.title,
      versionLabel: snapshot.versionLabel,
      effectiveDate: snapshot.effectiveDate,
      exposureSurfaces: [...snapshot.exposureSurfaces],
      requiresConsent: snapshot.requiresConsent,
      trackingStatus: snapshot.trackingStatus,
      relatedAdminPages: [...snapshot.relatedAdminPages],
      relatedUserPages: [...snapshot.relatedUserPages],
      sourceDocuments: [...snapshot.sourceDocuments],
      summary: snapshot.summary,
      legalReferences: [...snapshot.legalReferences],
      bodyHtml: snapshot.bodyHtml,
      adminMemo: snapshot.adminMemo,
      status: '게시',
      updatedAt: now,
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      policies: state.policies.map((policy) =>
        policy.id === policyId ? nextPolicy : policy
      ),
      policyHistories: appendPolicyHistory(
        state.policyHistories,
        nextPolicy,
        'version_published',
        `이력 버전 게시: ${historyEntry.versionLabel} / ${normalizeHistoryNote(reason)}`,
        now,
        CURRENT_ACTOR
      )
    }));

    return nextPolicy;
  },
  deletePolicy: ({ policyId, reason }) => {
    const target = get().policies.find((policy) => policy.id === policyId);

    if (!target) {
      return null;
    }

    const deletedAt = formatNow();
    const deletedPolicy: OperationPolicy = {
      ...target,
      updatedAt: deletedAt,
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      policies: state.policies.filter((policy) => policy.id !== policyId),
      policyHistories: appendPolicyHistory(
        state.policyHistories,
        deletedPolicy,
        'deleted',
        `정책 삭제: ${normalizeHistoryNote(reason)}`,
        deletedAt,
        CURRENT_ACTOR
      )
    }));

    return deletedPolicy;
  }
}));
