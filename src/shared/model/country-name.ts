// ISO 3166-1 alpha-2 국가 코드 -> 한글 표시 라벨 "국가명 (코드)".
// 플랫폼 Intl.DisplayNames 테이블을 사용하므로 하드코딩 목록이 없고, 런타임이 코드를
// 해석하지 못하면 코드 원본으로 폴백한다. 빈/형식 불일치 값은 ''(빈 문자열) 반환.
let regionDisplay: Intl.DisplayNames | null | undefined;

function getRegionDisplay(): Intl.DisplayNames | null {
  if (regionDisplay !== undefined) {
    return regionDisplay;
  }
  try {
    regionDisplay = new Intl.DisplayNames(['ko'], { type: 'region' });
  } catch {
    regionDisplay = null;
  }
  return regionDisplay;
}

export function formatNationality(code: string | null | undefined): string {
  const normalized = (code ?? '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    return '';
  }
  const name = getRegionDisplay()?.of(normalized);
  return name && name !== normalized ? `${name} (${normalized})` : normalized;
}
