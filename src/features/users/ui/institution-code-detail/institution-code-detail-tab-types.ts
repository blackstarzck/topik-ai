import type { notification } from 'antd';

/** 기관 코드 상세 탭이 셸에서 받는 notification 인스턴스(회원 상세 탭 선례와 동일 형태). */
export type NotificationApi = ReturnType<typeof notification.useNotification>[0];
