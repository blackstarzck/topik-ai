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
