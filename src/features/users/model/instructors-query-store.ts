import { create } from 'zustand';

import type { InstructorQuery } from './types';

export const defaultInstructorQuery: InstructorQuery = {
  page: 1,
  pageSize: 20,
  sort: 'recent-activity',
  status: 'all',
  activityStatus: 'all',
  country: 'all',
  organization: 'all',
  keyword: ''
};

type InstructorsQueryStore = {
  query: InstructorQuery;
  replaceQuery: (query: InstructorQuery) => void;
  setQuery: (query: Partial<InstructorQuery>) => void;
};

export const useInstructorsQueryStore = create<InstructorsQueryStore>((set) => ({
  query: defaultInstructorQuery,
  replaceQuery: (query) => set({ query }),
  setQuery: (query) =>
    set((state) => ({
      query: { ...state.query, ...query }
    }))
}));
