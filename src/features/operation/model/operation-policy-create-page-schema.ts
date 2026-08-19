import type { Dayjs } from 'dayjs';

import type {
  OperationPolicy,
  OperationPolicyCategory,
  OperationPolicyTrackingStatus,
  OperationPolicyType
} from './policy-types';
import {
  inferOperationPolicyRelatedAdminPages,
  inferOperationPolicyRelatedUserPages,
  operationPolicyCategoryValues,
  operationPolicyTrackingStatusValues,
  operationPolicyTypeValues
} from './policy-types';

// 정책 등록/수정/새 버전 화면의 순수 스키마 — Phase 4 분해로 페이지 본문에서 이동(동작 동일).
// 폼 상태·제출 로직은 페이지가 소유하고, 여기는 타입·프리셋·스텝 정의·파서·검증만 둔다.

export type PolicyFormValues = {
  category: OperationPolicyCategory;
  policyType: OperationPolicyType;
  title: string;
  versionLabel: string;
  effectiveDate: Dayjs | null;
  exposureSurfaces: OperationPolicy['exposureSurfaces'];
  requiresConsent: boolean;
  trackingStatus: OperationPolicyTrackingStatus;
  relatedAdminPages: OperationPolicy['relatedAdminPages'];
  relatedUserPages: OperationPolicy['relatedUserPages'];
  sourceDocumentsText: string;
  summary: string;
  legalReferencesText: string;
  bodyHtml: string;
  adminMemo: string;
};

export type PolicyCreateSectionKey =
  | 'basic'
  | 'exposure'
  | 'tracking'
  | 'legal'
  | 'body'
  | 'memo';

export type PolicyEditorMode = 'create' | 'edit' | 'version';

export type PolicyTypePreset = {
  description: string;
  category: OperationPolicyCategory;
  trackingStatus: OperationPolicyTrackingStatus;
  relatedAdminPages: OperationPolicy['relatedAdminPages'];
  relatedUserPages: OperationPolicy['relatedUserPages'];
};

