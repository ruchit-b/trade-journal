import axios, { AxiosError } from 'axios';
import { getToken } from './auth';
import { config } from './config';

const baseURL = config.apiUrl || (typeof window !== 'undefined' ? '' : 'http://localhost:4000');

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Bearer token from localStorage when present
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401 (except login/register): clear auth and redirect to /login
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && error.config?.url) {
      const url = typeof error.config.url === 'string' ? error.config.url : '';
      const path = url.startsWith('http') ? url.replace(baseURL, '') : url;
      const isAuthRequest =
        path.includes('/api/auth/login') ||
        path.includes('/api/auth/register') ||
        path.includes('/api/auth/account');
      if (!isAuthRequest) {
        localStorage.removeItem('tradeedge_token');
        localStorage.removeItem('tradeedge_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const get = <T = unknown>(url: string, config?: Parameters<typeof api.get>[1]) =>
  api.get<T>(url, config).then((res) => res.data);

export const post = <T = unknown>(url: string, data?: unknown, config?: Parameters<typeof api.post>[2]) =>
  api.post<T>(url, data, config).then((res) => res.data);

export const put = <T = unknown>(url: string, data?: unknown, config?: Parameters<typeof api.put>[2]) =>
  api.put<T>(url, data, config).then((res) => res.data);

export const patch = <T = unknown>(url: string, data?: unknown, config?: Parameters<typeof api.patch>[2]) =>
  api.patch<T>(url, data, config).then((res) => res.data);

export const del = <T = unknown>(url: string, config?: Parameters<typeof api.delete>[1]) =>
  api.delete<T>(url, config).then((res) => res.data);
