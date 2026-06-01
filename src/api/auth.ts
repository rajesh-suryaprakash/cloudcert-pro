import { fetchApi } from './client';

export const loginApi = (email: string, password: string) =>
  fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });

export const registerApi = (email: string, password: string, name: string) =>
  fetchApi('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) });

export const getMeApi = () => fetchApi('/auth/me');

export const logoutApi = () => fetchApi('/auth/logout', { method: 'POST' });

export const forgotPasswordApi = (email: string) =>
  fetchApi('/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) });

export const resetPasswordApi = (email: string, code: string, password: string) =>
  fetchApi('/auth/reset', { method: 'POST', body: JSON.stringify({ email, code, password }) });
