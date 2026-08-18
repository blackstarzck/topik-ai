import { create } from 'zustand';

import {
  createInitialOperationPolicies,
  createInitialOperationPolicyHistories
} from '../api/mock-operation-policies';
import type {
  OperationPolicy,
  OperationPolicyCategory,
  OperationPolicyExposureSurface,
  OperationPolicyHistoryAction,
  OperationPolicyHistoryEntry,
  OperationPolicyRelatedAdminPage,
  OperationPolicyRelatedUserPage,
  OperationPolicyStatus,
  OperationPolicyTrackingStatus,
  OperationPolicyType
} from './policy-types';
import { formatNowMinutes as formatNow, toDateOnly as toDateString } from '@/shared/model/date-format';

const CURRENT_ACTOR = 'admin_current';

type SavePolicyPayload = {
  id?: string;
  category: OperationPolicyCategory;
  policyType: OperationPolicyType;
  title: string;
  versionLabel: string;
  effectiveDate: string;
  exposureSurfaces: OperationPolicyExposureSurface[];
  requiresConsent: boolean;
  trackingStatus: OperationPolicyTrackingStatus;
  relatedAdminPages: OperationPolicyRelatedAdminPage[];
  relatedUserPages: OperationPolicyRelatedUserPage[];
  sourceDocuments: string[];
  summary: string;
  legalReferences: string[];
  bodyHtml: string;
  adminMemo: string;
};

type TogglePolicyStatusPayload = {
  policyId: string;
  nextStatus: OperationPolicyStatus;
};

type DeletePolicyPayload = {
  policyId: string;
  reason: string;
};

type PublishPolicyHistoryVersionPayload = {
  policyId: string;
  historyId: string;
  reason: string;
};

type OperationPolicyStore = {
  policies: OperationPolicy[];
  policyHistories: OperationPolicyHistoryEntry[];
  savePolicy: (payload: SavePolicyPayload) => OperationPolicy;
  togglePolicyStatus: (
    payload: TogglePolicyStatusPayload
  ) => OperationPolicy | null;
  publishPolicyHistoryVersion: (
    payload: PublishPolicyHistoryVersionPayload
  ) => OperationPolicy | null;
  deletePolicy: (payload: DeletePolicyPayload) => OperationPolicy | null;
};

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeStringList(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => normalizeText(value)).filter(Boolean))
  );
}

function normalizeLegalReferences(values: string[]): string[] {
  return normalizeStringList(values);
}

function normalizeRelatedAdminPages(
  values: OperationPolicyRelatedAdminPage[]
): OperationPolicyRelatedAdminPage[] {
  return normalizeStringList(values) as OperationPolicyRelatedAdminPage[];
}

function normalizeRelatedUserPages(
  values: OperationPolicyRelatedUserPage[]
): OperationPolicyRelatedUserPage[] {
  return normalizeStringList(values) as OperationPolicyRelatedUserPage[];
}

function normalizeHistoryNote(value: string): string {
  return normalizeText(value);
}

function clonePolicySnapshot(policy: OperationPolicy): OperationPolicy {
  return {
    ...policy,
    exposureSurfaces: [...policy.exposureSurfaces],
    relatedAdminPages: [...policy.relatedAdminPages],
    relatedUserPages: [...policy.relatedUserPages],
    sourceDocuments: [...policy.sourceDocuments],
    legalReferences: [...policy.legalReferences]
  };
}

