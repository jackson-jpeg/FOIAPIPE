import client from './client';
import type { VideoList, Video, VideoUpdate } from '@/types';

export async function getVideos(params: Record<string, any> = {}): Promise<VideoList> {
  const { data } = await client.get('/videos', { params });
  return data;
}

export async function getVideo(id: string): Promise<Video> {
  const { data } = await client.get(`/videos/${id}`);
  return data;
}

export async function createVideo(payload: { foia_request_id?: string; title?: string; description?: string }): Promise<Video> {
  const { data } = await client.post('/videos', payload);
  return data;
}

export async function updateVideo(id: string, update: VideoUpdate): Promise<Video> {
  const { data } = await client.patch(`/videos/${id}`, update);
  return data;
}

export async function uploadRaw(id: string, formData: FormData): Promise<{ message: string; storage_key: string }> {
  const { data } = await client.post(`/videos/${id}/upload-raw`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function generateThumbnail(id: string): Promise<{ thumbnail_url: string }> {
  const { data } = await client.post(`/videos/${id}/generate-thumbnail`);
  return data;
}

export async function trimVideo(id: string, start: number, end: number): Promise<{ success: boolean; storage_key: string }> {
  const { data } = await client.post(`/videos/${id}/trim`, null, { params: { start, end } });
  return data;
}

export async function addIntro(id: string, text: string, duration?: number): Promise<{ success: boolean; storage_key: string }> {
  const params: Record<string, any> = { text };
  if (duration) params.duration = duration;
  const { data } = await client.post(`/videos/${id}/add-intro`, null, { params });
  return data;
}

export async function optimizeForYoutube(id: string): Promise<{ success: boolean; storage_key: string }> {
  const { data } = await client.post(`/videos/${id}/optimize-youtube`);
  return data;
}

export async function generateYoutubeThumbnail(id: string, params?: { title_text?: string; agency_text?: string; timestamp?: number }): Promise<{ success: boolean; storage_key: string }> {
  const { data } = await client.post(`/videos/${id}/generate-youtube-thumbnail`, null, { params });
  return data;
}

export async function generateSubtitles(id: string, params?: { language?: string; subtitle_format?: string; provider?: string }): Promise<{ success: boolean; subtitle_id: string }> {
  const { data } = await client.post(`/videos/${id}/generate-subtitles`, null, { params });
  return data;
}

export async function listSubtitles(id: string): Promise<{ subtitles: any[] }> {
  const { data } = await client.get(`/videos/${id}/subtitles`);
  return data;
}

export async function deleteSubtitle(videoId: string, subtitleId: string): Promise<{ success: boolean }> {
  const { data } = await client.delete(`/videos/${videoId}/subtitles/${subtitleId}`);
  return data;
}

export async function uploadToYoutube(id: string): Promise<{ success: boolean; message: string; video_id: string }> {
  const { data } = await client.post(`/videos/${id}/upload-youtube`);
  return data;
}

export async function getPipelineCounts(): Promise<{ counts: Record<string, number> }> {
  const { data } = await client.get('/videos/pipeline-counts');
  return data;
}
