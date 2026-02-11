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

export async function uploadToYoutube(id: string): Promise<{ success: boolean; message: string; video_id: string }> {
  const { data } = await client.post(`/videos/${id}/upload-youtube`);
  return data;
}

export async function getPipelineCounts(): Promise<{ counts: Record<string, number> }> {
  const { data } = await client.get('/videos/pipeline-counts');
  return data;
}
