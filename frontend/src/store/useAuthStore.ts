import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole } from '../types';
import { api } from '../services/api';

interface AuthState {
  user: User | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: async (username, password) => {
        try {
          const res = await api.login({ username, password });
          if (res && res.user) {
            set({ user: { id: res.user.id, username: res.user.username, role: res.user.role as UserRole } });
            return true;
          }
          return false;
        } catch (error) {
          console.error("Login failed:", error);
          throw error;
        }
      },
      logout: () => set({ user: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
