import { create } from 'zustand';
import { login as apiLogin, logout as apiLogout } from '@/api/auth';

interface AuthState {
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('foiapipe_token'),
  isAuthenticated: !!localStorage.getItem('foiapipe_token'),
  isLoading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const token = await apiLogin(username, password);
      set({ token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  logout: () => {
    apiLogout();
    set({ token: null, isAuthenticated: false, error: null });
  },

  clearError: () => set({ error: null }),
}));
