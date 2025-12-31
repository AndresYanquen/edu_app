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

export const getLessonQuiz = (lessonId) => unwrap(api.get(`/cms/lessons/${lessonId}/quiz`));
export const createQuizQuestion = (lessonId, payload) =>
  unwrap(api.post(`/cms/lessons/${lessonId}/quiz/questions`, payload));
export const updateQuizQuestion = (questionId, payload) =>
  unwrap(api.patch(`/cms/quiz/questions/${questionId}`, payload));
export const deleteQuizQuestion = (questionId) =>
  unwrap(api.delete(`/cms/quiz/questions/${questionId}`));
export const createQuizOption = (questionId, payload) =>
  unwrap(api.post(`/cms/quiz/questions/${questionId}/options`, payload));
export const updateQuizOption = (optionId, payload) =>
  unwrap(api.patch(`/cms/quiz/options/${optionId}`, payload));
export const deleteQuizOption = (optionId) =>
  unwrap(api.delete(`/cms/quiz/options/${optionId}`));

export const getCourseGroups = (courseId) =>
  unwrap(api.get(`/cms/courses/${courseId}/groups`));
export const getAvailableStudents = (courseId) =>
  unwrap(api.get(`/cms/courses/${courseId}/students/available`));
export const getCourseEnrollments = (courseId, params = {}) =>
  unwrap(api.get(`/cms/courses/${courseId}/enrollments`, { params }));
export const enrollStudent = (courseId, payload) =>
  unwrap(api.post(`/cms/courses/${courseId}/enroll`, payload));
export const removeEnrollment = (courseId, studentId) =>
  unwrap(api.delete(`/cms/courses/${courseId}/enroll/${studentId}`));
export const updateEnrollmentGroup = (courseId, studentId, payload) =>
  unwrap(api.post(`/cms/courses/${courseId}/enroll/${studentId}/group`, payload));
export const bulkEnrollStudents = (courseId, payload) =>
  unwrap(api.post(`/cms/courses/${courseId}/enroll/bulk`, payload));

export const getGroupTeachers = (groupId) => unwrap(api.get(`/cms/groups/${groupId}/teachers`));
export const addGroupTeacher = (groupId, payload) =>
  unwrap(api.post(`/cms/groups/${groupId}/teachers`, payload));
export const removeGroupTeacher = (groupId, userId) =>
  unwrap(api.delete(`/cms/groups/${groupId}/teachers/${userId}`));

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
  getLessonQuiz,
  createQuizQuestion,
  updateQuizQuestion,
  deleteQuizQuestion,
  createQuizOption,
  updateQuizOption,
  deleteQuizOption,
  getCourseGroups,
  getAvailableStudents,
  getCourseEnrollments,
  enrollStudent,
  removeEnrollment,
  updateEnrollmentGroup,
  bulkEnrollStudents,
  getGroupTeachers,
  addGroupTeacher,
  removeGroupTeacher,
};
