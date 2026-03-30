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

function createNotFoundError(message = '??곸쓣 李얠쓣 ???놁뒿?덈떎.'): AppApiError {
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
    '荑좏룿 湲곕뒫? Free 踰꾩쟾?먯꽌 ?앹꽦 媛?닔媛 1媛쒕줈 ?쒗븳?⑸땲?? Pro, Global 踰꾩쟾?먯꽌??臾댁젣?쒖쑝濡??앹꽦??媛?ν빀?덈떎.',
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
    throw createValidationError('荑좏룿紐낆쓣 ?낅젰??二쇱꽭??');
  }

  if (payload.benefitType !== 'freeShipping' && payload.benefitValue < 1) {
    throw createValidationError('1 ?댁긽 ?낅젰??二쇱꽭??');
  }

  if (
    payload.benefitType === 'rateDiscount' &&
    (payload.benefitValue < 1 || payload.benefitValue > 100)
  ) {
    throw createValidationError('鍮꾩쑉 ?좎씤? 1~100% ?ъ씠濡??낅젰??二쇱꽭??');
  }

  if (payload.minOrderAmount < 1) {
    throw createValidationError('1 ?댁긽 ?낅젰??二쇱꽭??');
  }

  if (
    payload.couponKind === 'manualIssue' &&
    payload.issueTargetType === 'specificMembers'
  ) {
    const hasInvalidUser = payload.targetUserIds.some(
      (userId) => !getMockUserById(userId)
    );

    if (hasInvalidUser) {
      throw createValidationError('議댁옱?섏? ?딅뒗 회원?낅땲?? ?ㅼ떆 ?뺤씤??二쇱꽭??');
    }
  }

  if (
    payload.couponKind === 'couponCode' &&
    payload.codeGenerationMode === 'bulk' &&
    (!payload.codeCount || payload.codeCount < 1 || payload.codeCount > 10000)
  ) {
    throw createValidationError('1~10,000 ?ъ씠濡??낅젰??二쇱꽭??');
  }

  if (payload.validityMode === 'fixedDate' && (!payload.validFrom || !payload.validUntil)) {
    throw createValidationError('?ъ슜 湲고븳???뺤씤??二쇱꽭??');
  }

  if (payload.validityMode === 'afterIssued' && (!payload.expireAfterDays || payload.expireAfterDays < 1)) {
    throw createValidationError('諛쒓툒 ??留뚮즺 ?쇱닔??1 ?댁긽?댁뼱???⑸땲??');
  }

  if (payload.issueLimitMode === 'limited' && (!payload.issueLimit || payload.issueLimit < 1)) {
    throw createValidationError('諛쒗뻾 ?섎웾???뺤씤??二쇱꽭??');
  }

  if (
    payload.downloadLimitMode === 'limited' &&
    (!payload.downloadLimit || payload.downloadLimit < 1)
  ) {
    throw createValidationError('?ㅼ슫濡쒕뱶 ?섎웾???뺤씤??二쇱꽭??');
  }

  if (payload.usageLimitMode === 'limited' && (!payload.usageLimit || payload.usageLimit < 1)) {
    throw createValidationError('?ъ슜 ?잛닔瑜??뺤씤??二쇱꽭??');
  }
}

