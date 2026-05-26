import api from './axios';

const unwrap = (promise) => promise.then((res) => res.data);

export const getCurrentCustomerData = () => unwrap(api.get('/me/customer'));

export default {
  getCurrentCustomerData,
};
