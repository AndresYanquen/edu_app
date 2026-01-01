import api from './axios';

const unwrap = (promise) => promise.then((res) => res.data);

export const getClassTypes = () => unwrap(api.get('/class-types'));
export const getGroupTeachers = (groupId) =>
  unwrap(api.get(`/groups/${groupId}/teachers`));
export const listGroupSeries = (groupId) =>
  unwrap(api.get(`/groups/${groupId}/live-series`));
export const createSeries = (groupId, payload) =>
  unwrap(api.post(`/groups/${groupId}/live-series`, payload));
export const updateSeries = (seriesId, payload) =>
  unwrap(api.patch(`/live-series/${seriesId}`, payload));
export const publishSeries = (seriesId) =>
  unwrap(api.post(`/live-series/${seriesId}/publish`));
export const unpublishSeries = (seriesId) =>
  unwrap(api.post(`/live-series/${seriesId}/unpublish`));
export const generateSeries = (seriesId, payload = {}) =>
  unwrap(api.post(`/live-series/${seriesId}/generate`, payload));
export const listGroupSessions = (groupId, params = {}) =>
  unwrap(api.get(`/groups/${groupId}/live-sessions`, { params }));
export const listMyLiveSessions = (params = {}) =>
  unwrap(api.get('/me/live-sessions', { params }));
export const mySessions = (params = {}) => unwrap(api.get('/me/live-sessions', { params }));

export default {
  getClassTypes,
  getGroupTeachers,
  listGroupSeries,
  createSeries,
  updateSeries,
  publishSeries,
  unpublishSeries,
  generateSeries,
  listGroupSessions,
  listMyLiveSessions,
  mySessions,
};