export const policyTypePresetMap: Record<OperationPolicyType, PolicyTypePreset> = {
  이용약관: {
    description: '서비스 이용 조건과 계정 운영 기준을 고정하는 기본 약관입니다.',
    category: '법률/약관',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('이용약관'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('이용약관')
  },
  '개인정보 처리방침': {
    description: '수집 항목, 처리 목적, 보관 기간, 파기 절차를 고지하는 법적 문서입니다.',
    category: '법률/약관',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('개인정보 처리방침'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('개인정보 처리방침')
  },
  '결제ㆍ환불 정책': {
    description: '결제 승인, 환불 가능 조건, 부분 환불 제한을 함께 다루는 정책입니다.',
    category: '결제/리워드',
    trackingStatus: '문서 추적',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('결제ㆍ환불 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('결제ㆍ환불 정책')
  },
  '청소년 보호정책': {
    description: '청소년 유해 정보 차단, 신고 처리, 보호 책임자 안내 기준을 담습니다.',
    category: '커뮤니티/안전',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('청소년 보호정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('청소년 보호정책')
  },
  '커뮤니티 게시글 제재 정책': {
    description: '게시글 숨김/삭제 시 쓰는 정책 코드와 내부 메모 기준을 관리합니다.',
    category: '커뮤니티/안전',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('커뮤니티 게시글 제재 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('커뮤니티 게시글 제재 정책')
  },
  '추천인 보상 정책': {
    description: '추천 확정 시점, 보상 수단, 회수 규칙, 수동 보정 권한을 추적합니다.',
    category: '결제/리워드',
    trackingStatus: '문서 추적',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('추천인 보상 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('추천인 보상 정책')
  },
  '포인트 운영정책': {
    description: '적립 원천, 차감 우선순위, 소멸/보류 규칙을 추적하는 운영 정책입니다.',
    category: '결제/리워드',
    trackingStatus: '문서 추적',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('포인트 운영정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('포인트 운영정책')
  },
  '쿠폰 운영정책': {
    description: '쿠폰 유형별 운영 규칙과 자동 발행/삭제/노출 기준을 묶는 정책입니다.',
    category: '결제/리워드',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('쿠폰 운영정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('쿠폰 운영정책')
  },
  '이벤트 운영정책': {
    description: '이벤트 노출, 참여 조건, 보상 연결, 종료 처리 기준을 관리합니다.',
    category: '운영/콘텐츠',
    trackingStatus: '문서 추적',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('이벤트 운영정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('이벤트 운영정책')
  },
  'FAQ 노출 정책': {
    description: 'FAQ 공개 상태와 홈/결제/온보딩 노출 큐레이션 기준을 정리합니다.',
    category: '운영/콘텐츠',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('FAQ 노출 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('FAQ 노출 정책')
  },
  '챗봇 상담 전환 정책': {
    description: '챗봇 fallback, 상담 인계, FAQ 참조 규칙을 placeholder 단계에서 추적합니다.',
    category: '운영/콘텐츠',
    trackingStatus: '정책 미확정',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('챗봇 상담 전환 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('챗봇 상담 전환 정책')
  },
  '메일 발송 운영정책': {
    description: '메일 템플릿 등록, 본문 작성, 즉시/예약 발송의 운영 기준을 관리합니다.',
    category: '메시지/알림',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('메일 발송 운영정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('메일 발송 운영정책')
  },
  '푸시 발송 운영정책': {
    description: '푸시 템플릿 등록, 본문 작성, 즉시/예약 발송의 운영 기준을 관리합니다.',
    category: '메시지/알림',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('푸시 발송 운영정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('푸시 발송 운영정책')
  },
  '발송 실패/재시도 정책': {
    description: '실패 건 재시도 범위, 중복 발송 방지, 보존 기간을 추적합니다.',
    category: '메시지/알림',
    trackingStatus: '정책 미확정',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('발송 실패/재시도 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('발송 실패/재시도 정책')
  },
  '관리자 권한 변경 정책': {
    description: '권한 부여/수정/회수 시 승인과 감사 추적 기준을 다루는 내부 정책입니다.',
    category: '관리자/보안',
    trackingStatus: '문서 추적',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('관리자 권한 변경 정책'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('관리자 권한 변경 정책')
  },
  '마케팅 정보 수신 동의': {
    description: '메일/푸시 수신 동의와 철회 기준을 고지하는 사용자 동의 문서입니다.',
    category: '메시지/알림',
    trackingStatus: '코드 반영',
    relatedAdminPages: inferOperationPolicyRelatedAdminPages('마케팅 정보 수신 동의'),
    relatedUserPages: inferOperationPolicyRelatedUserPages('마케팅 정보 수신 동의')
  }
};

export const policyCreateStepItems: Array<{
  key: PolicyCreateSectionKey;
  title: string;
  description: string;
}> = [
  { key: 'basic', title: '기본 정보', description: '운영 영역, 정책 유형, 문서명' },
  { key: 'exposure', title: '노출 및 동의', description: '시행일, 노출 위치, 동의 여부' },
  { key: 'tracking', title: '추적 근거', description: '정책 추적 상태, 연관 화면, 근거 문서' },
  { key: 'legal', title: '법령 및 요약', description: '정책 요약, 법령/근거' },
  { key: 'body', title: '정책 본문', description: 'TinyMCE 본문 작성' },
  { key: 'memo', title: '관리자 메모', description: '운영 검수 메모' }
];

export const policyCreateStepFieldMap: Record<
  PolicyCreateSectionKey,
  Array<keyof PolicyFormValues>
> = {
  basic: ['category', 'policyType', 'title', 'versionLabel'],
  exposure: ['effectiveDate', 'exposureSurfaces', 'requiresConsent'],
  tracking: [
    'trackingStatus',
    'relatedAdminPages',
    'relatedUserPages',
    'sourceDocumentsText'
  ],
  legal: ['summary', 'legalReferencesText'],
  body: ['bodyHtml'],
  memo: ['adminMemo']
};

export function parsePolicyTypeQueryValue(
  value: string | null
): OperationPolicyType | undefined {
  if (!value) {
    return undefined;
  }

  return operationPolicyTypeValues.includes(value as OperationPolicyType)
    ? (value as OperationPolicyType)
    : undefined;
}

export function parsePolicyCategoryQueryValue(
  value: string | null
): OperationPolicyCategory | undefined {
  if (!value) {
    return undefined;
  }

  return operationPolicyCategoryValues.includes(value as OperationPolicyCategory)
    ? (value as OperationPolicyCategory)
    : undefined;
}

export function parseTrackingStatusQueryValue(
  value: string | null
): OperationPolicyTrackingStatus | undefined {
  if (!value) {
    return undefined;
  }

  return operationPolicyTrackingStatusValues.includes(
    value as OperationPolicyTrackingStatus
  )
    ? (value as OperationPolicyTrackingStatus)
    : undefined;
}

export function parsePolicyEditorMode(value: string | null): PolicyEditorMode {
  if (value === 'version') {
    return 'version';
  }

  return 'create';
}

export function findStepIndexByFieldName(
  fieldName: string | number | undefined
): number {
  if (typeof fieldName !== 'string') {
    return 0;
  }

  const matchedStepIndex = policyCreateStepItems.findIndex((item) =>
    policyCreateStepFieldMap[item.key].includes(fieldName as keyof PolicyFormValues)
  );

  return matchedStepIndex >= 0 ? matchedStepIndex : 0;
}

export function isRichTextEmpty(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  const plainText = value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();

  return plainText.length === 0;
}

export function normalizeLineList(text: string | undefined): string[] {
  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function normalizeOptionalText(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function getFirstHiddenValidationError(values: Partial<PolicyFormValues>): {
  field: keyof PolicyFormValues;
} | null {
  if (!values.category) {
    return { field: 'category' };
  }

  if (!values.policyType) {
    return { field: 'policyType' };
  }

  if (!values.title?.trim()) {
    return { field: 'title' };
  }

  if (!values.versionLabel?.trim()) {
    return { field: 'versionLabel' };
  }

  if (!values.effectiveDate) {
    return { field: 'effectiveDate' };
  }

  if (!values.exposureSurfaces?.length) {
    return { field: 'exposureSurfaces' };
  }

  if (!values.trackingStatus) {
    return { field: 'trackingStatus' };
  }

  if (!values.summary?.trim()) {
    return { field: 'summary' };
  }

  if (isRichTextEmpty(values.bodyHtml)) {
    return { field: 'bodyHtml' };
  }

  return null;
}