function validateCouponTemplateSchedule(
  value: { dayOfMonth: number; hour: number; minute: number },
  label: string
): void {
  if (value.dayOfMonth < 1 || value.dayOfMonth > 31) {
    throw createValidationError(`${label} ?쇱옄??1~31 ?ъ씠?ъ빞 ?⑸땲??`);
  }

  if (value.hour < 0 || value.hour > 23) {
    throw createValidationError(`${label} ?쒓컙? 0~23 ?ъ씠?ъ빞 ?⑸땲??`);
  }

  if (value.minute < 0 || value.minute > 59) {
    throw createValidationError(`${label} 遺꾩? 0~59 ?ъ씠?ъ빞 ?⑸땲??`);
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
    throw createValidationError('?뺢린 荑좏룿紐낆쓣 ?낅젰??二쇱꽭??');
  }

  if (payload.targetGradeIds.length === 0) {
    throw createValidationError('諛쒗뻾 ??곸쓣 1媛??댁긽 ?좏깮??二쇱꽭??');
  }

  validateReferenceIds(
    payload.targetGradeIds,
    couponTemplateShoppingGradeOptions,
    '?좏슚?섏? ?딆? ?쇳븨 등급???ы븿?섏뼱 ?덉뒿?덈떎.'
  );

  if (payload.benefitType !== 'freeShipping' && payload.benefitValue < 1) {
    throw createValidationError('?좎씤 媛믪? 1 ?댁긽?댁뼱???⑸땲??');
  }

  if (
    payload.benefitType === 'rateDiscount' &&
    (payload.benefitValue < 1 || payload.benefitValue > 100)
  ) {
    throw createValidationError('鍮꾩쑉 ?좎씤? 1~100% ?ъ씠濡??낅젰??二쇱꽭??');
  }

  if (payload.minOrderAmount < 1) {
    throw createValidationError('理쒖냼 二쇰Ц 湲덉븸? 1 ?댁긽?댁뼱???⑸땲??');
  }

  if (payload.applicableScope === 'specificCategory') {
    if (payload.applicableScopeReferenceIds.length === 0) {
      throw createValidationError('?곸슜 移댄뀒怨좊━瑜?1媛??댁긽 ?좏깮??二쇱꽭??');
    }

    validateReferenceIds(
      payload.applicableScopeReferenceIds,
      couponTemplateCategoryOptions,
      '?좏슚?섏? ?딆? 移댄뀒怨좊━媛 ?ы븿?섏뼱 ?덉뒿?덈떎.'
    );
  }

  if (payload.applicableScope === 'specificProduct') {
    if (payload.applicableScopeReferenceIds.length === 0) {
      throw createValidationError('?곸슜 상품??1媛??댁긽 ?좏깮??二쇱꽭??');
    }

    validateReferenceIds(
      payload.applicableScopeReferenceIds,
      couponTemplateProductOptions,
      '?좏슚?섏? ?딆? 상품???ы븿?섏뼱 ?덉뒿?덈떎.'
    );
  }

  if (payload.excludedProductMode === 'specific') {
    if (payload.excludedProductIds.length === 0) {
      throw createValidationError('?쒖쇅 상품??1媛??댁긽 ?좏깮??二쇱꽭??');
    }

    validateReferenceIds(
      payload.excludedProductIds,
      couponTemplateProductOptions,
      '?좏슚?섏? ?딆? ?쒖쇅 상품???ы븿?섏뼱 ?덉뒿?덈떎.'
    );
  }

  validateCouponTemplateSchedule(payload.issueSchedule, '?뺢린 諛쒗뻾 ?쒖젏');
  validateCouponTemplateSchedule(payload.usageEndSchedule, '荑좏룿 ?ъ슜 醫낅즺??);
}

async function loadCoupons(signal?: AbortSignal) {
  await sleep(220, signal);
  return useCouponStore.getState().coupons;
}

async function loadCoupon(couponId: string, signal?: AbortSignal) {
  await sleep(220, signal);
  const coupon = useCouponStore.getState().coupons.find((item) => item.id === couponId);

  if (!coupon) {
    throw createNotFoundError('荑좏룿 ??곸쓣 李얠쓣 ???놁뒿?덈떎.');
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
    isCreate ? '荑좏룿 ?앹꽦' : '荑좏룿 ?섏젙',
    isCreate ? '荑좏룿 ?깅줉 상세?먯꽌 ?앹꽦' : '荑좏룿 ?깅줉 상세?먯꽌 ?섏젙'
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
    throw createNotFoundError('蹂듭젣??荑좏룿??李얠쓣 ???놁뒿?덈떎.');
  }

  appendCouponAudit(
    'CommerceCoupon',
    duplicatedCoupon.id,
    '荑좏룿 蹂듭젣',
    payload.reason?.trim() || `${payload.couponId} 湲곗??쇰줈 蹂듭젣`
  );

  return duplicatedCoupon;
}

async function pauseCoupon(payload: CouponActionPayload, signal?: AbortSignal) {
  await sleep(220, signal);
  const targetCoupon = useCouponStore.getState().coupons.find((coupon) => coupon.id === payload.couponId);

  if (!targetCoupon) {
    throw createNotFoundError('荑좏룿 ??곸쓣 李얠쓣 ???놁뒿?덈떎.');
  }

  if (targetCoupon.couponKind !== 'autoIssue') {
    throw createValidationError('?먮룞 諛쒗뻾 荑좏룿留??쇱떆?곸쑝濡?諛쒗뻾??以묒??????덉뒿?덈떎.');
  }

  const updatedCoupon = useCouponStore.getState().pauseCoupon({ couponId: payload.couponId });

  if (!updatedCoupon) {
    throw createValidationError('?먮룞 諛쒗뻾 荑좏룿留??쇱떆?곸쑝濡?諛쒗뻾??以묒??????덉뒿?덈떎.');
  }

  appendCouponAudit(
    'CommerceCoupon',
    updatedCoupon.id,
    '荑좏룿 諛쒗뻾 以묒?',
    payload.reason?.trim() || '운영 寃?좊줈 諛쒗뻾??以묒??덉뒿?덈떎.'
  );

  return updatedCoupon;
}

async function resumeCoupon(payload: CouponActionPayload, signal?: AbortSignal) {
  await sleep(220, signal);
  const targetCoupon = useCouponStore.getState().coupons.find((coupon) => coupon.id === payload.couponId);

  if (!targetCoupon) {
    throw createNotFoundError('荑좏룿 ??곸쓣 李얠쓣 ???놁뒿?덈떎.');
  }

  if (targetCoupon.couponKind !== 'autoIssue') {
    throw createValidationError('?먮룞 諛쒗뻾 荑좏룿留?諛쒗뻾???ш컻?????덉뒿?덈떎.');
  }

  const updatedCoupon = useCouponStore.getState().resumeCoupon({ couponId: payload.couponId });

  if (!updatedCoupon) {
    throw createValidationError('?먮룞 諛쒗뻾 荑좏룿留?諛쒗뻾???ш컻?????덉뒿?덈떎.');
  }

  appendCouponAudit(
    'CommerceCoupon',
    updatedCoupon.id,
    '荑좏룿 諛쒗뻾 ?ш컻',
    payload.reason?.trim() || '운영 寃?좊줈 諛쒗뻾???ш컻?덉뒿?덈떎.'
  );

  return updatedCoupon;
}

async function removeCoupon(payload: CouponActionPayload, signal?: AbortSignal) {
  await sleep(220, signal);
  const deletedCoupon = useCouponStore.getState().deleteCoupon({ couponId: payload.couponId });

  if (!deletedCoupon) {
    throw createNotFoundError('??젣??荑좏룿??李얠쓣 ???놁뒿?덈떎.');
  }

  appendCouponAudit(
    'CommerceCoupon',
    deletedCoupon.id,
    '荑좏룿 ??젣',
    payload.reason?.trim() || '운영 ?먮떒?쇰줈 荑좏룿????젣?덉뒿?덈떎.'
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
    throw createNotFoundError('?뺢린 荑좏룿 ?쒗뵆由우쓣 李얠쓣 ???놁뒿?덈떎.');
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
    isCreate ? '?뺢린 荑좏룿 ?쒗뵆由??앹꽦' : '?뺢린 荑좏룿 ?쒗뵆由??섏젙',
    isCreate
      ? '?뺢린 荑좏룿 ?쒗뵆由??깅줉 상세?먯꽌 ?앹꽦'
      : '?뺢린 荑좏룿 ?쒗뵆由??깅줉 상세?먯꽌 ?섏젙'
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
    throw createNotFoundError('?뺢린 荑좏룿 ?쒗뵆由우쓣 李얠쓣 ???놁뒿?덈떎.');
  }

  appendCouponAudit(
    'CommerceCouponTemplate',
    updatedTemplate.id,
    '?뺢린 荑좏룿 ?쒗뵆由?諛쒗뻾 以묒?',
    payload.reason?.trim() || '운영 寃?좊줈 ?뺢린 諛쒗뻾??以묒??덉뒿?덈떎.'
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
    throw createNotFoundError('?뺢린 荑좏룿 ?쒗뵆由우쓣 李얠쓣 ???놁뒿?덈떎.');
  }

  appendCouponAudit(
    'CommerceCouponTemplate',
    updatedTemplate.id,
    '?뺢린 荑좏룿 ?쒗뵆由?諛쒗뻾 ?ш컻',
    payload.reason?.trim() || '운영 寃?좊줈 ?뺢린 諛쒗뻾???ш컻?덉뒿?덈떎.'
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
    throw createNotFoundError('??젣???뺢린 荑좏룿 ?쒗뵆由우쓣 李얠쓣 ???놁뒿?덈떎.');
  }

  appendCouponAudit(
    'CommerceCouponTemplate',
    deletedTemplate.id,
    '?뺢린 荑좏룿 ?쒗뵆由???젣',
    payload.reason?.trim() || '운영 ?먮떒?쇰줈 ?뺢린 荑좏룿 ?쒗뵆由우쓣 ??젣?덉뒿?덈떎.'
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






