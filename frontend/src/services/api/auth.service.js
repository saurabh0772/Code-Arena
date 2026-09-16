import { apiClient } from './client.js';

export const authService = {
  async login(email, password) {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data; // { user, token }
  },

  async register(name, email, password) {
    const res = await apiClient.post('/auth/register', { name, email, password });
    return res.data; // { user }
  },

  async getMe() {
    const res = await apiClient.get('/users/me');
    return res.data.user || res.data;
  }
};
