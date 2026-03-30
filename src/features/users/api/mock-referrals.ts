import type {
  ReferralAnomalyStatus,
  ReferralPolicySnapshot,
  ReferralRelation,
  ReferralRewardLedgerEntry,
  ReferralStatus,
  ReferralSummary
} from '../model/referrals-types';

const familyNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'] as const;
const givenNames = [
  '민준',
  '서연',
  '지후',
  '하은',
  '도윤',
  '예린',
  '시우',
  '유진',
  '현우',
  '지원'
] as const;

const anomalyFlagsPool = [
  '동일 기기 반복',
  '자기추천 의심',
  '환불 가능성',
  '단기 대량 가입'
] as const;

const policySnapshot: ReferralPolicySnapshot = {
  version: '정책 초안 v0',
  confirmationTiming: '미확정',
  rewardMethod: '미확정',
  manualAdjustmentAuthority: '미확정',
  rollbackRule: '미확정',
  note:
    '추천 확정 시점, 보상 수단, 수동 보정 권한, 회수 규칙은 아직 확정되지 않았으며 운영 화면에서 가정값으로만 표시됩니다.'
};

function formatDateTime(daysAgo: number, hourOffset: number): string {
  const date = new Date(Date.UTC(2026, 2, 13, 9, 0, 0));
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(9 + hourOffset, (daysAgo * 9) % 60, 0, 0);
  return date.toISOString().slice(0, 16).replace('T', ' ');
}

function formatDate(daysOffset: number): string {
  const date = new Date(Date.UTC(2026, 2, 13, 0, 0, 0));
  date.setUTCDate(date.getUTCDate() + daysOffset);
  return date.toISOString().slice(0, 10);
}

function buildReferrer(index: number): {
  userId: string;
  name: string;
  email: string;
} {
  const userNumber = 11 + index;
  const name = `${familyNames[index % familyNames.length]}${givenNames[(index * 3) % givenNames.length]}`;

  return {
    userId: `U${String(userNumber).padStart(5, '0')}`,
    name,
    email: `member${userNumber}@topik.ai`
  };
}

function buildReferredUserName(index: number, offset: number): string {
  const familyName = familyNames[(index + offset + 2) % familyNames.length];
  const givenName =
    givenNames[(index * 2 + offset * 3 + 1) % givenNames.length];

  return `${familyName}${givenName}`;
}

function resolveReferralStatus(index: number): ReferralStatus {
  return index % 5 === 0 ? '비활성' : '활성';
}

function resolveAnomalyStatus(index: number): ReferralAnomalyStatus {
  if (index % 6 === 0) {
    return '검토 필요';
  }
  if (index % 10 === 0) {
    return '검토 완료';
  }
  return '없음';
}

function buildRelations(
  index: number,
  anomalyStatus: ReferralAnomalyStatus
): ReferralRelation[] {
  const relationCount = 2 + (index % 5);
  const flaggedIndex = anomalyStatus === '없음' ? -1 : index % relationCount;

  return Array.from({ length: relationCount }, (_, offset) => {
    const userNumber = 200 + index * 5 + offset;
    const status =
      offset === relationCount - 1 && index % 4 === 0
        ? '대기'
        : offset === relationCount - 2 && index % 7 === 0
          ? '취소'
          : '완료';
    const anomalyFlag =
      offset === flaggedIndex
        ? anomalyFlagsPool[(index + offset) % anomalyFlagsPool.length]
        : '';

    return {
      id: `REL-${String(index + 1).padStart(4, '0')}-${offset + 1}`,
      referredUserId: `U${String(userNumber).padStart(5, '0')}`,
      referredUserName: buildReferredUserName(index, offset),
      joinedAt: formatDateTime(30 - (index % 10) + offset, offset + 1),
      confirmedAt:
        status === '완료'
          ? formatDateTime(27 - (index % 8) + offset, offset + 2)
          : '',
      status,
      anomalyFlag,
      reviewNote:
        anomalyFlag.length > 0
          ? anomalyStatus === '검토 완료'
            ? '운영 검토 완료'
            : '운영 검토 필요'
          : ''
    };
  });
}

