import { create } from 'zustand';
import * as videosApi from '@/api/videos';
import type { Video } from '@/types';

interface VideoStore {
  videos: Video[];
  loading: boolean;
  error: string | null;
  fetchVideos: (params?: Record<string, string | number | boolean>) => Promise<void>;
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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch videos';
      set({ error: message, loading: false });
    }
  },
}));
