// 전화번호 표시제한(마스킹) 규칙 — DB private.mask_phone(SQL)의 TS 미러.
// 실데이터 경로는 SQL 이 마스킹해 내려주므로(목록 phone_masked), 이 함수는 mock
// 데이터 생성과 mock 내보내기 경로에서만 쓰인다. 규칙을 바꿀 때는 양쪽을 함께 바꾼다.
// 규칙: 숫자 9자리 이상 → 앞3-****-뒤4 (입력 포맷 무관 통일 표기),
//       1~8자리(비정상/짧은 값) → '***' (부분 노출도 하지 않음), 빈 값 → ''.
export function maskPhone(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    return '';
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 9) {
    return '***';
  }
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}
