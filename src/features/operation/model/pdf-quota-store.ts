import { create } from 'zustand';

import {
  mockPdfQuotaPolicies,
  mockPdfQuotaPolicyHistory,
  mockPdfQuotaResets
} from '../api/mock-pdf-quota';
import type {
  PdfQuotaPeriodUnit,
  PdfQuotaPolicy,
  PdfQuotaPolicyHistoryEntry,
  PdfQuotaReset,
  PdfQuotaResetScope
} from './pdf-quota-types';

export type SavePdfQuotaPolicyPayload = {
  limitCount: number;
  periodUnit: PdfQuotaPeriodUnit;
  periodTimezone: string;
  reason: string;
  // 동시 편집 감지용. mock 경로에서는 무시된다.
  expectedUpdatedAt?: string | null;
};

export type CreatePdfQuotaResetPayload = {
  scope: PdfQuotaResetScope;
  userId?: string | null;
  userLabel?: string | null;
  groupCode?: string | null;
  problemId?: string | null;
  reason: string;
};

type PdfQuotaStore = {
  policies: PdfQuotaPolicy[];
  policyHistory: PdfQuotaPolicyHistoryEntry[];
  resets: PdfQuotaReset[];
  savePolicy: (payload: SavePdfQuotaPolicyPayload) => PdfQuotaPolicy;
  createReset: (payload: CreatePdfQuotaResetPayload) => PdfQuotaReset;
};

function nowLabel(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export const usePdfQuotaStore = create<PdfQuotaStore>((set, get) => ({
  policies: mockPdfQuotaPolicies,
  policyHistory: mockPdfQuotaPolicyHistory,
  resets: mockPdfQuotaResets,

  // 단일 설정 모델: 항상 현재 정책 1행을 갱신하고 이력을 앞에 쌓는다.
  savePolicy: (payload) => {
    const { policies, policyHistory } = get();
    const current = policies.find((policy) => policy.isActive) ?? policies[0];
    const base: PdfQuotaPolicy = current ?? {
      id: 'PDFQ-POLICY-001',
      subjectScope: 'user',
      resourceScope: 'problem',
      periodUnit: 'month',
      periodTimezone: 'Asia/Seoul',
      limitCount: 3,
      priority: 100,
      isActive: true,
      createdAt: nowLabel(),
      updatedAt: nowLabel(),
      updatedAtIso: new Date().toISOString()
    };

    const updated: PdfQuotaPolicy = {
      ...base,
      limitCount: payload.limitCount,
      periodUnit: payload.periodUnit,
      periodTimezone: payload.periodTimezone,
      isActive: true,
      updatedAt: nowLabel(),
      updatedAtIso: new Date().toISOString()
    };

    const historyEntry: PdfQuotaPolicyHistoryEntry = {
      id: `PDFQ-AUDIT-${String(policyHistory.length + 1).padStart(3, '0')}`,
      createdAt: nowLabel(),
      actorName: '운영 관리자',
      actorEmail: 'ops-admin@talkpik.dev',
      reason: payload.reason,
      limitFrom: current?.limitCount ?? null,
      limitTo: payload.limitCount,
      periodUnitFrom: current?.periodUnit ?? null,
      periodUnitTo: payload.periodUnit,
      periodTimezoneFrom: current?.periodTimezone ?? null,
      periodTimezoneTo: payload.periodTimezone,
      resultLimit: payload.limitCount,
      resultPeriodUnit: payload.periodUnit
    };

    set({
      policies: [updated],
      policyHistory: [historyEntry, ...policyHistory]
    });
    return updated;
  },

  createReset: (payload) => {
    const { resets } = get();
    const created: PdfQuotaReset = {
      id: `PDFQ-RESET-${String(resets.length + 1).padStart(3, '0')}`,
      scope: payload.scope,
      problemId: payload.problemId ?? null,
      reason: payload.reason,
      actorEmail: 'ops-admin@talkpik.dev',
      actorName: '운영 관리자',
      targetCount:
        payload.scope === 'user' ? 1 : payload.scope === 'group' ? 12 : 36,
      createdAt: nowLabel()
    };
    set({ resets: [created, ...resets] });
    return created;
  }
}));
