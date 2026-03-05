import { create } from 'zustand';

import type { UsersQuery } from './types';

export const defaultUsersQuery: UsersQuery = {
  page: 1,
  pageSize: 20,
  sort: 'latest',
  status: 'all',
  keyword: ''
};

type UsersQueryStore = {
  query: UsersQuery;
  replaceQuery: (query: UsersQuery) => void;
  setQuery: (query: Partial<UsersQuery>) => void;
};

export const useUsersQueryStore = create<UsersQueryStore>((set) => ({
  query: defaultUsersQuery,
  replaceQuery: (query) => set({ query }),
  setQuery: (query) =>
    set((state) => ({
      query: { ...state.query, ...query }
    }))
}));
