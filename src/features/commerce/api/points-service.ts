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
  nextStatus: Exclude<PointPolicyStatus, '초안'>;
  reason: string;
  actedBy?: string;
};

type CreateManualPointAdjustmentPayload = {
  userId: string;
  userName: string;
  ledgerType: Extract<PointLedgerType, '적립' | '차감' | '회수' | '복구'>;
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
    name: '추천 가입 보상',
    policyType: '적립',
    conditionSummary: '추천 코드 가입 후 추천 확정 시 1회 적립',
    earnDebitRule: '추천 확정 시 추천인 1,000P 적립',
    expirationRule: '적립 후 90일 뒤 소멸',
    status: '운영 중',
    updatedAt: '2026-03-24 10:10',
    updatedBy: 'ops.kim',
    targetCondition: '추천 확정 회원',
    triggerSource: '추천',
    duplicationRule: '추천 관계 1건당 1회만 적립',
    manualAdjustmentRule: '예외 조정은 운영 관리자 승인 후 가능',
    note: '추천 정책 확정 전까지 1,000P 기준으로 운영 중'
  },
  {
    id: 'POL-1002',
    name: '미션 완료 보상',
    policyType: '적립',
    conditionSummary: '학습 미션 완료 시 즉시 적립',
    earnDebitRule: '미션별 300P~1,500P 차등 적립',
    expirationRule: '적립 후 60일 뒤 소멸',
    status: '운영 중',
    updatedAt: '2026-03-23 16:40',
    updatedBy: 'content.lee',
    targetCondition: '미션 완료 회원',
    triggerSource: '미션',
    duplicationRule: '동일 미션 재참여 시 적립 제한',
    manualAdjustmentRule: '이상 적립만 수동 회수 허용',
    note: '미션 난이도별 보상 금액은 아직 운영 가이드에 맞춰 조정 예정'
  },
  {
    id: 'POL-1003',
    name: '결제 포인트 사용',
    policyType: '차감',
    conditionSummary: '결제 시 사용 가능 포인트 차감',
    earnDebitRule: '결제 성공 시 사용 포인트 차감',
    expirationRule: '환불 시 차감 포인트 복구 여부 검토 필요',
    status: '초안',
    updatedAt: '2026-03-22 09:05',
    updatedBy: 'ops.park',
    targetCondition: '포인트 사용 결제 회원',
    triggerSource: '결제',
    duplicationRule: '주문 단위 1회 차감',
    manualAdjustmentRule: '환불 복구는 재무 검토 후 수동 승인',
    note: '차감 우선순위와 환불 복구 정책이 아직 미확정'
  },
  {
    id: 'POL-1004',
    name: '소멸 예고 기본 규칙',
    policyType: '소멸',
    conditionSummary: '유효기간이 지난 포인트 자동 소멸',
    earnDebitRule: '소멸 대상 포인트를 만료 일시에 차감',
    expirationRule: '만료 7일 전 사전 안내 후 자동 소멸',
    status: '중지',
    updatedAt: '2026-03-21 14:20',
    updatedBy: 'ops.kim',
    targetCondition: '유효기간 종료 포인트',
    triggerSource: '시스템',
    duplicationRule: '동일 원장 중복 소멸 금지',
    manualAdjustmentRule: '보류 등록 시 자동 소멸 제외',
    note: '사전 안내 시점과 예외 기준 재검토로 일시 중지'
  }
];

