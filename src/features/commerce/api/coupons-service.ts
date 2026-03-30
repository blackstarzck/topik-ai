import { AppApiError } from '../../../shared/api/api-error';
import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import { getMockUserById } from '../../users/api/mock-users';
import {
  couponTemplateCategoryOptions,
  couponTemplateProductOptions,
  couponTemplateShoppingGradeOptions
} from '../model/coupon-template-form-schema';
import type {
  CouponAuditEvent
} from '../model/coupon-template-types';
import {
  useCouponStore,
  type CouponSavePayload,
  type CouponTemplateSavePayload
} from '../model/coupon-store';

type CouponActionPayload = {
  couponId: string;
  reason?: string;
};

type CouponTemplateActionPayload = {
  templateId: string;
  reason?: string;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = (): void => {
      cleanup();
      reject(new DOMException('Request aborted', 'AbortError'));
    };

    const cleanup = (): void => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function createNotFoundError(message = '대상을 찾을 수 없습니다.'): AppApiError {
  return new AppApiError(message, {
    code: 'NOT_FOUND',
    status: 404,
    retryable: false
  });
}

function createValidationError(message: string): AppApiError {
  return new AppApiError(message, {
    code: 'VALIDATION_ERROR',
    status: 400,
    retryable: false
  });
}

function createFreePlanLimitError(): AppApiError {
  return new AppApiError(
    '쿠폰 기능은 Free 버전에서 생성 갯수가 1개로 제한됩니다. Pro, Global 버전에서는 무제한으로 생성이 가능합니다.',
    {
      code: 'CONFLICT',
      status: 409,
      retryable: false
    }
  );
}

function formatNow(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function createCouponAuditId(audits: CouponAuditEvent[]): string {
  const nextSequence =
    audits
      .map((audit) => Number(audit.id.replace('AL-CPN-', '')))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `AL-CPN-${String(nextSequence).padStart(4, '0')}`;
}

function appendCouponAudit(
  targetType: CouponAuditEvent['targetType'],
  targetId: string,
  action: string,
  reason: string
): void {
  const state = useCouponStore.getState();
  state.appendAudit({
    id: createCouponAuditId(state.audits),
    targetType,
    targetId,
    action,
    reason,
    changedBy: 'admin_current',
    createdAt: formatNow()
  });
}

function validateCouponPayload(payload: CouponSavePayload): void {
  if (!payload.couponName.trim()) {
    throw createValidationError('쿠폰명을 입력해 주세요.');
  }

  if (payload.benefitType !== 'freeShipping' && payload.benefitValue < 1) {
    throw createValidationError('1 이상 입력해 주세요.');
  }

  if (
    payload.benefitType === 'rateDiscount' &&
    (payload.benefitValue < 1 || payload.benefitValue > 100)
  ) {
    throw createValidationError('비율 할인은 1~100% 사이로 입력해 주세요.');
  }

  if (payload.minOrderAmount < 1) {
    throw createValidationError('1 이상 입력해 주세요.');
  }

  if (
    payload.couponKind === 'manualIssue' &&
    payload.issueTargetType === 'specificMembers'
  ) {
    const hasInvalidUser = payload.targetUserIds.some(
      (userId) => !getMockUserById(userId)
    );

    if (hasInvalidUser) {
      throw createValidationError('존재하지 않는 회원입니다. 다시 확인해 주세요.');
    }
  }

  if (
    payload.couponKind === 'couponCode' &&
    payload.codeGenerationMode === 'bulk' &&
    (!payload.codeCount || payload.codeCount < 1 || payload.codeCount > 10000)
  ) {
    throw createValidationError('1~10,000 사이로 입력해 주세요.');
  }

  if (payload.validityMode === 'fixedDate' && (!payload.validFrom || !payload.validUntil)) {
    throw createValidationError('사용 기한을 확인해 주세요.');
  }

  if (payload.validityMode === 'afterIssued' && (!payload.expireAfterDays || payload.expireAfterDays < 1)) {
    throw createValidationError('발급 후 만료 일수는 1 이상이어야 합니다.');
  }

  if (payload.issueLimitMode === 'limited' && (!payload.issueLimit || payload.issueLimit < 1)) {
    throw createValidationError('발행 수량을 확인해 주세요.');
  }

  if (
    payload.downloadLimitMode === 'limited' &&
    (!payload.downloadLimit || payload.downloadLimit < 1)
  ) {
    throw createValidationError('다운로드 수량을 확인해 주세요.');
  }

  if (payload.usageLimitMode === 'limited' && (!payload.usageLimit || payload.usageLimit < 1)) {
    throw createValidationError('사용 횟수를 확인해 주세요.');
  }
}

function validateCouponTemplateSchedule(
  value: { dayOfMonth: number; hour: number; minute: number },
  label: string
): void {
  if (value.dayOfMonth < 1 || value.dayOfMonth > 31) {
    throw createValidationError(`${label} 일자는 1~31 사이여야 합니다.`);
  }

  if (value.hour < 0 || value.hour > 23) {
    throw createValidationError(`${label} 시간은 0~23 사이여야 합니다.`);
  }

  if (value.minute < 0 || value.minute > 59) {
    throw createValidationError(`${label} 분은 0~59 사이여야 합니다.`);
  }
}

function validateReferenceIds(
  ids: string[],
  options: Array<{ id: string }>,
  message: string
): void {
  const optionIds = new Set(options.map((option) => option.id));
  const hasInvalidId = ids.some((id) => !optionIds.has(id));

  if (hasInvalidId) {
    throw createValidationError(message);
  }
}

function validateCouponTemplatePayload(payload: CouponTemplateSavePayload): void {
  if (!payload.templateName.trim()) {
    throw createValidationError('정기 쿠폰명을 입력해 주세요.');
  }

  if (payload.targetGradeIds.length === 0) {
    throw createValidationError('발행 대상을 1개 이상 선택해 주세요.');
  }

  validateReferenceIds(
    payload.targetGradeIds,
    couponTemplateShoppingGradeOptions,
    '유효하지 않은 쇼핑 등급이 포함되어 있습니다.'
  );

  if (payload.benefitType !== 'freeShipping' && payload.benefitValue < 1) {
    throw createValidationError('할인 값은 1 이상이어야 합니다.');
  }

  if (
    payload.benefitType === 'rateDiscount' &&
    (payload.benefitValue < 1 || payload.benefitValue > 100)
  ) {
    throw createValidationError('비율 할인은 1~100% 사이로 입력해 주세요.');
  }

  if (payload.minOrderAmount < 1) {
    throw createValidationError('최소 주문 금액은 1 이상이어야 합니다.');
  }

  if (payload.applicableScope === 'specificCategory') {
    if (payload.applicableScopeReferenceIds.length === 0) {
      throw createValidationError('적용 카테고리를 1개 이상 선택해 주세요.');
    }

    validateReferenceIds(
      payload.applicableScopeReferenceIds,
      couponTemplateCategoryOptions,
      '유효하지 않은 카테고리가 포함되어 있습니다.'
    );
  }

  if (payload.applicableScope === 'specificProduct') {
    if (payload.applicableScopeReferenceIds.length === 0) {
      throw createValidationError('적용 상품을 1개 이상 선택해 주세요.');
    }

    validateReferenceIds(
      payload.applicableScopeReferenceIds,
      couponTemplateProductOptions,
      '유효하지 않은 상품이 포함되어 있습니다.'
    );
  }

  if (payload.excludedProductMode === 'specific') {
    if (payload.excludedProductIds.length === 0) {
      throw createValidationError('제외 상품을 1개 이상 선택해 주세요.');
    }

    validateReferenceIds(
      payload.excludedProductIds,
      couponTemplateProductOptions,
      '유효하지 않은 제외 상품이 포함되어 있습니다.'
    );
  }

  validateCouponTemplateSchedule(payload.issueSchedule, '정기 발행 시점');
  validateCouponTemplateSchedule(payload.usageEndSchedule, '쿠폰 사용 종료일');
}

async function loadCoupons(signal?: AbortSignal) {
  await sleep(220, signal);
  return useCouponStore.getState().coupons;
}

async function loadCoupon(couponId: string, signal?: AbortSignal) {
  await sleep(220, signal);
  const coupon = useCouponStore.getState().coupons.find((item) => item.id === couponId);

  if (!coupon) {
    throw createNotFoundError('쿠폰 대상을 찾을 수 없습니다.');
  }

  return coupon;
}

async function persistCoupon(payload: CouponSavePayload, signal?: AbortSignal) {
  await sleep(260, signal);
  validateCouponPayload(payload);

  const { coupons, planTier, saveCoupon } = useCouponStore.getState();
  const isCreate = !payload.id;

  if (planTier === 'free' && isCreate && coupons.length >= 1) {
    throw createFreePlanLimitError();
  }

  const savedCoupon = saveCoupon(payload);

  appendCouponAudit(
    'CommerceCoupon',
    savedCoupon.id,
    isCreate ? '쿠폰 생성' : '쿠폰 수정',
    isCreate ? '쿠폰 등록 상세에서 생성' : '쿠폰 등록 상세에서 수정'
  );

  return savedCoupon;
}

async function duplicateCoupon(payload: CouponActionPayload, signal?: AbortSignal) {
  await sleep(220, signal);
  const { coupons, planTier, duplicateCoupon: duplicateInStore } = useCouponStore.getState();

  if (planTier === 'free' && coupons.length >= 1) {
    throw createFreePlanLimitError();
  }

  const duplicatedCoupon = duplicateInStore({ couponId: payload.couponId });

  if (!duplicatedCoupon) {
    throw createNotFoundError('복제할 쿠폰을 찾을 수 없습니다.');
  }

  appendCouponAudit(
    'CommerceCoupon',
    duplicatedCoupon.id,
    '쿠폰 복제',
    payload.reason?.trim() || `${payload.couponId} 기준으로 복제`
  );

  return duplicatedCoupon;
}

async function pauseCoupon(payload: CouponActionPayload, signal?: AbortSignal) {
  await sleep(220, signal);
  const targetCoupon = useCouponStore.getState().coupons.find((coupon) => coupon.id === payload.couponId);

  if (!targetCoupon) {
    throw createNotFoundError('쿠폰 대상을 찾을 수 없습니다.');
  }

  if (targetCoupon.couponKind !== 'autoIssue') {
    throw createValidationError('자동 발행 쿠폰만 일시적으로 발행을 중지할 수 있습니다.');
  }

  const updatedCoupon = useCouponStore.getState().pauseCoupon({ couponId: payload.couponId });

  if (!updatedCoupon) {
    throw createValidationError('자동 발행 쿠폰만 일시적으로 발행을 중지할 수 있습니다.');
  }

  appendCouponAudit(
    'CommerceCoupon',
    updatedCoupon.id,
    '쿠폰 발행 중지',
    payload.reason?.trim() || '운영 검토로 발행을 중지했습니다.'
  );

  return updatedCoupon;
}

async function resumeCoupon(payload: CouponActionPayload, signal?: AbortSignal) {
  await sleep(220, signal);
  const targetCoupon = useCouponStore.getState().coupons.find((coupon) => coupon.id === payload.couponId);

  if (!targetCoupon) {
    throw createNotFoundError('쿠폰 대상을 찾을 수 없습니다.');
  }

  if (targetCoupon.couponKind !== 'autoIssue') {
    throw createValidationError('자동 발행 쿠폰만 발행을 재개할 수 있습니다.');
  }

  const updatedCoupon = useCouponStore.getState().resumeCoupon({ couponId: payload.couponId });

  if (!updatedCoupon) {
    throw createValidationError('자동 발행 쿠폰만 발행을 재개할 수 있습니다.');
  }

  appendCouponAudit(
    'CommerceCoupon',
    updatedCoupon.id,
    '쿠폰 발행 재개',
    payload.reason?.trim() || '운영 검토로 발행을 재개했습니다.'
  );

  return updatedCoupon;
}

async function removeCoupon(payload: CouponActionPayload, signal?: AbortSignal) {
  await sleep(220, signal);
  const deletedCoupon = useCouponStore.getState().deleteCoupon({ couponId: payload.couponId });

  if (!deletedCoupon) {
    throw createNotFoundError('삭제할 쿠폰을 찾을 수 없습니다.');
  }

  appendCouponAudit(
    'CommerceCoupon',
    deletedCoupon.id,
    '쿠폰 삭제',
    payload.reason?.trim() || '운영 판단으로 쿠폰을 삭제했습니다.'
  );

  return deletedCoupon;
}

async function loadCouponTemplates(signal?: AbortSignal) {
  await sleep(220, signal);
  return useCouponStore.getState().subscriptionTemplates;
}

async function loadCouponTemplate(templateId: string, signal?: AbortSignal) {
  await sleep(220, signal);
  const template = useCouponStore
    .getState()
    .subscriptionTemplates.find((item) => item.id === templateId);

  if (!template) {
    throw createNotFoundError('정기 쿠폰 템플릿을 찾을 수 없습니다.');
  }

  return template;
}

async function persistCouponTemplate(
  payload: CouponTemplateSavePayload,
  signal?: AbortSignal
) {
  await sleep(260, signal);
  validateCouponTemplatePayload(payload);

  const { planTier, subscriptionTemplates, saveCouponTemplate } = useCouponStore.getState();
  const isCreate = !payload.id;

  if (planTier === 'free' && isCreate && subscriptionTemplates.length >= 1) {
    throw createFreePlanLimitError();
  }

  const savedTemplate = saveCouponTemplate(payload);

  appendCouponAudit(
    'CommerceCouponTemplate',
    savedTemplate.id,
    isCreate ? '정기 쿠폰 템플릿 생성' : '정기 쿠폰 템플릿 수정',
    isCreate
      ? '정기 쿠폰 템플릿 등록 상세에서 생성'
      : '정기 쿠폰 템플릿 등록 상세에서 수정'
  );

  return savedTemplate;
}

async function pauseCouponTemplate(
  payload: CouponTemplateActionPayload,
  signal?: AbortSignal
) {
  await sleep(220, signal);
  const updatedTemplate = useCouponStore.getState().pauseCouponTemplate({
    templateId: payload.templateId
  });

  if (!updatedTemplate) {
    throw createNotFoundError('정기 쿠폰 템플릿을 찾을 수 없습니다.');
  }

  appendCouponAudit(
    'CommerceCouponTemplate',
    updatedTemplate.id,
    '정기 쿠폰 템플릿 발행 중지',
    payload.reason?.trim() || '운영 검토로 정기 발행을 중지했습니다.'
  );

  return updatedTemplate;
}

async function resumeCouponTemplate(
  payload: CouponTemplateActionPayload,
  signal?: AbortSignal
) {
  await sleep(220, signal);
  const updatedTemplate = useCouponStore.getState().resumeCouponTemplate({
    templateId: payload.templateId
  });

  if (!updatedTemplate) {
    throw createNotFoundError('정기 쿠폰 템플릿을 찾을 수 없습니다.');
  }

  appendCouponAudit(
    'CommerceCouponTemplate',
    updatedTemplate.id,
    '정기 쿠폰 템플릿 발행 재개',
    payload.reason?.trim() || '운영 검토로 정기 발행을 재개했습니다.'
  );

  return updatedTemplate;
}

async function removeCouponTemplate(
  payload: CouponTemplateActionPayload,
  signal?: AbortSignal
) {
  await sleep(220, signal);
  const deletedTemplate = useCouponStore.getState().deleteCouponTemplate({
    templateId: payload.templateId
  });

  if (!deletedTemplate) {
    throw createNotFoundError('삭제할 정기 쿠폰 템플릿을 찾을 수 없습니다.');
  }

  appendCouponAudit(
    'CommerceCouponTemplate',
    deletedTemplate.id,
    '정기 쿠폰 템플릿 삭제',
    payload.reason?.trim() || '운영 판단으로 정기 쿠폰 템플릿을 삭제했습니다.'
  );

  return deletedTemplate;
}

export function fetchCouponsSafe(signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadCoupons(signal), { maxRetries: 1 }));
}