function getNextPolicyId(policies: OperationPolicy[]): string {
  const sequence =
    policies
      .map((policy) => Number(policy.id.split('-')[1] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `POL-${String(sequence).padStart(3, '0')}`;
}

function getNextPolicyHistoryId(
  policyHistories: OperationPolicyHistoryEntry[]
): string {
  const sequence =
    policyHistories
      .map((entry) => Number(entry.id.split('-')[1] ?? '0'))
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `PH-${String(sequence).padStart(4, '0')}`;
}

function createPolicyHistoryEntry(
  policy: OperationPolicy,
  action: OperationPolicyHistoryAction,
  note: string,
  historyId: string,
  changedAt = policy.updatedAt,
  changedBy = policy.updatedBy
): OperationPolicyHistoryEntry {
  return {
    id: historyId,
    policyId: policy.id,
    action,
    versionLabel: policy.versionLabel,
    status: policy.status,
    trackingStatus: policy.trackingStatus,
    changedAt,
    changedBy,
    note: normalizeHistoryNote(note),
    snapshot: clonePolicySnapshot(policy)
  };
}

function appendPolicyHistory(
  policyHistories: OperationPolicyHistoryEntry[],
  policy: OperationPolicy,
  action: OperationPolicyHistoryAction,
  note: string,
  changedAt = policy.updatedAt,
  changedBy = policy.updatedBy
): OperationPolicyHistoryEntry[] {
  return [
    ...policyHistories,
    createPolicyHistoryEntry(
      policy,
      action,
      note,
      getNextPolicyHistoryId(policyHistories),
      changedAt,
      changedBy
    )
  ];
}

export const useOperationPolicyStore = create<OperationPolicyStore>((set, get) => ({
  policies: createInitialOperationPolicies(),
  policyHistories: createInitialOperationPolicyHistories(),
  savePolicy: (payload) => {
    const now = formatNow();
    const target = payload.id
      ? get().policies.find((policy) => policy.id === payload.id) ?? null
      : null;

    const nextPolicy: OperationPolicy = target
      ? {
          ...target,
          category: payload.category,
          policyType: payload.policyType,
          title: normalizeText(payload.title),
          versionLabel: normalizeText(payload.versionLabel),
          effectiveDate: payload.effectiveDate,
          exposureSurfaces: [...payload.exposureSurfaces],
          requiresConsent: payload.requiresConsent,
          trackingStatus: payload.trackingStatus,
          relatedAdminPages: normalizeRelatedAdminPages(payload.relatedAdminPages),
          relatedUserPages: normalizeRelatedUserPages(payload.relatedUserPages),
          sourceDocuments: normalizeStringList(payload.sourceDocuments),
          summary: normalizeText(payload.summary),
          legalReferences: normalizeLegalReferences(payload.legalReferences),
          bodyHtml: payload.bodyHtml,
          adminMemo: normalizeText(payload.adminMemo),
          updatedAt: now,
          updatedBy: CURRENT_ACTOR
        }
      : {
          id: getNextPolicyId(get().policies),
          category: payload.category,
          policyType: payload.policyType,
          title: normalizeText(payload.title),
          versionLabel: normalizeText(payload.versionLabel),
          effectiveDate: payload.effectiveDate,
          exposureSurfaces: [...payload.exposureSurfaces],
          requiresConsent: payload.requiresConsent,
          trackingStatus: payload.trackingStatus,
          relatedAdminPages: normalizeRelatedAdminPages(payload.relatedAdminPages),
          relatedUserPages: normalizeRelatedUserPages(payload.relatedUserPages),
          sourceDocuments: normalizeStringList(payload.sourceDocuments),
          summary: normalizeText(payload.summary),
          legalReferences: normalizeLegalReferences(payload.legalReferences),
          bodyHtml: payload.bodyHtml,
          adminMemo: normalizeText(payload.adminMemo),
          status: '숨김',
          createdAt: toDateString(now),
          updatedAt: now,
          updatedBy: CURRENT_ACTOR
        };

    set((state) => ({
      policies: target
        ? state.policies.map((policy) =>
            policy.id === nextPolicy.id ? nextPolicy : policy
          )
        : [nextPolicy, ...state.policies],
      policyHistories: appendPolicyHistory(
        state.policyHistories,
        nextPolicy,
        target ? 'updated' : 'created',
        target ? '정책 메타/본문 수정' : '새 정책 등록',
        now,
        CURRENT_ACTOR
      )
    }));

    return nextPolicy;
  },
  togglePolicyStatus: ({ policyId, nextStatus }) => {
    const target = get().policies.find((policy) => policy.id === policyId);

    if (!target) {
      return null;
    }

    const nextPolicy: OperationPolicy = {
      ...target,
      status: nextStatus,
      updatedAt: formatNow(),
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      policies: state.policies.map((policy) =>
        policy.id === policyId ? nextPolicy : policy
      ),
      policyHistories: appendPolicyHistory(
        state.policyHistories,
        nextPolicy,
        'status_changed',
        `상태를 ${nextStatus}로 변경`,
        nextPolicy.updatedAt,
        CURRENT_ACTOR
      )
    }));

    return nextPolicy;
  },
  publishPolicyHistoryVersion: ({ policyId, historyId, reason }) => {
    const target = get().policies.find((policy) => policy.id === policyId);
    const historyEntry = get().policyHistories.find(
      (entry) => entry.id === historyId && entry.policyId === policyId
    );

    if (!target || !historyEntry) {
      return null;
    }

    const now = formatNow();
    const snapshot = historyEntry.snapshot;
    const nextPolicy: OperationPolicy = {
      ...target,
      category: snapshot.category,
      policyType: snapshot.policyType,
      title: snapshot.title,
      versionLabel: snapshot.versionLabel,
      effectiveDate: snapshot.effectiveDate,
      exposureSurfaces: [...snapshot.exposureSurfaces],
      requiresConsent: snapshot.requiresConsent,
      trackingStatus: snapshot.trackingStatus,
      relatedAdminPages: [...snapshot.relatedAdminPages],
      relatedUserPages: [...snapshot.relatedUserPages],
      sourceDocuments: [...snapshot.sourceDocuments],
      summary: snapshot.summary,
      legalReferences: [...snapshot.legalReferences],
      bodyHtml: snapshot.bodyHtml,
      adminMemo: snapshot.adminMemo,
      status: '게시',
      updatedAt: now,
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      policies: state.policies.map((policy) =>
        policy.id === policyId ? nextPolicy : policy
      ),
      policyHistories: appendPolicyHistory(
        state.policyHistories,
        nextPolicy,
        'version_published',
        `이력 버전 게시: ${historyEntry.versionLabel} / ${normalizeHistoryNote(reason)}`,
        now,
        CURRENT_ACTOR
      )
    }));

    return nextPolicy;
  },
  deletePolicy: ({ policyId, reason }) => {
    const target = get().policies.find((policy) => policy.id === policyId);

    if (!target) {
      return null;
    }

    const deletedAt = formatNow();
    const deletedPolicy: OperationPolicy = {
      ...target,
      updatedAt: deletedAt,
      updatedBy: CURRENT_ACTOR
    };

    set((state) => ({
      policies: state.policies.filter((policy) => policy.id !== policyId),
      policyHistories: appendPolicyHistory(
        state.policyHistories,
        deletedPolicy,
        'deleted',
        `정책 삭제: ${normalizeHistoryNote(reason)}`,
        deletedAt,
        CURRENT_ACTOR
      )
    }));

    return deletedPolicy;
  }
}));
