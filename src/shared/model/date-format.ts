/**
 * ISO 타임스탬프 표시 포맷 공용 유틸.
 *
 * 서비스 계층에 복제되어 있던 toDate(8곳)/toDateString(3곳)/toDateTime(14곳)을
 * 정밀도별 단일 정의로 통합한다. 빈 입력의 반환값 '' 는 기존 다수 구현과 동일하다.
 * (undefined 를 돌려주던 2곳은 동작 보존을 위해 로컬 정의를 유지한다.)
 */

/** 'YYYY-MM-DD' (날짜만). */
export function toDateOnly(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

/** 'YYYY-MM-DD HH:mm' (분 정밀도). */
export function toDateTimeMinutes(value: string | null | undefined): string {
  return value ? value.slice(0, 16).replace('T', ' ') : '';
}

/** 'YYYY-MM-DD HH:mm:ss' (초 정밀도). */
export function toDateTimeSeconds(value: string | null | undefined): string {
  return value ? value.slice(0, 19).replace('T', ' ') : '';
}

/** 현재 시각 'YYYY-MM-DD HH:mm' — mock/store 계열의 생성·조치 시각 표기(복제 7곳 통합). */
export function formatNowMinutes(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

/** 현재 시각 'YYYY-MM-DD HH:mm:ss' (복제 3곳 통합). */
export function formatNowSeconds(date = new Date()): string {
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${formatNowMinutes(date)}:${ss}`;
}
