import api from './axios';

const unwrap = (promise) => promise.then((res) => res.data);

export const listCourseGroups = (courseId) => unwrap(api.get(`/cms/courses/${courseId}/groups`));
export const createCourseGroup = (courseId, payload) =>
  unwrap(api.post(`/cms/courses/${courseId}/groups`, payload));
export const updateGroup = (groupId, payload) => unwrap(api.patch(`/cms/groups/${groupId}`, payload));
export const getGroupTeachers = (groupId) => unwrap(api.get(`/cms/groups/${groupId}/teachers`));
export const addGroupTeacher = (groupId, payload) =>
  unwrap(api.post(`/cms/groups/${groupId}/teachers`, payload));
export const removeGroupTeacher = (groupId, userId) =>
  unwrap(api.delete(`/cms/groups/${groupId}/teachers/${userId}`));

export default {
  listCourseGroups,
  createCourseGroup,
  updateGroup,
  getGroupTeachers,
  addGroupTeacher,
  removeGroupTeacher,
};
