import { create } from 'zustand';
import { api } from '../api/axios';

export const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: true,

  setAuth: (user, accessToken) => set({ user, accessToken }),
  setToken: (accessToken) => set({ accessToken }),

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    const { accessToken, user } = data.data;
    set({ user, accessToken });
    return user;
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    set({ user: null, accessToken: null });
  },

  refresh: async () => {
    try {
      const { data } = await api.post('/auth/refresh');
      set({ accessToken: data.data.accessToken });
      return data.data.accessToken;
    } catch {
      set({ user: null, accessToken: null });
      return null;
    }
  },

  init: async () => {
    try {
    const { data } = await api.post('/auth/refresh');
    const token = data.data.accessToken;
    if (token) {
      set({ accessToken: token });
      const payload = JSON.parse(atob(token.split('.')[1]));
      set({ user: { id: payload.userId, role: payload.role, email: payload.email }, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  } catch {
    set({ isLoading: false });
  }
  },
}));
