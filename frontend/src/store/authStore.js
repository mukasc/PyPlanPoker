import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      globalUser: null,
      isBackendReady: false,
      
      setGlobalUser: (user) => set({ globalUser: user }),
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
