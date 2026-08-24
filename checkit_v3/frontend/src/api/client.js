import axios from 'axios';

const api = axios.create({ baseURL: 'http://192.168.100.72:4000/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('checkit_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('checkit_token');
      localStorage.removeItem('checkit_user');
      if (!location.pathname.includes('/login')) {
        location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
