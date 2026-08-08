import api from './axios';

const unwrap = (promise) => promise.then((res) => res.data);

export const createUser = (payload) => unwrap(api.post('/admin/users', payload));
export const listUsers = (params = {}) => unwrap(api.get('/admin/users', { params }));
export const resetUserPassword = (id) => unwrap(api.post(`/admin/users/${id}/reset-password`));
export const deactivateUser = (id) => unwrap(api.post(`/admin/users/${id}/deactivate`));
export const activateUser = (id) => unwrap(api.post(`/admin/users/${id}/activate`));
export const bulkInviteUsers = (formData) =>
  unwrap(
    api.post('/admin/users/bulk-invite', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  );

export const getAdminTheme = () => unwrap(api.get('/admin/theme'));
export const updateAdminTheme = (payload) => unwrap(api.patch('/admin/theme', payload));
export const listAdminImages = (params = {}) => unwrap(api.get('/admin/images', { params }));
export const replaceAdminImage = (assetId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return unwrap(api.post(`/admin/images/${assetId}/replace`, formData));
};
export const replaceLessonCoverImage = (lessonId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return unwrap(api.post(`/admin/images/lesson-cover/${lessonId}/replace`, formData));
};
export const replaceImageReference = ({ sourceType, entityId, oldUrl, file }) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('sourceType', sourceType);
  formData.append('entityId', entityId);
  formData.append('oldUrl', oldUrl);
  return unwrap(api.post('/admin/images/reference/replace', formData));
};
export const deleteAdminImage = (assetId) => unwrap(api.delete(`/admin/images/${assetId}`));
export const deleteLessonCoverImage = (lessonId) =>
  unwrap(api.delete(`/admin/images/lesson-cover/${lessonId}`));
export const deleteImageReference = ({ sourceType, entityId, oldUrl }) =>
  unwrap(api.delete('/admin/images/reference', {
    data: { sourceType, entityId, oldUrl },
  }));
export const getAdminImageDownloadUrl = (storagePath) =>
  unwrap(api.post('/admin/images/download-url', { storagePath }));

export const listCourseLevels = () => unwrap(api.get('/admin/course-levels'));
export const createCourseLevel = (payload) => unwrap(api.post('/admin/course-levels', payload));
export const updateCourseLevel = (id, payload) => unwrap(api.patch(`/admin/course-levels/${id}`, payload));
export const deleteCourseLevel = (id) => unwrap(api.delete(`/admin/course-levels/${id}`));

export const getCourseStaff = (courseId) => unwrap(api.get(`/admin/courses/${courseId}/staff`));
export const assignCourseStaff = (courseId, payload) =>
  unwrap(api.post(`/admin/courses/${courseId}/staff`, payload));
export const removeCourseStaffRole = (courseId, userId, roleName) =>
  unwrap(api.delete(`/admin/courses/${courseId}/staff/${userId}/role/${roleName}`));

export default {
  createUser,
  listUsers,
  resetUserPassword,
  deactivateUser,
  activateUser,
  bulkInviteUsers,
  getAdminTheme,
  updateAdminTheme,
  listAdminImages,
  replaceAdminImage,
  replaceLessonCoverImage,
  replaceImageReference,
  deleteAdminImage,
  deleteLessonCoverImage,
  deleteImageReference,
  getAdminImageDownloadUrl,
  getCourseStaff,
  assignCourseStaff,
  removeCourseStaffRole,
  listCourseLevels,
  createCourseLevel,
  updateCourseLevel,
  deleteCourseLevel,
};
