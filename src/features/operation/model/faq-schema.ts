export const faqStatusValues = ['공개', '비공개'] as const;
export type OperationFaqStatus = (typeof faqStatusValues)[number];

export const faqCategoryValues = [
  '계정',
  '결제',
  '커뮤니티',
  '메시지'
] as const;
export type OperationFaqCategory = (typeof faqCategoryValues)[number];

export const faqExposureSurfaceValues = [
  'help_center',
  'home_top',
  'payment_help',
  'onboarding'
] as const;
export type OperationFaqExposureSurface =
  (typeof faqExposureSurfaceValues)[number];

export const faqCurationModeValues = ['manual', 'auto'] as const;
export type OperationFaqCurationMode = (typeof faqCurationModeValues)[number];

export const faqCurationStatusValues = ['active', 'paused'] as const;
export type OperationFaqCurationStatus =
  (typeof faqCurationStatusValues)[number];

const faqStatusLabelMap: Record<OperationFaqStatus, string> = {
  공개: '공개',
  비공개: '비공개'
};

const faqCategoryLabelMap: Record<OperationFaqCategory, string> = {
  계정: '계정',
  결제: '결제',
  커뮤니티: '커뮤니티',
  메시지: '메시지'
};

const faqExposureSurfaceLabelMap: Record<OperationFaqExposureSurface, string> = {
  help_center: '고객센터 FAQ',
  home_top: '홈 추천 FAQ',
  payment_help: '결제 도움말',
  onboarding: '온보딩 FAQ'
};

const faqCurationModeLabelMap: Record<OperationFaqCurationMode, string> = {
  manual: '수동 고정',
  auto: '자동 추천'
};

const faqCurationStatusLabelMap: Record<OperationFaqCurationStatus, string> = {
  active: '노출 중',
  paused: '대기'
};

export const faqStatusOptions = faqStatusValues.map((value) => ({
  value,
  label: faqStatusLabelMap[value]
}));

export const faqCategoryOptions = faqCategoryValues.map((value) => ({
  value,
  label: faqCategoryLabelMap[value]
}));

export const faqExposureSurfaceOptions = faqExposureSurfaceValues.map((value) => ({
  value,
  label: faqExposureSurfaceLabelMap[value]
}));

export const faqCurationModeOptions = faqCurationModeValues.map((value) => ({
  value,
  label: faqCurationModeLabelMap[value]
}));

export const faqCurationStatusOptions = faqCurationStatusValues.map((value) => ({
  value,
  label: faqCurationStatusLabelMap[value]
}));

export function getFaqStatusLabel(status: OperationFaqStatus): string {
  return faqStatusLabelMap[status];
}

export function getFaqCategoryLabel(category: OperationFaqCategory): string {
  return faqCategoryLabelMap[category];
}

export function getFaqExposureSurfaceLabel(
  surface: OperationFaqExposureSurface
): string {
  return faqExposureSurfaceLabelMap[surface];
}

export function getFaqCurationModeLabel(
  mode: OperationFaqCurationMode
): string {
  return faqCurationModeLabelMap[mode];
}

export function getFaqCurationStatusLabel(
  status: OperationFaqCurationStatus
): string {
  return faqCurationStatusLabelMap[status];
}
