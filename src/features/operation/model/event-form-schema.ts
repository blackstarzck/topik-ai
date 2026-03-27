import type { OperationEventRewardType } from './types';

export type OperationEventRewardPolicyOption = {
  id: string;
  name: string;
  rewardType: Exclude<OperationEventRewardType, '없음'>;
  description: string;
};

export const operationEventRewardPolicyOptions: OperationEventRewardPolicyOption[] = [
  {
    id: 'POINT-100',
    name: '출석 7일 누적 100P',
    rewardType: '포인트',
    description: '연속 출석 7일 달성 시 100포인트를 적립합니다.'
  },
  {
    id: 'POINT-500',
    name: '챌린지 완주 500P',
    rewardType: '포인트',
    description: '시즌 챌린지 완주 시 500포인트를 지급합니다.'
  },
  {
    id: 'COUPON-APR-15',
    name: '친구 초대 15% 쿠폰',
    rewardType: '쿠폰',
    description: '초대 성공 시 15% 할인 쿠폰을 자동 발급합니다.'
  },
  {
    id: 'COUPON-WELCOME-10',
    name: '신규 가입 10% 쿠폰',
    rewardType: '쿠폰',
    description: '이벤트 참여 후 신규 가입자에게 10% 할인 쿠폰을 발급합니다.'
  },
  {
    id: 'BADGE-TOPIK-001',
    name: 'TOPIK 챌린지 완주 배지',
    rewardType: '배지',
    description: 'TOPIK 시즌 챌린지를 완주한 회원에게 배지를 지급합니다.'
  },
  {
    id: 'BADGE-ATTEND-001',
    name: '연속 출석 달성 배지',
    rewardType: '배지',
    description: '연속 출석 기준을 달성한 회원에게 기념 배지를 지급합니다.'
  }
];

export function getOperationEventRewardPolicyOptionsByType(
  rewardType: OperationEventRewardType
): OperationEventRewardPolicyOption[] {
  if (rewardType === '없음') {
    return [];
  }

  return operationEventRewardPolicyOptions.filter((option) => option.rewardType === rewardType);
}

export function findOperationEventRewardPolicyById(
  rewardPolicyId: string
): OperationEventRewardPolicyOption | undefined {
  return operationEventRewardPolicyOptions.find((option) => option.id === rewardPolicyId);
}
