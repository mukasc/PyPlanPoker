import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useGameStore = create(
  persist(
    (set, get) => ({
      // User state
      user: null,
      room: null,
      
      // Room state from server
      roomState: {
        room: null,
        users: [],
        tasks: [],
        votes: [],
        active_task: null,
      },
      
      // Local UI state
      selectedCard: null,
      isConnected: false,
      
      // Actions
      setUser: (user) => set({ user }),
      setRoom: (room) => set({ room }),
      setRoomState: (roomState) => set({ roomState }),
      setSelectedCard: (card) => set({ selectedCard: card }),
      setIsConnected: (isConnected) => set({ isConnected }),
      
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
      
      // Getters
      isAdmin: () => get().user?.is_admin || false,
      isSpectator: () => get().user?.is_spectator || false,
      hasVoted: () => {
        const { user, roomState } = get();
        if (!user) return false;
        return roomState.votes.some(v => v.user_id === user.id);
      },
      getMyVote: () => {
        const { user, roomState } = get();
        if (!user) return null;
        const vote = roomState.votes.find(v => v.user_id === user.id);
        return vote?.value || null;
      },
    }),
    {
      name: 'pyplanpoker-storage',
      partialize: (state) => ({
        user: state.user,
        room: state.room,
      }),
    }
  )
);

export default useGameStore;
