import { create } from 'zustand';

let toastId = 0;

export const useUIStore = create((set, get) => ({
  theme: localStorage.getItem('theme') || 'light',
  toasts: [],

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  addToast: (message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    if (duration > 0) {
      setTimeout(() => get().removeToast(id), duration);
    }
    return id;
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

// Apply theme on load
const saved = localStorage.getItem('theme') || 'light';
document.documentElement.classList.toggle('dark', saved === 'dark');
