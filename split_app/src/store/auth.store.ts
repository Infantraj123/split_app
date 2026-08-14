import { create } from 'zustand';
import { User } from '../types';
import { userService } from '../services/firestore.service';

interface AuthStore {
  currentUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  setCurrentUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  logout: () => void;
  initializeAuth: (firebaseUser: any) => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  currentUser: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  setCurrentUser: (user) => {
    set({
      currentUser: user,
      isAuthenticated: !!user,
      error: null,
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  logout: () => {
    set({
      currentUser: null,
      isAuthenticated: false,
      error: null,
    });
  },

  initializeAuth: async (firebaseUser) => {
    if (firebaseUser) {
      try {
        const user = await userService.getUser(firebaseUser.uid);
        if (user) {
          set({
            currentUser: user,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          set({
            isAuthenticated: false,
            isLoading: false,
            error: 'User not found in database',
          });
        }
      } catch (error) {
        set({
          isAuthenticated: false,
          isLoading: false,
          error: (error as Error).message,
        });
      }
    } else {
      set({
        currentUser: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));

interface UIStore {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (darkMode: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  darkMode: false,
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setDarkMode: (darkMode) => set({ darkMode }),
}));
