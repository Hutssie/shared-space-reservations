import { apiGet, apiPatch } from './client';

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  data: {
    bookingId?: string;
    spaceId?: string;
    spaceTitle?: string;
    threadId?: string;
    senderId?: string;
    destination?: 'host_space_bookings';
  } | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsResponse = {
  notifications: Notification[];
  nextCursor: string | null;
};

export function fetchNotifications(params?: { cursor?: string; limit?: number }): Promise<NotificationsResponse> {
  const search = new URLSearchParams();
  if (params?.cursor) search.set('cursor', params.cursor);
  if (params?.limit != null) search.set('limit', String(params.limit));
  const q = search.toString();
  return apiGet<NotificationsResponse>(`/api/notifications${q ? `?${q}` : ''}`);
}

export function fetchUnreadNotificationCount(): Promise<{ count: number }> {
  return apiGet<{ count: number }>('/api/notifications/unread-count');
}

export function markNotificationRead(id: string): Promise<{ id: string; readAt: string }> {
  return apiPatch<{ id: string; readAt: string }>(`/api/notifications/${id}/read`, {});
}

export function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>('/api/notifications/read-all', {});
}

export type NotificationPreferences = {
  bookingUpdatesEnabled: boolean;
  hostBookingUpdatesEnabled: boolean;
  messageAlertsEnabled: boolean;
  systemNotificationsEnabled: boolean;
};

export function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  return apiGet<NotificationPreferences>('/api/users/me/notification-preferences');
}

export function updateNotificationPreferences(
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  return apiPatch<NotificationPreferences>('/api/users/me/notification-preferences', prefs);
}
