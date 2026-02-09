import client from './client';

export async function getVideos(params: Record<string, any> = {}) {
  const { data } = await client.get('/videos', { params });
  return data;
}

export async function getVideo(id: string) {
  const { data } = await client.get(`/videos/${id}`);
  return data;
}

export async function createVideo(payload: Record<string, any>) {
  const { data } = await client.post('/videos', payload);
  return data;
}

export async function updateVideo(id: string, update: Record<string, any>) {
  const { data } = await client.patch(`/videos/${id}`, update);
  return data;
}

export async function uploadRaw(id: string, formData: FormData) {
  const { data } = await client.post(`/videos/${id}/upload-raw`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function generateThumbnail(id: string) {
  const { data } = await client.post(`/videos/${id}/generate-thumbnail`);
  return data;
}

export async function getPipelineCounts() {
  const { data } = await client.get('/videos/pipeline-counts');
  return data;
}
