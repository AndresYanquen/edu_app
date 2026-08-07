import api from './axios';

const unwrap = (promise) => promise.then((res) => res.data);

export const getTheme = () => unwrap(api.get('/theme'));
