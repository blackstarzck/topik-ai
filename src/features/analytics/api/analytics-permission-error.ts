// 서버가 raw Postgres 메시지를 던지므로 화면에 그대로 노출하지 않는다.
// 알려진 패턴이 아니면 원문을 유지한다 — 삼켜 버리면 예상 못한 실패를 진단할 수 없다.
// DB 쪽 문구 계약: 20260805130000_admin_analytics_read_permission.sql 의 raise 문구와
// 단위 테스트(analytics-permission-error-translation)가 lockstep 을 강제한다.
export function isAnalyticsPermissionError(message: string): boolean {
  return message.includes('missing permission analytics.read');
}

export function translateAnalyticsError(message: string): string {
  if (isAnalyticsPermissionError(message)) {
    return '통계 조회 권한이 없습니다(analytics.read).';
  }
  return message;
}
