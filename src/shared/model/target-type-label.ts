const targetTypeLabelMap: Record<string, string> = {
  Users: '사용자',
  User: '사용자',
  Community: '커뮤니티',
  Operation: '운영',
  Billing: '결제',
  Notification: '알림',
  System: '시스템',
  Admin: '관리자'
};

export function getTargetTypeLabel(targetType: string): string {
  return targetTypeLabelMap[targetType] ?? targetType;
}
