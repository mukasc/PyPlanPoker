import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import Cookies from 'js-cookie';

const useAuthStore = create(
  persist(
    (set) => ({
      globalUser: null,
      isBackendReady: false,
      theme: Cookies.get('theme') || 'classic',
      
      setTheme: (theme) => {
        Cookies.set('theme', theme, { expires: 365 });
        set({ theme });
      },
      setGlobalUser: (user) => {
        set({ globalUser: user });
        if (user && user.theme) {
          Cookies.set('theme', user.theme, { expires: 365 });
          set({ theme: user.theme });
        }
      },
      setBackendReady: (isReady) => set({ isBackendReady: isReady }),
      logout: () => {
        localStorage.removeItem('access_token');
        set({ globalUser: null });
      },
    }),
    {
      name: 'pyplanpoker-auth-storage',
    }
  )
);

export default useAuthStore;
