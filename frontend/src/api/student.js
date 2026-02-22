import api from './axios';

const unwrap = (promise) => promise.then((res) => res.data);

export const getCoursePosts = (courseId, params = {}) =>
  unwrap(api.get(`/courses/${courseId}/posts`, { params }));

export default {
  getCoursePosts,
};
