import api from './axios';
import * as groupsApi from './groups';

const unwrap = (promise) => promise.then((res) => res.data);

export const listCourses = () => unwrap(api.get('/cms/courses'));
export const createCourse = (payload) => unwrap(api.post('/cms/courses', payload));
export const updateCourse = (id, payload) => unwrap(api.patch(`/cms/courses/${id}`, payload));
export const publishCourse = (id) => unwrap(api.post(`/cms/courses/${id}/publish`));
export const unpublishCourse = (id) => unwrap(api.post(`/cms/courses/${id}/unpublish`));
export const deleteCourse = (courseId) => unwrap(api.delete(`/cms/courses/${courseId}`));
export const assignInstructors = (id, payload) =>
  unwrap(api.post(`/cms/courses/${id}/instructors`, payload));
export const createAnnouncement = (payload) =>
  unwrap(api.post('/cms/announcements', payload));
export const updateAnnouncement = (id, payload) =>
  unwrap(api.patch(`/cms/announcements/${id}`, payload));
export const deleteAnnouncement = (id) =>
  unwrap(api.delete(`/cms/announcements/${id}`));
export const getCmsAnnouncements = (params = {}) =>
  unwrap(api.get('/cms/announcements', { params }));
export const getCoursePosts = (courseId, params = {}) =>
  unwrap(api.get(`/cms/courses/${courseId}/posts`, { params }));
export const createCoursePost = (courseId, payload) =>
  unwrap(api.post(`/cms/courses/${courseId}/posts`, payload));
export const updateCoursePost = (postId, payload) =>
  unwrap(api.put(`/cms/posts/${postId}`, payload));

export const getModules = (courseId) => unwrap(api.get(`/cms/courses/${courseId}/modules`));
export const createModule = (courseId, payload) =>
  unwrap(api.post(`/cms/courses/${courseId}/modules`, payload));
export const updateModule = (moduleId, payload) =>
  unwrap(api.patch(`/cms/modules/${moduleId}`, payload));
export const publishModule = (moduleId) => unwrap(api.post(`/cms/modules/${moduleId}/publish`));
export const unpublishModule = (moduleId) => unwrap(api.post(`/cms/modules/${moduleId}/unpublish`));
export const deleteModule = (moduleId) => unwrap(api.delete(`/cms/modules/${moduleId}`));

export const getLessons = (moduleId) => unwrap(api.get(`/cms/modules/${moduleId}/lessons`));
export const createLesson = (moduleId, payload) =>
  unwrap(api.post(`/cms/modules/${moduleId}/lessons`, payload));
export const updateLesson = (lessonId, payload) =>
  unwrap(api.patch(`/cms/lessons/${lessonId}`, payload));
export const publishLesson = (lessonId) =>
  unwrap(api.post(`/cms/lessons/${lessonId}/publish`));
export const unpublishLesson = (lessonId) =>
  unwrap(api.post(`/cms/lessons/${lessonId}/unpublish`));
export const deleteLesson = (lessonId) => unwrap(api.delete(`/cms/lessons/${lessonId}`));

export const getLessonQuiz = (lessonId) => unwrap(api.get(`/cms/lessons/${lessonId}/quiz`));
export const getQuizById = (quizId) => unwrap(api.get(`/cms/quizzes/${quizId}`));
export const createQuizQuestion = (lessonId, payload) =>
  unwrap(api.post(`/cms/lessons/${lessonId}/quiz/questions`, payload));
export const createQuizQuestionByQuiz = (quizId, payload) =>
  unwrap(api.post(`/cms/quizzes/${quizId}/questions`, payload));
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

// TODO: replace this client-side stub with backend endpoint wiring for quiz embeds.
export const createQuizEmbed = async (lessonId) => {
  if (!lessonId) throw new Error('lessonId is required');
  const quizId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `quiz_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  return { quizId };
};

export const listAssets = (params = {}) =>
  unwrap(api.get('/cms/assets', { params }));

export const registerAsset = (payload) => unwrap(api.post('/cms/assets/register', payload));

export const getCourseGroups = groupsApi.listCourseGroups;
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

export const getGroupTeachers = groupsApi.getGroupTeachers;
export const addGroupTeacher = groupsApi.addGroupTeacher;
export const removeGroupTeacher = groupsApi.removeGroupTeacher;
export const listCourseLevels = () => unwrap(api.get('/cms/course-levels'));

export default {
  listCourses,
  createCourse,
  updateCourse,
  publishCourse,
  unpublishCourse,
  assignInstructors,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getCmsAnnouncements,
  getCoursePosts,
  createCoursePost,
  updateCoursePost,
  getModules,
  createModule,
  updateModule,
  publishModule,
  unpublishModule,
  deleteModule,
  getLessons,
  createLesson,
  updateLesson,
  publishLesson,
  unpublishLesson,
  deleteLesson,
  getLessonQuiz,
  getQuizById,
  createQuizQuestion,
  createQuizQuestionByQuiz,
  updateQuizQuestion,
  deleteQuizQuestion,
  createQuizOption,
  updateQuizOption,
  deleteQuizOption,
  createQuizEmbed,
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
  listCourseLevels,
  listAssets,
  registerAsset,
};
