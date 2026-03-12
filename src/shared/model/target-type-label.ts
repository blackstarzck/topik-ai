const targetTypeLabelMap: Record<string, string> = {
  Users: '회원',
  User: '회원',
  Instructor: '강사',
  Community: '커뮤니티',
  Operation: '운영',
  Billing: '커머스',
  Commerce: '커머스',
  Notification: '메시지',
  Message: '메시지',
  Assessment: '평가',
  Content: '콘텐츠',
  System: '시스템',
  Admin: '관리자'
};

export function getTargetTypeLabel(targetType: string): string {
  return targetTypeLabelMap[targetType] ?? targetType;
}
