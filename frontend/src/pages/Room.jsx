import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGameStore from '../store/gameStore';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';
import { Toaster, toast } from '../components/ui/sonner';

// Components
import Sidebar from '../components/game/Sidebar';
import PokerTable from '../components/game/PokerTable';
import CardHand from '../components/game/CardHand';
import AdminControls from '../components/game/AdminControls';
import TaskPanel from '../components/game/TaskPanel';

const FIBONACCI = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?'];

const Room = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { 
    user, 
    room, 
    roomState, 
    setRoomState, 
    selectedCard, 
    setSelectedCard,
    setIsConnected,
    leaveRoom,
    isConnected 
  } = useGameStore();

  const [showTaskPanel, setShowTaskPanel] = useState(false);

  // Redirect if no user session
  useEffect(() => {
    if (!user || !room) {
      navigate('/');
    }
  }, [user, room, navigate]);

  // Socket connection
  useEffect(() => {
    if (!user || !room) return;

    const socket = connectSocket();

    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      
      // Join the room
      socket.emit('join_room', {
        room_id: roomId,
        user_id: user.id,
      });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('state_update', (state) => {
      console.log('State update received:', state);
      setRoomState(state);
    });

    socket.on('reveal_votes', (state) => {
      console.log('Votes revealed:', state);
      setRoomState(state);
      toast.success('Cards revealed!');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      toast.error('Connection error. Retrying...');
    });

    return () => {
      disconnectSocket();
    };
  }, [user, room, roomId, setRoomState, setIsConnected]);

  const handleVote = useCallback((value) => {
    if (!user || user.is_spectator) return;
    if (roomState.room?.cards_revealed) return;
    if (!roomState.active_task) {
      toast.error('No active task to vote on');
      return;
    }

    setSelectedCard(value);
    
    const socket = getSocket();
    socket.emit('cast_vote', {
      user_id: user.id,
      task_id: roomState.active_task.id,
      value: value,
    });
  }, [user, roomState, setSelectedCard]);

  const handleRevealCards = useCallback(() => {
    if (!user?.is_admin) return;
    
    const socket = getSocket();
    socket.emit('reveal_cards', {
      room_id: roomId,
      user_id: user.id,
    });
  }, [user, roomId]);

  const handleResetVotes = useCallback(() => {
    if (!user?.is_admin) return;
    
    const socket = getSocket();
    socket.emit('reset_votes', {
      room_id: roomId,
      user_id: user.id,
      task_id: roomState.active_task?.id,
    });
    setSelectedCard(null);
    toast.info('Votes cleared - ready for revote');
  }, [user, roomId, roomState.active_task, setSelectedCard]);

  const handleSetActiveTask = useCallback((taskId) => {
    if (!user?.is_admin) return;
    
    const socket = getSocket();
    socket.emit('set_active_task', {
      room_id: roomId,
      task_id: taskId,
      user_id: user.id,
    });
    setSelectedCard(null);
  }, [user, roomId, setSelectedCard]);

  const handleCompleteTask = useCallback((taskId, score) => {
    if (!user?.is_admin) return;
    
    const socket = getSocket();
    socket.emit('complete_task', {
      room_id: roomId,
      user_id: user.id,
      task_id: taskId,
      final_score: score,
    });
    setSelectedCard(null);
    toast.success(`Task completed with ${score} points`);
  }, [user, roomId, setSelectedCard]);

  const handleAddTask = useCallback((title, description) => {
    const socket = getSocket();
    socket.emit('add_task', {
      room_id: roomId,
      title: title,
      description: description,
    });
    toast.success('Task added');
  }, [roomId]);

  const handleDeleteTask = useCallback((taskId) => {
    if (!user?.is_admin) return;
    
    const socket = getSocket();
    socket.emit('delete_task', {
      room_id: roomId,
      user_id: user.id,
      task_id: taskId,
    });
  }, [user, roomId]);

  const handleLeaveRoom = useCallback(() => {
    disconnectSocket();
    leaveRoom();
    navigate('/');
  }, [leaveRoom, navigate]);

  if (!user || !room) {
    return null;
  }

  const cardsRevealed = roomState.room?.cards_revealed || false;
  const activeTask = roomState.active_task;
  const voters = roomState.users.filter(u => !u.is_spectator);
  const votedCount = roomState.votes.length;
  const allVoted = voters.length > 0 && votedCount >= voters.length;

  return (
    <div className="h-screen bg-slate-950 overflow-hidden">
      <Toaster position="top-center" theme="dark" />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 h-full">
        {/* Sidebar */}
        <Sidebar
          roomId={roomId}
          roomName={roomState.room?.name || room.name}
          users={roomState.users}
          currentUserId={user.id}
          votes={roomState.votes}
          cardsRevealed={cardsRevealed}
          onLeave={handleLeaveRoom}
          isConnected={isConnected}
        />

        {/* Main Area */}
        <main className="col-span-1 lg:col-span-9 flex flex-col h-full overflow-hidden">
          {/* Header with Room Info & Admin Controls */}
          <header className="flex-shrink-0 p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-200 font-mono">
                  {activeTask ? activeTask.title : 'No Active Task'}
                </h2>
                {activeTask?.description && (
                  <p className="text-sm text-slate-400 mt-1 max-w-xl truncate">
                    {activeTask.description}
                  </p>
                )}
              </div>
              
              {user.is_admin && (
                <AdminControls
                  onReveal={handleRevealCards}
                  onReset={handleResetVotes}
                  onShowTasks={() => setShowTaskPanel(true)}
                  cardsRevealed={cardsRevealed}
                  hasActiveTask={!!activeTask}
                  allVoted={allVoted}
                  votedCount={votedCount}
                  totalVoters={voters.length}
                />
              )}
            </div>
          </header>

          {/* Poker Table */}
          <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
            <PokerTable
              users={roomState.users}
              votes={roomState.votes}
              cardsRevealed={cardsRevealed}
              currentUserId={user.id}
              activeTask={activeTask}
            />
          </div>

          {/* Card Hand (for non-spectators) */}
          {!user.is_spectator && (
            <div className="flex-shrink-0 border-t border-slate-800 bg-slate-900/80 backdrop-blur-sm">
              <CardHand
                cards={FIBONACCI}
                selectedCard={selectedCard}
                onSelect={handleVote}
                disabled={cardsRevealed || !activeTask}
              />
            </div>
          )}

          {/* Spectator Notice */}
          {user.is_spectator && (
            <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-900/80 text-center">
              <p className="text-slate-400 text-sm">
                You are observing this session. You cannot vote.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Task Panel Modal */}
      {showTaskPanel && (
        <TaskPanel
          tasks={roomState.tasks}
          activeTaskId={activeTask?.id}
          onSetActive={handleSetActiveTask}
          onComplete={handleCompleteTask}
          onAdd={handleAddTask}
          onDelete={handleDeleteTask}
          onClose={() => setShowTaskPanel(false)}
          isAdmin={user.is_admin}
          fibonacci={FIBONACCI}
        />
      )}
    </div>
  );
};

export default Room;
