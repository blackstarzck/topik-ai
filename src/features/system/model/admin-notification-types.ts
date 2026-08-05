/**
 * 관리자 인앱 알림 화면 모델. `admin_list_my_notifications` RPC 와 1:1 이다.
 *
 * 학습자 알림함(`user_notifications`)과 **다른 원장**이다. 그쪽은 v13 공유 객체라
 * 관리 도메인 알림을 넣으면 학습자 앱 알림함에 관리 문구가 노출된다 — 수신자 FK 가
 * `admin_accounts` 인 `admin_notifications` 를 따로 둔 이유다(`20260805110000`).
 */
export type AdminNotificationCategory = 'institution_contract';

export type AdminNotification = {
  id: string;
  category: string;
  title: string;
  body: string;
  /** 관리자 화면 내부 경로. 비어 있으면 이동 대상이 없다. */
  linkUrl: string;
  /** 읽은 시각(ISO). 빈 문자열 = 미읽음. */
  readAt: string;
  createdAt: string;
};

/** 카테고리 한글 라벨. 미등록 카테고리는 원문을 그대로 보여준다(삼켜서 감추지 않는다). */
export const ADMIN_NOTIFICATION_CATEGORY_LABEL: Record<string, string> = {
  institution_contract: '기관 계약'
};

export function resolveAdminNotificationCategoryLabel(category: string): string {
  return ADMIN_NOTIFICATION_CATEGORY_LABEL[category] ?? category;
}
