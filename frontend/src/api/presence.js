import api from './axios';

export const pingPresence = (source = 'web') =>
  api.post('/presence/ping', { source }).then((res) => res.data);

export default {
  pingPresence,
};
