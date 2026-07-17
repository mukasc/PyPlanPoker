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
        logout: async () => {
          localStorage.removeItem('access_token'); // clean up legacy
          try {
            const api = (await import('../services/api')).default;
            await api.post('/api/auth/logout');
          } catch(e) {}
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
