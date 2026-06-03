import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole } from '../types';

interface AuthState {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const MOCK_USERS: Record<string, { id: number; password: string; role: UserRole }> = {
  admin: { id: 1, password: 'admin2026', role: 'admin' },
  kasa: { id: 2, password: 'kasa2026', role: 'cashier' },
  buhgalter: { id: 3, password: 'buhgalter2026', role: 'financier' },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (username, password) => {
        const mockUser = MOCK_USERS[username];
        if (mockUser && mockUser.password === password) {
          set({ user: { id: mockUser.id, username, role: mockUser.role } });
          return true;
        }
        return false;
      },
      logout: () => set({ user: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
