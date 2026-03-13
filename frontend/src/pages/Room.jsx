import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import useGameStore from '../store/gameStore';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { Toaster, toast } from '../components/ui/sonner';
import { Button } from '../components/ui/button';
import { ListTodo } from 'lucide-react';

import Sidebar from '../components/game/Sidebar';
import PokerTable from '../components/game/PokerTable';
import CardHand from '../components/game/CardHand';
import AdminControls from '../components/game/AdminControls';
import TaskPanel from '../components/game/TaskPanel';

const FIBONACCI = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?'];
const BASE_URL = import.meta.env.VITE_API_URL || '';
const API = `${BASE_URL}/api`;

const Room = () => {
  const params = useParams();
  const roomId = params.roomId ? params.roomId.toUpperCase() : '';
  const navigate = useNavigate();
  
  const { 
    user, room, roomState, setRoomState, 
    selectedCard, setSelectedCard, setIsConnected, leaveRoom, isConnected 
  } = useGameStore();

  const [showTaskPanel, setShowTaskPanel] = useState(false);
  
  // Ref para evitar loops na função de fetch
  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  // Redireciona se sem sessão
  useEffect(() => {
    if (!user || !room) navigate('/');
  }, [user, room, navigate]);

  // Ref para rastrear qual era a tarefa ativa anterior (para saber quando mudou)
  const prevActiveTaskId = useRef(null);

  // --- CORREÇÃO: Limpar Seleção Automática ---
  useEffect(() => {
    const currentActiveId = roomState.active_task?.id;
    const isRevealed = roomState.room?.cards_revealed;

    // Se mudou a tarefa ativa, limpa a seleção
    if (prevActiveTaskId.current !== currentActiveId) {
      setSelectedCard(null);
      prevActiveTaskId.current = currentActiveId;
    }

    // Se as cartas foram escondidas (reset), limpa a seleção
    // (A menos que eu ainda não tenha votado, mas aqui simplificamos limpando)
    if (!isRevealed && selectedCard && user && !roomState.votes.find(v => v.user_id === user.id)) {
       setSelectedCard(null);
    }
  }, [roomState, selectedCard, setSelectedCard, user?.id]);

  // Função centralizada para buscar estado
  const fetchState = useCallback(async () => {
    if (!roomIdRef.current) return;
    try {
      const response = await axios.get(`${API}/rooms/${roomIdRef.current}/state`);
      // Só atualiza se houver diferença real (opcional, aqui atualizamos direto)
      setRoomState(response.data);
    } catch (error) {
      console.error("Fetch error:", error);
    }
  }, [setRoomState]);

  // --- 1. BUSCA INICIAL DE SEGURANÇA ---
  useEffect(() => {
    fetchState(); // Busca imediata apenas na primeira montagem
  }, [fetchState]);

  // --- 2. CONEXÃO SOCKET (REAL-TIME OTIMIZADO) ---
  useEffect(() => {
    if (!user || !roomId) return;
    const socket = connectSocket();

    const joinRoom = () => {
      console.log(`🔌 Joining room ${roomId}`);
      socket.emit('join_room', { room_id: roomId, user_id: user.id });
    };

    socket.on('connect', () => { setIsConnected(true); joinRoom(); });
    socket.on('disconnect', () => setIsConnected(false));
    
    // Se o socket mandar update, atualizamos na hora (mais rápido que o polling)
    socket.on('state_update', (state) => {
      console.log('⚡ Socket Update');
      setRoomState(state);
    });
    
    socket.on('reveal_votes', (state) => {
      setRoomState(state);
      toast.success('Cards revealed!');
    });

    
    socket.on('kicked', (data) => {
      // Se eu sou o alvo do chute, eu me desconecto da sala
      if (data.target_user_id === user.id) {
        toast.error('Você foi removido pelo criador da sala.');
        handleLeaveRoom();
      }
    });

    if (socket.connected) { setIsConnected(true); joinRoom(); }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('state_update');
      socket.off('reveal_votes');
      socket.off('kicked');
    };
  }, [user, roomId, setRoomState, setIsConnected]);

  // --- ACTIONS (VIA HTTP) ---
  
  const handleAction = async (endpoint, payload, successMsg) => {
    try {
      await axios.post(`${API}/${endpoint}`, { ...payload, room_id: roomId, user_id: user.id });
      if (successMsg) toast.success(successMsg);
      fetchState(); // Força atualização imediata localmente
    } catch (error) {
      console.error(`Error in ${endpoint}:`, error);
      toast.error('Action failed');
    }
  };

  const handleAddTask = useCallback((title, description) => {
    handleAction('tasks', { title, description }, 'Task added');
  }, [roomId, user]);

  const handleVote = useCallback((value) => {
      if (!roomState.active_task) return;
      setSelectedCard(value);
      // CORREÇÃO: Convertemos para String() para satisfazer o Backend
      handleAction('vote', { 
        task_id: roomState.active_task.id, 
        value: String(value) 
      }, null);
    }, [roomState.active_task, roomId, user]);

  const handleRevealCards = useCallback(() => {
    handleAction('reveal', {}, null);
  }, [roomId, user]);

  const handleResetVotes = useCallback(() => {
    handleAction('reset', { task_id: roomState.active_task?.id }, 'Votes cleared');
    setSelectedCard(null);
  }, [roomId, user, roomState.active_task]);

  const handleSetActiveTask = useCallback((taskId) => {
    handleAction('active-task', { task_id: taskId }, null);
    setSelectedCard(null);
  }, [roomId, user]);

  const handleCompleteTask = useCallback((taskId, score) => {
    handleAction('complete', { task_id: taskId, final_score: score }, `Completed: ${score}`);
    setSelectedCard(null);
  }, [roomId, user]);

  const handleDeleteTask = useCallback((taskId) => {
    handleAction('delete-task', { task_id: taskId }, 'Task deleted');
  }, [roomId, user]);

  const handleLeaveRoom = useCallback(() => {
    disconnectSocket();
    leaveRoom();
    navigate('/');
  }, [leaveRoom, navigate]);

  const handleCancelTask = useCallback((taskId) => {
    handleAction('cancel-task', { task_id: taskId }, 'Task cancelled');
  }, [roomId, user]);

  const handleKickUser = useCallback((targetUserId) => {
    handleAction('kick', { target_user_id: targetUserId }, 'User removed');
  }, [roomId, user]);

  if (!user || !room) return null;

  const cardsRevealed = roomState.room?.cards_revealed || false;
  const activeTask = roomState.active_task;
  const voters = roomState.users.filter(u => !u.is_spectator);
  const votedCount = roomState.votes.length;
  const allVoted = voters.length > 0 && votedCount >= voters.length;

  return (
    <div className="h-screen bg-slate-950 overflow-hidden">
      <Toaster position="top-center" theme="dark" />
      <div className="grid grid-cols-1 lg:grid-cols-12 h-full">
        <Sidebar
          roomId={roomId}
          roomName={roomState.room?.name || room.name}
          users={roomState.users}
          currentUserId={user.id}
          votes={roomState.votes}
          cardsRevealed={cardsRevealed}
          onLeave={handleLeaveRoom}
          onKick={handleKickUser}
          isAdmin={user.is_admin}
          isConnected={isConnected}
        />
        <main className="col-span-1 lg:col-span-9 flex flex-col h-full overflow-hidden">
          <header className="flex-shrink-0 p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-200 font-mono flex items-center gap-2">
                    {activeTask ? activeTask.title : 'No Active Task'}
                  </h2>
                  {activeTask?.description && <p className="text-sm text-slate-400 mt-1 max-w-xl truncate">{activeTask.description}</p>}
                </div>
                
                {/* Task List Button (Visible to everyone) */}
                <Button
                  data-testid="show-tasks-btn"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTaskPanel(true)}
                  className="bg-slate-800/50 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 ml-2"
                >
                  <ListTodo className="w-4 h-4 mr-2 text-indigo-400" />
                  View Tasks
                </Button>
              </div>
              {user.is_admin && (
                <AdminControls
                  onReveal={handleRevealCards}
                  onReset={handleResetVotes}
                  cardsRevealed={cardsRevealed}
                  hasActiveTask={!!activeTask}
                  allVoted={allVoted}
                  votedCount={votedCount}
                  totalVoters={voters.length}
                />
              )}
            </div>
          </header>
          <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
            <PokerTable
              users={roomState.users}
              votes={roomState.votes}
              cardsRevealed={cardsRevealed}
              currentUserId={user.id}
              activeTask={activeTask}
            />
          </div>
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
          {user.is_spectator && <div className="flex-shrink-0 p-4 border-t border-slate-800 bg-slate-900/80 text-center"><p className="text-slate-400 text-sm">Spectator Mode</p></div>}
        </main>
      </div>
      {showTaskPanel && (
        <TaskPanel
          tasks={roomState.tasks}
          activeTaskId={activeTask?.id}
          onSetActive={handleSetActiveTask}
          onComplete={handleCompleteTask}
          onCancel={handleCancelTask} // <--- PASSE A NOVA PROP AQUI
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