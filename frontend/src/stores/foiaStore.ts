import { create } from 'zustand';
import type { FoiaRequest, FoiaListParams } from '@/api/foia';
import { getFoiaRequests } from '@/api/foia';

interface FoiaState {
  requests: FoiaRequest[];
  selectedRequest: FoiaRequest | null;
  total: number;
  loading: boolean;
  error: string | null;
  filters: FoiaListParams;
  fetchRequests: (params?: FoiaListParams) => Promise<void>;
  setSelectedRequest: (request: FoiaRequest | null) => void;
  setFilters: (filters: Partial<FoiaListParams>) => void;
  clearError: () => void;
}

export const useFoiaStore = create<FoiaState>((set, get) => ({
  requests: [],
  selectedRequest: null,
  total: 0,
  loading: false,
  error: null,
  filters: { page: 1, page_size: 20 },

  fetchRequests: async (params) => {
    set({ loading: true, error: null });
    try {
      const mergedParams = { ...get().filters, ...params };
      const data = await getFoiaRequests(mergedParams);
      set({
        requests: data.items ?? [],
        total: data.total ?? 0,
        loading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch FOIA requests',
        loading: false,
      });
    }
  },

  setSelectedRequest: (request) => set({ selectedRequest: request }),

  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),

  clearError: () => set({ error: null }),
}));