function buildRewardLedger(
  index: number,
  relations: ReferralRelation[],
  anomalyStatus: ReferralAnomalyStatus
): ReferralRewardLedgerEntry[] {
  const baseAmount = 4000 + (index % 3) * 1000;
  const entries = relations.map((relation, offset) => {
    if (relation.status === '완료') {
      return {
        id: `RWD-${String(index + 1).padStart(4, '0')}-${offset + 1}`,
        relationId: relation.id,
        entryType: '지급' as const,
        rewardMethodLabel: '정책 미확정',
        amount: baseAmount,
        status: index % 5 === 0 && offset === 0 ? '대기' : '완료',
        actedAt: formatDateTime(24 - (index % 6) + offset, offset + 2),
        reason: '추천 확정 기준 가정값 반영'
      };
    }

    return {
      id: `RWD-${String(index + 1).padStart(4, '0')}-${offset + 1}`,
      relationId: relation.id,
      entryType: '취소' as const,
      rewardMethodLabel: '정책 미확정',
      amount: -baseAmount,
      status: '완료',
      actedAt: formatDateTime(18 - (index % 5) + offset, offset + 3),
      reason: '추천 확정 취소 가정값 반영'
    };
  });

  if (anomalyStatus === '검토 완료') {
    entries.unshift({
      id: `ADJ-${String(index + 1).padStart(4, '0')}`,
      relationId: '',
      entryType: '수동 보정',
      rewardMethodLabel: '정책 미확정',
      amount: 1000,
      status: '완료',
      actedAt: formatDateTime(8 + (index % 5), 4),
      reason: '운영 검토 후 수동 보정'
    });
  }

  if (index % 9 === 0) {
    entries.push({
      id: `RCV-${String(index + 1).padStart(4, '0')}`,
      relationId: '',
      entryType: '회수',
      rewardMethodLabel: '정책 미확정',
      amount: -2000,
      status: '완료',
      actedAt: formatDateTime(5 + (index % 4), 5),
      reason: '회수 규칙 미확정 상태의 운영 테스트 보정'
    });
  }

  return entries;
}

function calculateTotalRewardAmount(entries: ReferralRewardLedgerEntry[]): number {
  return entries
    .filter((entry) => entry.status === '완료')
    .reduce((total, entry) => total + entry.amount, 0);
}

function resolveAdminMemo(anomalyStatus: ReferralAnomalyStatus): string {
  if (anomalyStatus === '검토 필요') {
    return '추천 확정 및 보상 지급 기준이 미확정이므로 이상치 검토 우선 대상입니다.';
  }
  if (anomalyStatus === '검토 완료') {
    return '운영 검토를 마쳤으며 후속 정책 확정 시 보상 원장 재점검이 필요합니다.';
  }
  return '운영 모니터링 상태입니다. 정책 확정 전까지는 가정값 기준으로만 관리합니다.';
}

export const mockReferrals: ReferralSummary[] = Array.from(
  { length: 48 },
  (_, index) => {
    const referrer = buildReferrer(index);
    const status = resolveReferralStatus(index);
    const anomalyStatus = resolveAnomalyStatus(index);
    const relations = buildRelations(index, anomalyStatus);
    const rewardLedger = buildRewardLedger(index, relations, anomalyStatus);
    const lastUsedAt = relations
      .map((relation) => relation.confirmedAt || relation.joinedAt)
      .sort((left, right) => right.localeCompare(left))[0];

    return {
      id: `REF-${String(index + 1).padStart(4, '0')}`,
      code: `TOPIK-${String(3200 + index).padStart(4, '0')}`,
      referrerUserId: referrer.userId,
      referrerName: referrer.name,
      referrerEmail: referrer.email,
      createdAt: formatDateTime(90 - (index % 28), 1),
      expiresAt: formatDate(30 + (index % 45)),
      lastUsedAt,
      lastActionAt: formatDateTime(4 + (index % 12), 3),
      status,
      anomalyStatus,
      anomalyFlags: Array.from(
        new Set(
          relations.map((relation) => relation.anomalyFlag).filter(Boolean)
        )
      ),
      referredCount: relations.length,
      confirmedCount: relations.filter((relation) => relation.status === '완료')
        .length,
      totalRewardAmount: calculateTotalRewardAmount(rewardLedger),
      adminMemo: resolveAdminMemo(anomalyStatus),
      relations,
      rewardLedger,
      policySnapshot
    };
  }
);

export function getMockReferralById(
  referralId: string
): ReferralSummary | undefined {
  return mockReferrals.find((item) => item.id === referralId);
}
