import type { OperationEventRewardType } from './types';

export type OperationEventRewardPolicyOption = {
  id: string;
  name: string;
  rewardType: Exclude<OperationEventRewardType, '?놁쓬'>;
  description: string;
};

export const operationEventRewardPolicyOptions: OperationEventRewardPolicyOption[] = [
  {
    id: 'POINT-100',
    name: '異쒖꽍 7???꾩쟻 100P',
    rewardType: '?ъ씤??,
    description: '?곗냽 異쒖꽍 7???ъ꽦 ??100?ъ씤?몃? ?곷┰?⑸땲??'
  },
  {
    id: 'POINT-500',
    name: '梨뚮┛吏 ?꾩＜ 500P',
    rewardType: '?ъ씤??,
    description: '?쒖쫵 梨뚮┛吏 ?꾩＜ ??500?ъ씤?몃? 吏湲됲빀?덈떎.'
  },
  {
    id: 'COUPON-APR-15',
    name: '移쒓뎄 珥덈? 15% 荑좏룿',
    rewardType: '荑좏룿',
    description: '珥덈? 성공 수15% ?좎씤 荑좏룿???먮룞 諛쒓툒?⑸땲??'
  },
  {
    id: 'COUPON-WELCOME-10',
    name: '?좉퇋 媛??10% 荑좏룿',
    rewardType: '荑좏룿',
    description: '?대깽??李몄뿬 ???좉퇋 媛?낆옄?먭쾶 10% ?좎씤 荑좏룿??諛쒓툒?⑸땲??'
  },
  {
    id: 'BADGE-TOPIK-001',
    name: 'TOPIK 梨뚮┛吏 ?꾩＜ 諛곗?',
    rewardType: '諛곗?',
    description: 'TOPIK ?쒖쫵 梨뚮┛吏瑜??꾩＜??회원?먭쾶 諛곗?瑜?吏湲됲빀?덈떎.'
  },
  {
    id: 'BADGE-ATTEND-001',
    name: '?곗냽 異쒖꽍 ?ъ꽦 諛곗?',
    rewardType: '諛곗?',
    description: '?곗냽 異쒖꽍 湲곗????ъ꽦??회원?먭쾶 湲곕뀗 諛곗?瑜?吏湲됲빀?덈떎.'
  }
];

export function getOperationEventRewardPolicyOptionsByType(
  rewardType: OperationEventRewardType
): OperationEventRewardPolicyOption[] {
  if (rewardType === '?놁쓬') {
    return [];
  }

  return operationEventRewardPolicyOptions.filter((option) => option.rewardType === rewardType);
}

export function findOperationEventRewardPolicyById(
  rewardPolicyId: string
): OperationEventRewardPolicyOption | undefined {
  return operationEventRewardPolicyOptions.find((option) => option.id === rewardPolicyId);
}


