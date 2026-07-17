import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

const useAuthStore = create(
  subscribeWithSelector(
    persist(
      (set) => ({
        // --- State ---
        globalUser: null,
        isBackendReady: false,
        
        // --- Actions ---
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
  )
);

export default useAuthStore;
