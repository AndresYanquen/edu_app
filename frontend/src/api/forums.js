import api from './axios';

const unwrap = (promise) => promise.then((res) => res.data);

export const listForums = (params = {}) => unwrap(api.get('/forums', { params }));
export const createForum = (payload) => unwrap(api.post('/forums', payload));
export const updateForum = (forumId, payload) => unwrap(api.patch(`/forums/${forumId}`, payload));

export const listForumThreads = (forumId) => unwrap(api.get(`/forums/${forumId}/threads`));
export const createForumThread = (forumId, payload) =>
  unwrap(api.post(`/forums/${forumId}/threads`, payload));
export const updateThread = (threadId, payload) => unwrap(api.patch(`/threads/${threadId}`, payload));
export const deleteThread = (threadId) => unwrap(api.delete(`/threads/${threadId}`));
export const setThreadReaction = (threadId, payload) =>
  unwrap(api.put(`/threads/${threadId}/reaction`, payload));
export const clearThreadReaction = (threadId) => unwrap(api.delete(`/threads/${threadId}/reaction`));

export const listThreadPosts = (threadId) => unwrap(api.get(`/threads/${threadId}/posts`));
export const createThreadPost = (threadId, payload) =>
  unwrap(api.post(`/threads/${threadId}/posts`, payload));
export const updatePost = (postId, payload) => unwrap(api.patch(`/posts/${postId}`, payload));
export const deletePost = (postId) => unwrap(api.delete(`/posts/${postId}`));
export const markThreadRead = (threadId) => unwrap(api.post(`/threads/${threadId}/read`));

export default {
  listForums,
  createForum,
  updateForum,
  listForumThreads,
  createForumThread,
  updateThread,
  deleteThread,
  setThreadReaction,
  clearThreadReaction,
  listThreadPosts,
  createThreadPost,
  updatePost,
  deletePost,
  markThreadRead,
};
