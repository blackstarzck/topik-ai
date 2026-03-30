import { toSafeResult, withRetry } from '../../../shared/api/safe-request';
import type {
  CommercePointsSnapshot,
  PointExpiration,
  PointExpirationStatus,
  PointLedger,
  PointLedgerType,
  PointPolicy,
  PointPolicyStatus,
  PointPolicyType
} from '../model/point-types';

type SavePointPolicyPayload = {
  policyId?: string;
  name: string;
  policyType: PointPolicyType;
  conditionSummary: string;
  earnDebitRule: string;
  expirationRule: string;
  targetCondition: string;
  triggerSource: string;
  duplicationRule: string;
  manualAdjustmentRule: string;
  note: string;
  actedBy?: string;
};

type UpdatePointPolicyStatusPayload = {
  policyId: string;
  nextStatus: Exclude<PointPolicyStatus, '珥덉븞'>;
  reason: string;
  actedBy?: string;
};

type CreateManualPointAdjustmentPayload = {
  userId: string;
  userName: string;
  ledgerType: Extract<PointLedgerType, '?곷┰' | '李④컧' | '?뚯닔' | '蹂듦뎄'>;
  amount: number;
  reason: string;
  approvalMemo: string;
  actedBy?: string;
};

type SavePointExpirationHoldPayload = {
  expirationId: string;
  holdReason: string;
  actedBy?: string;
};

type ReleasePointExpirationHoldPayload = {
  expirationId: string;
  reason: string;
  actedBy?: string;
};

