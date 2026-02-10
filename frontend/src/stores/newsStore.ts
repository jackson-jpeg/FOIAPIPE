import { create } from 'zustand';
import * as newsApi from '@/api/news';
import type { NewsArticle } from '@/types';

interface NewsFilters {
  source?: string;
  incident_type?: string;
  severity_min?: number;
  is_reviewed?: boolean;
  is_dismissed?: boolean;
  auto_foia_eligible?: boolean;
  search?: string;
  sort_by?: string;
  sort_dir?: string;
  page?: number;
  page_size?: number;
}

interface NewsStore {
  articles: NewsArticle[];
  loading: boolean;
  error: string | null;
  total: number;
  filters: NewsFilters;
  setFilters: (filters: Partial<NewsFilters>) => void;
  fetchArticles: (params?: NewsFilters) => Promise<void>;
}

export const useNewsStore = create<NewsStore>((set, get) => ({
  articles: [],
  loading: false,
  error: null,
  total: 0,
  filters: {},
  setFilters: (newFilters) => set((state) => ({ filters: { ...state.filters, ...newFilters } })),
  fetchArticles: async (params) => {
    set({ loading: true, error: null });
    try {
      const merged = { ...get().filters, ...params };
      const response = await newsApi.getArticles(merged);
      set({ articles: response.items ?? [], total: response.total ?? 0, loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch articles';
      set({ error: message, loading: false });
    }
  },
}));
