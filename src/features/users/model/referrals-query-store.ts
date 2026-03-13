import { create } from 'zustand';

import type { ReferralQuery } from './referrals-types';

export const defaultReferralQuery: ReferralQuery = {
  page: 1,
  pageSize: 20,
  sort: 'latest-use',
  searchField: 'all',
  status: 'all',
  anomalyStatus: 'all',
  startDate: '',
  endDate: '',
  keyword: ''
};

type ReferralsQueryStore = {
  query: ReferralQuery;
  replaceQuery: (query: ReferralQuery) => void;
  setQuery: (query: Partial<ReferralQuery>) => void;
};

export const useReferralsQueryStore = create<ReferralsQueryStore>((set) => ({
  query: defaultReferralQuery,
  replaceQuery: (query) => set({ query }),
  setQuery: (query) =>
    set((state) => ({
      query: { ...state.query, ...query }
    }))
}));