type ExportPointExpirationsPayload = {
  itemCount: number;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Request aborted', 'AbortError'));
      return;
    }

    const timer = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = (): void => {
      cleanup();
      reject(new DOMException('Request aborted', 'AbortError'));
    };

    const cleanup = (): void => {
      window.clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function clonePolicies(items: PointPolicy[]): PointPolicy[] {
  return items.map((item) => ({ ...item }));
}

function cloneLedgers(items: PointLedger[]): PointLedger[] {
  return items.map((item) => ({ ...item }));
}

function cloneExpirations(items: PointExpiration[]): PointExpiration[] {
  return items.map((item) => ({ ...item }));
}

function cloneSnapshot(): CommercePointsSnapshot {
  return {
    policies: clonePolicies(pointPolicies),
    ledgers: cloneLedgers(pointLedgers),
    expirations: cloneExpirations(pointExpirations)
  };
}

function formatNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function createSequenceId(prefix: string, items: Array<{ id: string }>): string {
  const numeric = items
    .map((item) => Number(item.id.replace(/[^0-9]/g, '')))
    .filter((value) => Number.isFinite(value));
  const nextNumber = (numeric.length ? Math.max(...numeric) : 0) + 1;
  return `${prefix}-${String(nextNumber).padStart(4, '0')}`;
}

function getLatestUserBalance(userId: string): number {
  const latestLedger = pointLedgers.find((item) => item.userId === userId);
  return latestLedger?.availableBalanceAfter ?? 0;
}

function appendReasonLog(
  baseNote: string,
  actedBy: string,
  message: string
): string {
  return `${baseNote}\n- ${formatNow()} ${actedBy}: ${message}`.trim();
}

let pointPolicies: PointPolicy[] = [
  {
    id: 'POL-1001',
    name: '異붿쿇 媛??蹂댁긽',
    policyType: '?곷┰',
    conditionSummary: '異붿쿇 肄붾뱶 媛????異붿쿇 ?뺤젙 ??1???곷┰',
    earnDebitRule: '異붿쿇 ?뺤젙 ??異붿쿇??1,000P ?곷┰',
    expirationRule: '?곷┰ ??90?????뚮㈇',
    status: '운영 以?,
    updatedAt: '2026-03-24 10:10',
    updatedBy: 'ops.kim',
    targetCondition: '異붿쿇 ?뺤젙 회원',
    triggerSource: '異붿쿇',
    duplicationRule: '異붿쿇 愿怨?1嫄대떦 1?뚮쭔 ?곷┰',
    manualAdjustmentRule: '?덉쇅 議곗젙? 운영 愿由ъ옄 ?뱀씤 ??媛??,
    note: '異붿쿇 ?뺤콉 ?뺤젙 ?꾧퉴吏 1,000P 湲곗??쇰줈 운영 以?
  },
  {
    id: 'POL-1002',
    name: '誘몄뀡 완료 蹂댁긽',
    policyType: '?곷┰',
    conditionSummary: '?숈뒿 誘몄뀡 완료 ??즉시 ?곷┰',
    earnDebitRule: '誘몄뀡蹂?300P~1,500P 李⑤벑 ?곷┰',
    expirationRule: '?곷┰ ??60?????뚮㈇',
    status: '운영 以?,
    updatedAt: '2026-03-23 16:40',
    updatedBy: 'content.lee',
    targetCondition: '誘몄뀡 완료 회원',
    triggerSource: '誘몄뀡',
    duplicationRule: '?숈씪 誘몄뀡 ?ъ갭?????곷┰ ?쒗븳',
    manualAdjustmentRule: '?댁긽 ?곷┰留??섎룞 ?뚯닔 ?덉슜',
    note: '誘몄뀡 ?쒖씠?꾨퀎 蹂댁긽 湲덉븸? ?꾩쭅 운영 媛?대뱶??留욎떠 議곗젙 ?덉젙'
  },
  {
    id: 'POL-1003',
    name: '결제 ?ъ씤???ъ슜',
    policyType: '李④컧',
    conditionSummary: '결제 ???ъ슜 媛???ъ씤??李④컧',
    earnDebitRule: '결제 성공 수?ъ슜 ?ъ씤??李④컧',
    expirationRule: '환불 ??李④컧 ?ъ씤??蹂듦뎄 ?щ? 寃???꾩슂',
    status: '珥덉븞',
    updatedAt: '2026-03-22 09:05',
    updatedBy: 'ops.park',
    targetCondition: '?ъ씤???ъ슜 결제 회원',
    triggerSource: '결제',
    duplicationRule: '二쇰Ц ?⑥쐞 1??李④컧',
    manualAdjustmentRule: '환불 蹂듦뎄???щТ 寃?????섎룞 ?뱀씤',
    note: '李④컧 ?곗꽑?쒖쐞? 환불 蹂듦뎄 ?뺤콉???꾩쭅 誘명솗??
  },
  {
    id: 'POL-1004',
    name: '?뚮㈇ ?덇퀬 湲곕낯 洹쒖튃',
    policyType: '?뚮㈇',
    conditionSummary: '?좏슚湲곌컙??吏???ъ씤???먮룞 ?뚮㈇',
    earnDebitRule: '?뚮㈇ 대상?ъ씤?몃? 留뚮즺 ?쇱떆??李④컧',
    expirationRule: '留뚮즺 7?????ъ쟾 ?덈궡 ???먮룞 ?뚮㈇',
    status: '以묒?',
    updatedAt: '2026-03-21 14:20',
    updatedBy: 'ops.kim',
    targetCondition: '?좏슚湲곌컙 醫낅즺 ?ъ씤??,
    triggerSource: '시스템,
    duplicationRule: '?숈씪 ?먯옣 以묐났 ?뚮㈇ 湲덉?',
    manualAdjustmentRule: '蹂대쪟 ?깅줉 ???먮룞 ?뚮㈇ ?쒖쇅',
    note: '?ъ쟾 ?덈궡 ?쒖젏怨??덉쇅 湲곗? ?ш??좊줈 ?쇱떆 以묒?'
  }
];

let pointLedgers: PointLedger[] = [
  {
    id: 'PL-2008',
    occurredAt: '2026-03-26 14:20',
    userId: 'U00018',
    userName: '源?섎┛',
    ledgerType: '?곷┰',
    sourceType: '?대깽??,
    pointDelta: 500,
    balanceAfter: 3500,
    availableBalanceAfter: 3200,
    status: '완료',
    expirationAt: '2026-06-24',
    sourceId: 'EVT-3201',
    sourceLabel: '遊?異쒖꽍 ?대깽??,
    policyId: 'POL-1001',
    policyName: '異붿쿇 媛??蹂댁긽',
    reason: '?대깽??李몄뿬 ?곷┰',
    approvalMemo: '?먮룞 ?곷┰',
    actedBy: 'system'
  },
  {
    id: 'PL-2007',
    occurredAt: '2026-03-26 11:05',
    userId: 'U00004',
    userName: '諛뺤꽑??,
    ledgerType: '?뚯닔',
    sourceType: '愿由ъ옄',
    pointDelta: -700,
    balanceAfter: 1200,
    availableBalanceAfter: 1200,
    status: '완료',
    expirationAt: '',
    sourceId: 'MANUAL-9003',
    sourceLabel: '운영 ?섎룞 ?뚯닔',
    policyId: 'POL-1002',
    policyName: '誘몄뀡 완료 蹂댁긽',
    reason: '以묐났 ?곷┰ ?뺤씤?쇰줈 ?뚯닔',
    approvalMemo: '운영 愿由ъ옄 ?뺤씤 완료',
    actedBy: 'ops.kim'
  },
  {
    id: 'PL-2006',
    occurredAt: '2026-03-26 09:30',
    userId: 'U00009',
    userName: '?댁꽌以',
    ledgerType: '?곷┰',
    sourceType: '異붿쿇',
    pointDelta: 1000,
    balanceAfter: 5400,
    availableBalanceAfter: 5400,
    status: '완료',
    expirationAt: '2026-06-24',
    sourceId: 'REF-1102',
    sourceLabel: '異붿쿇 肄붾뱶 REF-1102',
    policyId: 'POL-1001',
    policyName: '異붿쿇 媛??蹂댁긽',
    reason: '異붿쿇 ?뺤젙 蹂댁긽',
    approvalMemo: '?먮룞 ?곷┰',
    actedBy: 'system'
  },
  {
    id: 'PL-2005',
    occurredAt: '2026-03-25 16:15',
    userId: 'U00012',
    userName: '理쒖삁由?,
    ledgerType: '李④컧',
    sourceType: '결제',
    pointDelta: -2000,
    balanceAfter: 800,
    availableBalanceAfter: 800,
    status: '蹂대쪟',
    expirationAt: '',
    sourceId: 'PAY-1005',
    sourceLabel: '결제 PAY-1005',
    policyId: 'POL-1003',
    policyName: '결제 ?ъ씤???ъ슜',
    reason: '결제 ?ъ씤???ъ슜 ?곸슜 대기,
    approvalMemo: '환불 蹂듦뎄 ?뺤콉 寃??以?,
    actedBy: 'billing.bot'
  },
  {
    id: 'PL-2004',
    occurredAt: '2026-03-25 09:45',
    userId: 'U00021',
    userName: '?ㅻ???,
    ledgerType: '蹂듦뎄',
    sourceType: '환불',
    pointDelta: 1200,
    balanceAfter: 2600,
    availableBalanceAfter: 2600,
    status: '완료',
    expirationAt: '2026-05-31',
    sourceId: 'RF-002',
    sourceLabel: '환불 RF-002',
    policyId: 'POL-1003',
    policyName: '결제 ?ъ씤???ъ슜',
    reason: '환불 ?뱀씤?쇰줈 ?ъ씤??蹂듦뎄',
    approvalMemo: '?щТ ?뱀씤 완료',
    actedBy: 'ops.finance'
  },
  {
    id: 'PL-2003',
    occurredAt: '2026-03-24 18:00',
    userId: 'U00001',
    userName: '源誘쇱?',
    ledgerType: '?뚮㈇',
    sourceType: '시스템,
    pointDelta: -1500,
    balanceAfter: 900,
    availableBalanceAfter: 900,
    status: '취소',
    expirationAt: '2026-03-24',
    sourceId: 'EXP-3002',
    sourceLabel: '?뚮㈇ 예약 EXP-3002',
    policyId: 'POL-1004',
    policyName: '?뚮㈇ ?덇퀬 湲곕낯 洹쒖튃',
    reason: '蹂대쪟 ?깅줉?쇰줈 ?뚮㈇ 취소',
    approvalMemo: '怨좉컼?쇳꽣 ?뱀씤',
    actedBy: 'system'
  },
  {
    id: 'PL-2002',
    occurredAt: '2026-03-24 10:00',
    userId: 'U00030',
    userName: '?뺤삁??,
    ledgerType: '?곷┰',
    sourceType: '誘몄뀡',
    pointDelta: 800,
    balanceAfter: 4300,
    availableBalanceAfter: 4300,
    status: '완료',
    expirationAt: '2026-05-23',
    sourceId: 'MIS-3209',
    sourceLabel: '珥덇툒 ?ｊ린 誘몄뀡',
    policyId: 'POL-1002',
    policyName: '誘몄뀡 완료 蹂댁긽',
    reason: '誘몄뀡 완료 蹂댁긽',
    approvalMemo: '?먮룞 ?곷┰',
    actedBy: 'system'
  },
  {
    id: 'PL-2001',
    occurredAt: '2026-03-23 08:30',
    userId: 'U00005',
    userName: '?쒖???,
    ledgerType: '?곷┰',
    sourceType: '愿由ъ옄',
    pointDelta: 2000,
    balanceAfter: 2000,
    availableBalanceAfter: 2000,
    status: '완료',
    expirationAt: '2026-06-21',
    sourceId: 'MANUAL-9001',
    sourceLabel: '운영 ?섎룞 ?곷┰',
    policyId: 'POL-1002',
    policyName: '誘몄뀡 완료 蹂댁긽',
    reason: '怨좉컼 蹂댁긽 吏湲?,
    approvalMemo: 'VOC 대상,
    actedBy: 'ops.park'
  }
];

let pointExpirations: PointExpiration[] = [
  {
    id: 'EXP-3005',
    scheduledAt: '2026-03-27 00:00',
    userId: 'U00009',
    userName: '?댁꽌以',
    sourceType: '異붿쿇',
    expiringPoint: 1000,
    availablePoint: 5400,
    status: '?덉젙',
    holdReason: '',
    heldBy: '',
    processedAt: '',
    relatedLedgerId: 'PL-2006',
    policyId: 'POL-1001',
    policyName: '異붿쿇 媛??蹂댁긽',
    calculationMemo: '異붿쿇 蹂댁긽 90??留뚮즺 ?덉젙'
  },
  {
    id: 'EXP-3004',
    scheduledAt: '2026-03-28 00:00',
    userId: 'U00012',
    userName: '理쒖삁由?,
    sourceType: '결제',
    expiringPoint: 1200,
    availablePoint: 800,
    status: '蹂대쪟',
    holdReason: '환불 寃??완료 ??留뚮즺 ?ш퀎???꾩슂',
    heldBy: 'ops.finance',
    processedAt: '',
    relatedLedgerId: 'PL-2004',
    policyId: 'POL-1003',
    policyName: '결제 ?ъ씤???ъ슜',
    calculationMemo: '환불 蹂듦뎄 ?ъ씤?몃씪 ?ш퀎???꾧퉴吏 蹂대쪟'
  },
  {
    id: 'EXP-3003',
    scheduledAt: '2026-03-29 00:00',
    userId: 'U00018',
    userName: '源?섎┛',
    sourceType: '?대깽??,
    expiringPoint: 500,
    availablePoint: 3200,
    status: '?덉젙',
    holdReason: '',
    heldBy: '',
    processedAt: '',
    relatedLedgerId: 'PL-2008',
    policyId: 'POL-1001',
    policyName: '異붿쿇 媛??蹂댁긽',
    calculationMemo: '?대깽???곷┰遺?湲곕낯 留뚮즺 ?덉젙'
  },
  {
    id: 'EXP-3002',
    scheduledAt: '2026-03-24 00:00',
    userId: 'U00001',
    userName: '源誘쇱?',
    sourceType: '시스템,
    expiringPoint: 1500,
    availablePoint: 900,
    status: '취소',
    holdReason: '怨좉컼?쇳꽣 蹂대쪟 ?깅줉 ??취소',
    heldBy: 'ops.kim',
    processedAt: '2026-03-24 09:10',
    relatedLedgerId: 'PL-2003',
    policyId: 'POL-1004',
    policyName: '?뚮㈇ ?덇퀬 湲곕낯 洹쒖튃',
    calculationMemo: '?뚮㈇ ?쒕룄 ??蹂대쪟 ?꾪솚?쇰줈 취소 泥섎━'
  },
  {
    id: 'EXP-3001',
    scheduledAt: '2026-03-22 00:00',
    userId: 'U00007',
    userName: '議곗쑀吏?,
    sourceType: '誘몄뀡',
    expiringPoint: 900,
    availablePoint: 0,
    status: '완료',
    holdReason: '',
    heldBy: '',
    processedAt: '2026-03-22 00:01',
    relatedLedgerId: 'PL-1899',
    policyId: 'POL-1002',
    policyName: '誘몄뀡 완료 蹂댁긽',
    calculationMemo: '?덉젙 ?쇱떆???먮룞 ?뚮㈇ 泥섎━'
  }
];

async function loadPointsSnapshot(
  signal?: AbortSignal
): Promise<CommercePointsSnapshot> {
  await sleep(320, signal);
  return cloneSnapshot();
}

async function savePointPolicy(
  payload: SavePointPolicyPayload
): Promise<PointPolicy> {
  await sleep(180);

  const actedBy = payload.actedBy ?? 'ops.kim';
  const updatedAt = formatNow();

  if (payload.policyId) {
    const current = pointPolicies.find((item) => item.id === payload.policyId);
    if (!current) {
      throw new Error('?ъ씤???뺤콉??李얠쓣 ???놁뒿?덈떎.');
    }

    const updatedPolicy: PointPolicy = {
      ...current,
      name: payload.name,
      policyType: payload.policyType,
      conditionSummary: payload.conditionSummary,
      earnDebitRule: payload.earnDebitRule,
      expirationRule: payload.expirationRule,
      targetCondition: payload.targetCondition,
      triggerSource: payload.triggerSource,
      duplicationRule: payload.duplicationRule,
      manualAdjustmentRule: payload.manualAdjustmentRule,
      note: payload.note.trim(),
      updatedAt,
      updatedBy: actedBy
    };

    pointPolicies = pointPolicies.map((item) =>
      item.id === payload.policyId ? updatedPolicy : item
    );

    return { ...updatedPolicy };
  }

  const nextPolicy: PointPolicy = {
    id: createSequenceId('POL', pointPolicies),
    name: payload.name,
    policyType: payload.policyType,
    conditionSummary: payload.conditionSummary,
    earnDebitRule: payload.earnDebitRule,
    expirationRule: payload.expirationRule,
    status: '珥덉븞',
    updatedAt,
    updatedBy: actedBy,
    targetCondition: payload.targetCondition,
    triggerSource: payload.triggerSource,
    duplicationRule: payload.duplicationRule,
    manualAdjustmentRule: payload.manualAdjustmentRule,
    note: payload.note.trim()
  };

  pointPolicies = [nextPolicy, ...pointPolicies];
  return { ...nextPolicy };
}

async function updatePointPolicyStatus(
  payload: UpdatePointPolicyStatusPayload
): Promise<PointPolicy> {
  await sleep(160);

  const current = pointPolicies.find((item) => item.id === payload.policyId);
  if (!current) {
    throw new Error('?ъ씤???뺤콉??李얠쓣 ???놁뒿?덈떎.');
  }

  const actedBy = payload.actedBy ?? 'ops.kim';
  const nextPolicy: PointPolicy = {
    ...current,
    status: payload.nextStatus,
    updatedAt: formatNow(),
    updatedBy: actedBy,
    note: appendReasonLog(
      current.note,
      actedBy,
      `${payload.nextStatus} ?꾪솚 - ${payload.reason}`
    )
  };

  pointPolicies = pointPolicies.map((item) =>
    item.id === payload.policyId ? nextPolicy : item
  );

  return { ...nextPolicy };
}

function updateExpirationsForManualAdjustment(
  userId: string,
  pointDelta: number
): void {
  if (pointDelta >= 0) {
    return;
  }

  let remaining = Math.abs(pointDelta);

  pointExpirations = pointExpirations.map((item) => {
    if (item.userId !== userId || item.status !== '?덉젙' || remaining <= 0) {
      return item;
    }

    const deducted = Math.min(item.availablePoint, remaining);
    remaining -= deducted;

    return {
      ...item,
      availablePoint: Math.max(item.availablePoint - deducted, 0),
      calculationMemo: appendReasonLog(
        item.calculationMemo,
        'system',
        `?섎룞 議곗젙 諛섏쁺 - ?ъ슜 媛???ъ씤??${deducted}P 李④컧`
      )
    };
  });
}

async function createManualPointAdjustment(
  payload: CreateManualPointAdjustmentPayload
): Promise<PointLedger> {
  await sleep(220);

  const actedBy = payload.actedBy ?? 'ops.kim';
  const occurredAt = formatNow();
  const pointDelta =
    payload.ledgerType === '李④컧' || payload.ledgerType === '?뚯닔'
      ? -Math.abs(payload.amount)
      : Math.abs(payload.amount);
  const availableBalanceBefore = getLatestUserBalance(payload.userId);
  const nextBalance = availableBalanceBefore + pointDelta;

  const nextLedger: PointLedger = {
    id: createSequenceId('PL', pointLedgers),
    occurredAt,
    userId: payload.userId,
    userName: payload.userName,
    ledgerType: payload.ledgerType,
    sourceType: '愿由ъ옄',
    pointDelta,
    balanceAfter: nextBalance,
    availableBalanceAfter: nextBalance,
    status: '완료',
    expirationAt: pointDelta > 0 ? '2026-06-30' : '',
    sourceId: createSequenceId('MANUAL', pointLedgers),
    sourceLabel: '운영 ?섎룞 議곗젙',
    policyId: 'POL-1002',
    policyName: '운영 ?섎룞 議곗젙',
    reason: payload.reason.trim(),
    approvalMemo: payload.approvalMemo.trim(),
    actedBy
  };

  pointLedgers = [nextLedger, ...pointLedgers];
  updateExpirationsForManualAdjustment(payload.userId, pointDelta);

  return { ...nextLedger };
}

async function savePointExpirationHold(
  payload: SavePointExpirationHoldPayload
): Promise<PointExpiration> {
  await sleep(180);

  const current = pointExpirations.find((item) => item.id === payload.expirationId);
  if (!current) {
    throw new Error('?뚮㈇ ?덉젙 嫄댁쓣 李얠쓣 ???놁뒿?덈떎.');
  }

  const actedBy = payload.actedBy ?? 'ops.kim';
  const nextStatus: PointExpirationStatus =
    current.status === '완료' ? '완료' : '蹂대쪟';
  const nextExpiration: PointExpiration = {
    ...current,
    status: nextStatus,
    holdReason: payload.holdReason.trim(),
    heldBy: actedBy,
    calculationMemo: appendReasonLog(
      current.calculationMemo,
      actedBy,
      `蹂대쪟 ?깅줉 - ${payload.holdReason}`
    )
  };

  pointExpirations = pointExpirations.map((item) =>
    item.id === payload.expirationId ? nextExpiration : item
  );

  return { ...nextExpiration };
}

async function releasePointExpirationHold(
  payload: ReleasePointExpirationHoldPayload
): Promise<PointExpiration> {
  await sleep(180);

  const current = pointExpirations.find((item) => item.id === payload.expirationId);
  if (!current) {
    throw new Error('?뚮㈇ ?덉젙 嫄댁쓣 李얠쓣 ???놁뒿?덈떎.');
  }

  const actedBy = payload.actedBy ?? 'ops.kim';
  const nextExpiration: PointExpiration = {
    ...current,
    status: '?덉젙',
    holdReason: '',
    heldBy: '',
    calculationMemo: appendReasonLog(
      current.calculationMemo,
      actedBy,
      `蹂대쪟 ?댁젣 - ${payload.reason}`
    )
  };

  pointExpirations = pointExpirations.map((item) =>
    item.id === payload.expirationId ? nextExpiration : item
  );

  return { ...nextExpiration };
}

async function exportPointExpirations(
  payload: ExportPointExpirationsPayload
): Promise<{ exportedAt: string; itemCount: number }> {
  await sleep(120);
  return {
    exportedAt: formatNow(),
    itemCount: payload.itemCount
  };
}

export function fetchPointsSnapshotSafe(signal?: AbortSignal) {
  return toSafeResult(() =>
    withRetry(() => loadPointsSnapshot(signal), {
      maxRetries: 1
    })
  );
}

export function savePointPolicySafe(payload: SavePointPolicyPayload) {
  return toSafeResult(() => savePointPolicy(payload));
}

export function updatePointPolicyStatusSafe(
  payload: UpdatePointPolicyStatusPayload
) {
  return toSafeResult(() => updatePointPolicyStatus(payload));
}

export function createManualPointAdjustmentSafe(
  payload: CreateManualPointAdjustmentPayload
) {
  return toSafeResult(() => createManualPointAdjustment(payload));
}

export function savePointExpirationHoldSafe(
  payload: SavePointExpirationHoldPayload
) {
  return toSafeResult(() => savePointExpirationHold(payload));
}

export function releasePointExpirationHoldSafe(
  payload: ReleasePointExpirationHoldPayload
) {
  return toSafeResult(() => releasePointExpirationHold(payload));
}

export function exportPointExpirationsSafe(
  payload: ExportPointExpirationsPayload
) {
  return toSafeResult(() => exportPointExpirations(payload));
}


