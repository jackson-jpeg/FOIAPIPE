import { create } from 'zustand';
import type { SystemSettings } from '@/api/settings';
import { getSettings, updateSettings as apiUpdateSettings } from '@/api/settings';

interface SettingsState {
  settings: Record<string, unknown>;
  loading: boolean;
  saving: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  updateSettings: (updates: Partial<SystemSettings>) => Promise<void>;
  clearError: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: {},
  loading: false,
  saving: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const data = await getSettings();
      set({ settings: data as Record<string, unknown>, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch settings',
        loading: false,
      });
    }
  },

  updateSettings: async (updates) => {
    set({ saving: true, error: null });
    try {
      const updated = await apiUpdateSettings(updates);
      set({ settings: updated as Record<string, unknown>, saving: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to save settings',
        saving: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
