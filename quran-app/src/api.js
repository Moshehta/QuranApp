import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://quran-app-steel-six.vercel.app/api',
});

API.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('quran_token') || localStorage.getItem('quran_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;
