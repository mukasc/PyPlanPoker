import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';

const useGameStore = create(
  subscribeWithSelector(
    persist(
      (set) => ({
        // --- State ---
        user: null,
        room: null,
        roomState: {
          room: null,
          users: [],
          tasks: [],
          votes: [],
          active_task: null,
        },
        selectedCard: null,
        isConnected: false,
        isMuted: false,
        
        // --- Actions ---
        setUser: (user) => set({ user }),
        setRoom: (room) => set({ room }),
        setRoomState: (roomState) => set({ roomState }),
        setSelectedCard: (card) => set({ selectedCard: card }),
        setIsConnected: (isConnected) => set({ isConnected }),
        toggleMuted: () => set((state) => ({ isMuted: !state.isMuted })),
        
        // Reset on disconnect
        resetGame: () => set({
          roomState: {
            room: null,
            users: [],
            tasks: [],
            votes: [],
            active_task: null,
          },
          selectedCard: null,
          isConnected: false,
        }),
        
        // Full reset (leave room)
        leaveRoom: () => set({
          user: null,
          room: null,
          roomState: {
            room: null,
            users: [],
            tasks: [],
            votes: [],
            active_task: null,
          },
          selectedCard: null,
          isConnected: false,
        }),
      }),
      {
        name: 'pyplanpoker-storage',
        partialize: (state) => ({
          user: state.user,
          room: state.room,
          isMuted: state.isMuted,
        }),
      }
    )
  )
);

export default useGameStore;