export function fetchCouponSafe(couponId: string, signal?: AbortSignal) {
  return toSafeResult(() => withRetry(() => loadCoupon(couponId, signal), { maxRetries: 1 }));
}

export function saveCouponSafe(payload: CouponSavePayload, signal?: AbortSignal) {
  return toSafeResult(() => persistCoupon(payload, signal));
}

export function duplicateCouponSafe(payload: CouponActionPayload, signal?: AbortSignal) {
  return toSafeResult(() => duplicateCoupon(payload, signal));
}

export function pauseCouponSafe(payload: CouponActionPayload, signal?: AbortSignal) {
  return toSafeResult(() => pauseCoupon(payload, signal));
}

export function resumeCouponSafe(payload: CouponActionPayload, signal?: AbortSignal) {
  return toSafeResult(() => resumeCoupon(payload, signal));
}

export function deleteCouponSafe(payload: CouponActionPayload, signal?: AbortSignal) {
  return toSafeResult(() => removeCoupon(payload, signal));
}

export function fetchCouponTemplatesSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadCouponTemplates(signal), { maxRetries: 1 })
  );
}

export function fetchCouponTemplateSafe(templateId: string, signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadCouponTemplate(templateId, signal), { maxRetries: 1 })
  );
}

export function saveCouponTemplateSafe(
  payload: CouponTemplateSavePayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => persistCouponTemplate(payload, signal));
}

export function pauseCouponTemplateSafe(
  payload: CouponTemplateActionPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => pauseCouponTemplate(payload, signal));
}

export function resumeCouponTemplateSafe(
  payload: CouponTemplateActionPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => resumeCouponTemplate(payload, signal));
}

export function deleteCouponTemplateSafe(
  payload: CouponTemplateActionPayload,
  signal?: AbortSignal
) {
  return toSafeResult(() => removeCouponTemplate(payload, signal));
}




