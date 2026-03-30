export const faqStatusValues = ['怨듦컻', '鍮꾧났媛?] as const;
export type OperationFaqStatus = (typeof faqStatusValues)[number];

export const faqCategoryValues = [
  '怨꾩젙',
  '결제',
  '커뮤니티',
  '硫붿떆吏'
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
  怨듦컻: '怨듦컻',
  鍮꾧났媛? '鍮꾧났媛?
};

const faqCategoryLabelMap: Record<OperationFaqCategory, string> = {
  怨꾩젙: '怨꾩젙',
  결제: '결제',
  커뮤니티: '커뮤니티',
  硫붿떆吏: '硫붿떆吏'
};

const faqExposureSurfaceLabelMap: Record<OperationFaqExposureSurface, string> = {
  help_center: '怨좉컼?쇳꽣 FAQ',
  home_top: '??異붿쿇 FAQ',
  payment_help: '결제 ?꾩?留?,
  onboarding: '?⑤낫??FAQ'
};

const faqCurationModeLabelMap: Record<OperationFaqCurationMode, string> = {
  manual: '?섎룞 怨좎젙',
  auto: '?먮룞 異붿쿇'
};

const faqCurationStatusLabelMap: Record<OperationFaqCurationStatus, string> = {
  active: '?몄텧 以?,
  paused: '대기
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

