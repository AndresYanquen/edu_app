import api from './axios';
import { saveSessionAttendance } from './liveSessions';

const unwrap = (promise) => promise.then((res) => res.data);

export const getCourseWeekAttendance = (courseId, params = {}) =>
  unwrap(api.get(`/courses/${courseId}/attendance`, { params }));

export const saveCourseWeekAttendance = (courseId, payload = {}) =>
  unwrap(api.put(`/courses/${courseId}/attendance/week`, payload));

export const saveAttendanceCellFallback = async ({ sessionId, userId, status, note }) => {
  if (!sessionId || !userId) {
    throw new Error('sessionId and userId are required');
  }
  return saveSessionAttendance(sessionId, {
    items: [{ userId, status, note: note || null }],
  });
};

export default {
  getCourseWeekAttendance,
  saveCourseWeekAttendance,
  saveAttendanceCellFallback,
};
