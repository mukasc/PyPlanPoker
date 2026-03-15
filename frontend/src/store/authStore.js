import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAuthStore = create(
  persist(
    (set) => ({
      globalUser: null,
      
      setGlobalUser: (user) => set({ globalUser: user }),
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
