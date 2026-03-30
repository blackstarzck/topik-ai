import { create } from 'zustand';

import {
  defaultCommercePointsQuery
} from './point-schema';
import type {
  CommercePointsQuery,
  PointExpirationQuery,
  PointLedgerQuery,
  PointPolicyQuery,
  PointsTab
} from './point-types';

type PointQueryStore = {
  query: CommercePointsQuery;
  replaceQuery: (query: CommercePointsQuery) => void;
  setTab: (tab: PointsTab) => void;
  setSelectedId: (selectedId: string) => void;
  setPolicyQuery: (query: Partial<PointPolicyQuery>) => void;
  setLedgerQuery: (query: Partial<PointLedgerQuery>) => void;
  setExpirationQuery: (query: Partial<PointExpirationQuery>) => void;
};

export const usePointQueryStore = create<PointQueryStore>((set) => ({
  query: defaultCommercePointsQuery,
  replaceQuery: (query) => set({ query }),
  setTab: (tab) =>
    set((state) => ({
      query: { ...state.query, tab }
    })),
  setSelectedId: (selectedId) =>
    set((state) => ({
      query: { ...state.query, selectedId }
    })),
  setPolicyQuery: (query) =>
    set((state) => ({
      query: {
        ...state.query,
        policy: { ...state.query.policy, ...query }
      }
    })),
  setLedgerQuery: (query) =>
    set((state) => ({
      query: {
        ...state.query,
        ledger: { ...state.query.ledger, ...query }
      }
    })),
  setExpirationQuery: (query) =>
    set((state) => ({
      query: {
        ...state.query,
        expiration: { ...state.query.expiration, ...query }
      }
    }))
}));