let pointLedgers: PointLedger[] = [
  {
    id: 'PL-2008',
    occurredAt: '2026-03-26 14:20',
    userId: 'U00018',
    userName: '김하린',
    ledgerType: '적립',
    sourceType: '이벤트',
    pointDelta: 500,
    balanceAfter: 3500,
    availableBalanceAfter: 3200,
    status: '완료',
    expirationAt: '2026-06-24',
    sourceId: 'EVT-3201',
    sourceLabel: '봄 출석 이벤트',
    policyId: 'POL-1001',
    policyName: '추천 가입 보상',
    reason: '이벤트 참여 적립',
    approvalMemo: '자동 적립',
    actedBy: 'system'
  },
  {
    id: 'PL-2007',
    occurredAt: '2026-03-26 11:05',
    userId: 'U00004',
    userName: '박선우',
    ledgerType: '회수',
    sourceType: '관리자',
    pointDelta: -700,
    balanceAfter: 1200,
    availableBalanceAfter: 1200,
    status: '완료',
    expirationAt: '',
    sourceId: 'MANUAL-9003',
    sourceLabel: '운영 수동 회수',
    policyId: 'POL-1002',
    policyName: '미션 완료 보상',
    reason: '중복 적립 확인으로 회수',
    approvalMemo: '운영 관리자 확인 완료',
    actedBy: 'ops.kim'
  },
  {
    id: 'PL-2006',
    occurredAt: '2026-03-26 09:30',
    userId: 'U00009',
    userName: '이서준',
    ledgerType: '적립',
    sourceType: '추천',
    pointDelta: 1000,
    balanceAfter: 5400,
    availableBalanceAfter: 5400,
    status: '완료',
    expirationAt: '2026-06-24',
    sourceId: 'REF-1102',
    sourceLabel: '추천 코드 REF-1102',
    policyId: 'POL-1001',
    policyName: '추천 가입 보상',
    reason: '추천 확정 보상',
    approvalMemo: '자동 적립',
    actedBy: 'system'
  },
  {
    id: 'PL-2005',
    occurredAt: '2026-03-25 16:15',
    userId: 'U00012',
    userName: '최예린',
    ledgerType: '차감',
    sourceType: '결제',
    pointDelta: -2000,
    balanceAfter: 800,
    availableBalanceAfter: 800,
    status: '보류',
    expirationAt: '',
    sourceId: 'PAY-1005',
    sourceLabel: '결제 PAY-1005',
    policyId: 'POL-1003',
    policyName: '결제 포인트 사용',
    reason: '결제 포인트 사용 적용 대기',
    approvalMemo: '환불 복구 정책 검토 중',
    actedBy: 'billing.bot'
  },
  {
    id: 'PL-2004',
    occurredAt: '2026-03-25 09:45',
    userId: 'U00021',
    userName: '오민재',
    ledgerType: '복구',
    sourceType: '환불',
    pointDelta: 1200,
    balanceAfter: 2600,
    availableBalanceAfter: 2600,
    status: '완료',
    expirationAt: '2026-05-31',
    sourceId: 'RF-002',
    sourceLabel: '환불 RF-002',
    policyId: 'POL-1003',
    policyName: '결제 포인트 사용',
    reason: '환불 승인으로 포인트 복구',
    approvalMemo: '재무 승인 완료',
    actedBy: 'ops.finance'
  },
  {
    id: 'PL-2003',
    occurredAt: '2026-03-24 18:00',
    userId: 'U00001',
    userName: '김민지',
    ledgerType: '소멸',
    sourceType: '시스템',
    pointDelta: -1500,
    balanceAfter: 900,
    availableBalanceAfter: 900,
    status: '취소',
    expirationAt: '2026-03-24',
    sourceId: 'EXP-3002',
    sourceLabel: '소멸 예약 EXP-3002',
    policyId: 'POL-1004',
    policyName: '소멸 예고 기본 규칙',
    reason: '보류 등록으로 소멸 취소',
    approvalMemo: '고객센터 승인',
    actedBy: 'system'
  },
  {
    id: 'PL-2002',
    occurredAt: '2026-03-24 10:00',
    userId: 'U00030',
    userName: '정예나',
    ledgerType: '적립',
    sourceType: '미션',
    pointDelta: 800,
    balanceAfter: 4300,
    availableBalanceAfter: 4300,
    status: '완료',
    expirationAt: '2026-05-23',
    sourceId: 'MIS-3209',
    sourceLabel: '초급 듣기 미션',
    policyId: 'POL-1002',
    policyName: '미션 완료 보상',
    reason: '미션 완료 보상',
    approvalMemo: '자동 적립',
    actedBy: 'system'
  },
  {
    id: 'PL-2001',
    occurredAt: '2026-03-23 08:30',
    userId: 'U00005',
    userName: '한지수',
    ledgerType: '적립',
    sourceType: '관리자',
    pointDelta: 2000,
    balanceAfter: 2000,
    availableBalanceAfter: 2000,
    status: '완료',
    expirationAt: '2026-06-21',
    sourceId: 'MANUAL-9001',
    sourceLabel: '운영 수동 적립',
    policyId: 'POL-1002',
    policyName: '미션 완료 보상',
    reason: '고객 보상 지급',
    approvalMemo: 'VOC 대응',
    actedBy: 'ops.park'
  }
];

