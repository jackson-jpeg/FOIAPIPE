import client from './client';

export interface Notification {
  id: string;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationListParams {
  page?: number;
  page_size?: number;
  is_read?: boolean;
}

export interface NotificationListResponse {
  items: Notification[];
  total: number;
  unread_count: number;
}

export async function getNotifications(params?: NotificationListParams) {
  const response = await client.get<NotificationListResponse>('/notifications', { params });
  return response.data;
}

export async function markRead(id: string) {
  const response = await client.post(`/notifications/${id}/read`);
  return response.data;
}

export async function markAllRead() {
  const response = await client.post('/notifications/mark-all-read');
  return response.data;
}
