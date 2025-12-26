import api from './axios';

const unwrap = (promise) => promise.then((res) => res.data);

export const listCourses = () => unwrap(api.get('/cms/courses'));
export const createCourse = (payload) => unwrap(api.post('/cms/courses', payload));
export const updateCourse = (id, payload) => unwrap(api.patch(`/cms/courses/${id}`, payload));
export const publishCourse = (id) => unwrap(api.post(`/cms/courses/${id}/publish`));
export const unpublishCourse = (id) => unwrap(api.post(`/cms/courses/${id}/unpublish`));
export const assignInstructors = (id, payload) =>
  unwrap(api.post(`/cms/courses/${id}/instructors`, payload));

export const getModules = (courseId) => unwrap(api.get(`/cms/courses/${courseId}/modules`));
export const createModule = (courseId, payload) =>
  unwrap(api.post(`/cms/courses/${courseId}/modules`, payload));
export const updateModule = (moduleId, payload) =>
  unwrap(api.patch(`/cms/modules/${moduleId}`, payload));
export const publishModule = (moduleId) => unwrap(api.post(`/cms/modules/${moduleId}/publish`));
export const unpublishModule = (moduleId) => unwrap(api.post(`/cms/modules/${moduleId}/unpublish`));

export const getLessons = (moduleId) => unwrap(api.get(`/cms/modules/${moduleId}/lessons`));
export const createLesson = (moduleId, payload) =>
  unwrap(api.post(`/cms/modules/${moduleId}/lessons`, payload));
export const updateLesson = (lessonId, payload) =>
  unwrap(api.patch(`/cms/lessons/${lessonId}`, payload));
export const publishLesson = (lessonId) =>
  unwrap(api.post(`/cms/lessons/${lessonId}/publish`));
export const unpublishLesson = (lessonId) =>
  unwrap(api.post(`/cms/lessons/${lessonId}/unpublish`));

export default {
  listCourses,
  createCourse,
  updateCourse,
  publishCourse,
  unpublishCourse,
  assignInstructors,
  getModules,
  createModule,
  updateModule,
  publishModule,
  unpublishModule,
  getLessons,
  createLesson,
  updateLesson,
  publishLesson,
  unpublishLesson,
};