let pointExpirations: PointExpiration[] = [
  {
    id: 'EXP-3005',
    scheduledAt: '2026-03-27 00:00',
    userId: 'U00009',
    userName: '이서준',
    sourceType: '추천',
    expiringPoint: 1000,
    availablePoint: 5400,
    status: '예정',
    holdReason: '',
    heldBy: '',
    processedAt: '',
    relatedLedgerId: 'PL-2006',
    policyId: 'POL-1001',
    policyName: '추천 가입 보상',
    calculationMemo: '추천 보상 90일 만료 예정'
  },
  {
    id: 'EXP-3004',
    scheduledAt: '2026-03-28 00:00',
    userId: 'U00012',
    userName: '최예린',
    sourceType: '결제',
    expiringPoint: 1200,
    availablePoint: 800,
    status: '보류',
    holdReason: '환불 검토 완료 후 만료 재계산 필요',
    heldBy: 'ops.finance',
    processedAt: '',
    relatedLedgerId: 'PL-2004',
    policyId: 'POL-1003',
    policyName: '결제 포인트 사용',
    calculationMemo: '환불 복구 포인트라 재계산 전까지 보류'
  },
  {
    id: 'EXP-3003',
    scheduledAt: '2026-03-29 00:00',
    userId: 'U00018',
    userName: '김하린',
    sourceType: '이벤트',
    expiringPoint: 500,
    availablePoint: 3200,
    status: '예정',
    holdReason: '',
    heldBy: '',
    processedAt: '',
    relatedLedgerId: 'PL-2008',
    policyId: 'POL-1001',
    policyName: '추천 가입 보상',
    calculationMemo: '이벤트 적립분 기본 만료 예정'
  },
  {
    id: 'EXP-3002',
    scheduledAt: '2026-03-24 00:00',
    userId: 'U00001',
    userName: '김민지',
    sourceType: '시스템',
    expiringPoint: 1500,
    availablePoint: 900,
    status: '취소',
    holdReason: '고객센터 보류 등록 후 취소',
    heldBy: 'ops.kim',
    processedAt: '2026-03-24 09:10',
    relatedLedgerId: 'PL-2003',
    policyId: 'POL-1004',
    policyName: '소멸 예고 기본 규칙',
    calculationMemo: '소멸 시도 후 보류 전환으로 취소 처리'
  },
  {
    id: 'EXP-3001',
    scheduledAt: '2026-03-22 00:00',
    userId: 'U00007',
    userName: '조유진',
    sourceType: '미션',
    expiringPoint: 900,
    availablePoint: 0,
    status: '완료',
    holdReason: '',
    heldBy: '',
    processedAt: '2026-03-22 00:01',
    relatedLedgerId: 'PL-1899',
    policyId: 'POL-1002',
    policyName: '미션 완료 보상',
    calculationMemo: '예정 일시에 자동 소멸 처리'
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
      throw new Error('포인트 정책을 찾을 수 없습니다.');
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
    status: '초안',
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
    throw new Error('포인트 정책을 찾을 수 없습니다.');
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
      `${payload.nextStatus} 전환 - ${payload.reason}`
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
    if (item.userId !== userId || item.status !== '예정' || remaining <= 0) {
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
        `수동 조정 반영 - 사용 가능 포인트 ${deducted}P 차감`
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
    payload.ledgerType === '차감' || payload.ledgerType === '회수'
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
    sourceType: '관리자',
    pointDelta,
    balanceAfter: nextBalance,
    availableBalanceAfter: nextBalance,
    status: '완료',
    expirationAt: pointDelta > 0 ? '2026-06-30' : '',
    sourceId: createSequenceId('MANUAL', pointLedgers),
    sourceLabel: '운영 수동 조정',
    policyId: 'POL-1002',
    policyName: '운영 수동 조정',
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
    throw new Error('소멸 예정 건을 찾을 수 없습니다.');
  }

  const actedBy = payload.actedBy ?? 'ops.kim';
  const nextStatus: PointExpirationStatus =
    current.status === '완료' ? '완료' : '보류';
  const nextExpiration: PointExpiration = {
    ...current,
    status: nextStatus,
    holdReason: payload.holdReason.trim(),
    heldBy: actedBy,
    calculationMemo: appendReasonLog(
      current.calculationMemo,
      actedBy,
      `보류 등록 - ${payload.holdReason}`
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
    throw new Error('소멸 예정 건을 찾을 수 없습니다.');
  }

  const actedBy = payload.actedBy ?? 'ops.kim';
  const nextExpiration: PointExpiration = {
    ...current,
    status: '예정',
    holdReason: '',
    heldBy: '',
    calculationMemo: appendReasonLog(
      current.calculationMemo,
      actedBy,
      `보류 해제 - ${payload.reason}`
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
