import { create } from 'zustand';
import * as videosApi from '@/api/videos';

interface VideoStore {
  videos: any[];
  loading: boolean;
  error: string | null;
  fetchVideos: (params?: Record<string, any>) => Promise<void>;
}

export const useVideoStore = create<VideoStore>((set) => ({
  videos: [],
  loading: false,
  error: null,
  fetchVideos: async (params) => {
    set({ loading: true, error: null });
    try {
      const response = await videosApi.getVideos(params);
      set({ videos: response.items || response, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },
}));
