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
  getCourseStaff,
  assignCourseStaff,
  removeCourseStaffRole,
};
