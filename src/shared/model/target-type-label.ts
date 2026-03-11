const targetTypeLabelMap: Record<string, string> = {
  Users: 'Users',
  User: 'Users',
  Community: 'Community',
  Operation: 'Operation',
  Billing: 'Commerce',
  Commerce: 'Commerce',
  Notification: 'Message',
  Message: 'Message',
  Assessment: 'Assessment',
  Content: 'Content',
  System: 'System',
  Admin: '관리자'
};

export function getTargetTypeLabel(targetType: string): string {
  return targetTypeLabelMap[targetType] ?? targetType;
}
