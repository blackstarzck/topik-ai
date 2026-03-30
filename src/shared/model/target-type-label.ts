const targetTypeLabelMap: Record<string, string> = {
  Users: "회원",
  User: "회원",
  Instructor: "강사",
  Referral: "추천인",
  Community: "커뮤니티",
  Operation: "운영",
  OperationPolicy: "정책",
  OperationFaq: "FAQ",
  OperationFaqCuration: "FAQ 노출",
  Billing: "커머스",
  Commerce: "커머스",
  CommercePointPolicy: "포인트 정책",
  CommercePointLedger: "포인트 원장",
  CommercePointExpiration: "포인트 소멸",
  CommerceCouponTemplate: "정기 쿠폰 템플릿",
  Notification: "메시지",
  Message: "메시지",
  Assessment: "평가",
  AssessmentQuestion: "TOPIK 쓰기 문항",
  Content: "콘텐츠",
  System: "시스템",
  Admin: "관리자",
  SystemMetadataGroup: "메타 그룹",
};

export function getTargetTypeLabel(targetType: string): string {
  return targetTypeLabelMap[targetType] ?? targetType;
}
