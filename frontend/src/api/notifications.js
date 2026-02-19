import api from './axios';

const unwrap = (promise) => promise.then((res) => res.data);

export const listAnnouncementNotifications = (params = {}) => {
  const page = Number.parseInt(params.page, 10) > 0 ? Number.parseInt(params.page, 10) : 1;
  const pageSizeRaw = Number.parseInt(params.pageSize, 10);
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 1), 100) : 20;
  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  const query = {
    limit,
    offset,
  };

  if (params.scope) query.scope = params.scope;
  if (params.courseId) query.courseId = params.courseId;
  if (params.groupId) query.groupId = params.groupId;
  if (params.unreadOnly !== undefined) query.unreadOnly = params.unreadOnly;

  return unwrap(api.get('/notifications/announcements', { params: query }));
};

export const getUnreadAnnouncementCount = () =>
  unwrap(api.get('/notifications/announcements/unread-count'));

export const markAnnouncementRead = (announcementId) =>
  unwrap(api.post(`/notifications/announcements/${announcementId}/read`));

export const markAllAnnouncementsRead = () =>
  unwrap(api.post('/notifications/announcements/read-all'));

// Backward-compatible aliases.
export const listAnnouncements = listAnnouncementNotifications;
export const getAnnouncementUnreadCount = getUnreadAnnouncementCount;

export default {
  listAnnouncementNotifications,
  getUnreadAnnouncementCount,
  listAnnouncements,
  getAnnouncementUnreadCount,
  markAnnouncementRead,
  markAllAnnouncementsRead,
};
