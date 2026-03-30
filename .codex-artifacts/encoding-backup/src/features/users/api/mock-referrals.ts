import type {
  ReferralAnomalyStatus,
  ReferralPolicySnapshot,
  ReferralRelation,
  ReferralRewardLedgerEntry,
  ReferralStatus,
  ReferralSummary
} from '../model/referrals-types';

const familyNames = ['源', '??, '諛?, '理?, '??, '媛?, '議?, '??, '??, '??] as const;
const givenNames = [
  '誘쇱?',
  '?쒖뿰',
  '吏??,
  '?섏?',
  '?꾩쑄',
  '?덈┛',
  '?쒖슦',
  '?좎쭊',
  '?꾩슦',
  '吏??
] as const;

const anomalyFlagsPool = [
  '?숈씪 湲곌린 諛섎났',
  '?먭린異붿쿇 ?섏떖',
  '환불 媛?μ꽦',
  '?④린 대상媛??
] as const;

const policySnapshot: ReferralPolicySnapshot = {
  version: '?뺤콉 珥덉븞 v0',
  confirmationTiming: '誘명솗??,
  rewardMethod: '誘명솗??,
  manualAdjustmentAuthority: '誘명솗??,
  rollbackRule: '誘명솗??,
  note:
    '異붿쿇 ?뺤젙 ?쒖젏, 蹂댁긽 ?섎떒, ?섎룞 蹂댁젙 沅뚰븳, ?뚯닔 洹쒖튃? ?꾩쭅 ?뺤젙?섏? ?딆븯?쇰ŉ 운영 ?붾㈃?먯꽌 媛?뺢컪?쇰줈留??쒖떆?⑸땲??'
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
  return index % 5 === 0 ? '비활성 : '활성';
}

function resolveAnomalyStatus(index: number): ReferralAnomalyStatus {
  if (index % 6 === 0) {
    return '寃???꾩슂';
  }
  if (index % 10 === 0) {
    return '寃??완료';
  }
  return '?놁쓬';
}

function buildRelations(
  index: number,
  anomalyStatus: ReferralAnomalyStatus
): ReferralRelation[] {
  const relationCount = 2 + (index % 5);
  const flaggedIndex = anomalyStatus === '?놁쓬' ? -1 : index % relationCount;

  return Array.from({ length: relationCount }, (_, offset) => {
    const userNumber = 200 + index * 5 + offset;
    const status =
      offset === relationCount - 1 && index % 4 === 0
        ? '대기
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
          ? anomalyStatus === '寃??완료'
            ? '운영 寃??완료'
            : '운영 寃???꾩슂'
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
        entryType: '吏湲? as const,
        rewardMethodLabel: '?뺤콉 誘명솗??,
        amount: baseAmount,
        status: index % 5 === 0 && offset === 0 ? '대기 : '완료',
        actedAt: formatDateTime(24 - (index % 6) + offset, offset + 2),
        reason: '異붿쿇 ?뺤젙 湲곗? 媛?뺢컪 諛섏쁺'
      };
    }

    return {
      id: `RWD-${String(index + 1).padStart(4, '0')}-${offset + 1}`,
      relationId: relation.id,
      entryType: '취소' as const,
      rewardMethodLabel: '?뺤콉 誘명솗??,
      amount: -baseAmount,
      status: '완료',
      actedAt: formatDateTime(18 - (index % 5) + offset, offset + 3),
      reason: '異붿쿇 ?뺤젙 취소 媛?뺢컪 諛섏쁺'
    };
  });

  if (anomalyStatus === '寃??완료') {
    entries.unshift({
      id: `ADJ-${String(index + 1).padStart(4, '0')}`,
      relationId: '',
      entryType: '?섎룞 蹂댁젙',
      rewardMethodLabel: '?뺤콉 誘명솗??,
      amount: 1000,
      status: '완료',
      actedAt: formatDateTime(8 + (index % 5), 4),
      reason: '운영 寃?????섎룞 蹂댁젙'
    });
  }

  if (index % 9 === 0) {
    entries.push({
      id: `RCV-${String(index + 1).padStart(4, '0')}`,
      relationId: '',
      entryType: '?뚯닔',
      rewardMethodLabel: '?뺤콉 誘명솗??,
      amount: -2000,
      status: '완료',
      actedAt: formatDateTime(5 + (index % 4), 5),
      reason: '?뚯닔 洹쒖튃 誘명솗??상태??운영 ?뚯뒪??蹂댁젙'
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
  if (anomalyStatus === '寃???꾩슂') {
    return '異붿쿇 ?뺤젙 諛?蹂댁긽 吏湲?湲곗???誘명솗?뺤씠誘濡??댁긽移?寃???곗꽑 ??곸엯?덈떎.';
  }
  if (anomalyStatus === '寃??완료') {
    return '운영 寃?좊? 留덉낀?쇰ŉ ?꾩냽 ?뺤콉 ?뺤젙 ??蹂댁긽 ?먯옣 ?ъ젏寃???꾩슂?⑸땲??';
  }
  return '운영 紐⑤땲?곕쭅 상태?낅땲?? ?뺤콉 ?뺤젙 ?꾧퉴吏??媛?뺢컪 湲곗??쇰줈留?愿由ы빀?덈떎.';
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


