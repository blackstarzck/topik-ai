const targetTypeLabelMap: Record<string, string> = {
  Users: 'Users',
  User: 'Users',
  Community: '커뮤니티',
  Operation: '운영',
  Billing: '결제',
  Notification: '메시지',
  Message: '메시지',
  System: '시스템',
  Admin: '관리자'
};

export function getTargetTypeLabel(targetType: string): string {
  return targetTypeLabelMap[targetType] ?? targetType;
}
