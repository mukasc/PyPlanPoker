import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// import axios from 'axios'; <--- REMOVIDO
import api from '../services/api'; // <--- ADICIONADO: O nosso serviço inteligente
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Toaster, toast } from '../components/ui/sonner';
import { Users, Plus, LogIn, Eye, Sparkles, LogOut, List, Clock, ArrowRight } from 'lucide-react';
import useGameStore from '../store/gameStore';
import useAuthStore from '../store/authStore';

const Landing = () => {
  const navigate = useNavigate();
  const { setUser, setRoom } = useGameStore();
  const { globalUser, logout } = useAuthStore();
  
  const [mode, setMode] = useState('join'); // 'join', 'create', or 'my-rooms'
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [displayName, setDisplayName] = useState(globalUser?.name || '');
  const [isSpectator, setIsSpectator] = useState(false);
  const [deckType, setDeckType] = useState('FIBONACCI');
  const [customDeck, setCustomDeck] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userRooms, setUserRooms] = useState([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  useEffect(() => {
    if (mode === 'my-rooms' && globalUser?.id) {
      const fetchRooms = async () => {
        setIsLoadingRooms(true);
        try {
          const res = await api.get(`/api/my-rooms/${globalUser.id}`);
          setUserRooms(res.data);
        } catch (error) {
          console.error(error);
          toast.error('Failed to fetch rooms');
        } finally {
          setIsLoadingRooms(false);
        }
      };
      fetchRooms();
    }
  }, [mode, globalUser]);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim() || !displayName.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      // Create room
      const roomResponse = await api.post('/api/rooms', { 
        name: roomName,
        owner_id: globalUser?.id,
        deck_type: deckType,
        custom_deck: deckType === 'CUSTOM' ? customDeck : ''
      });
      const newRoom = roomResponse.data;

      // Join the room
      const joinResponse = await api.post(`/api/rooms/${newRoom.id}/join`, {
        room_id: newRoom.id,
        name: displayName,
        user_id: globalUser?.id,
        picture: globalUser?.picture,
        is_spectator: isSpectator,
      });

      setUser(joinResponse.data.user);
      setRoom(joinResponse.data.room);
      
      toast.success('Room created successfully!');
      navigate(`/room/${newRoom.id}`);
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!roomId.trim() || !displayName.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      // Join the room
      console.log('🚀 Joining Room Payload:', {
        room_id: roomId.toUpperCase(),
        name: displayName,
        user_id: globalUser?.id,
        globalUser
      });
      const joinResponse = await api.post(`/api/rooms/${roomId.toUpperCase()}/join`, {
        room_id: roomId.toUpperCase(),
        name: displayName,
        user_id: globalUser?.id,
        picture: globalUser?.picture,
        is_spectator: isSpectator,
      });

      setUser(joinResponse.data.user);
      setRoom(joinResponse.data.room);
      
      toast.success('Joined room successfully!');
      navigate(`/room/${roomId.toUpperCase()}`);
    } catch (error) {
      console.error('Error joining room:', error);
      if (error.response?.status === 404) {
        toast.error('Room not found');
      } else {
        toast.error('Failed to join room');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>
      
      <Toaster position="top-center" theme="dark" />
      
      {/* Logo and Title */}
      <div className="text-center mb-12 relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-slate-200 tracking-tight font-mono">
            PyPlanPoker
          </h1>
        </div>
        <p className="text-slate-400 text-lg">
          Real-time Planning Poker for Agile Teams
        </p>
      </div>

      {/* User Profile & Logout */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-4">
        {globalUser && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-800/50 rounded-full border border-slate-700/50 backdrop-blur-sm">
            {globalUser.picture ? (
               <img src={globalUser.picture} alt={globalUser.name} className="w-8 h-8 rounded-full shadow-md object-cover" />
            ) : (
               <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                 {globalUser.name?.charAt(0) || 'U'}
               </div>
            )}
            <span className="text-slate-200 text-sm font-medium mr-1 hidden sm:block">{globalUser.name}</span>
          </div>
        )}
        <Button variant="ghost" onClick={() => { logout(); navigate('/login'); }} className="text-slate-400 hover:text-rose-400 bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* Mode Toggle */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-8 relative z-10 w-full max-w-md">
        <Button
          data-testid="mode-join-btn"
          variant={mode === 'join' ? 'default' : 'ghost'}
          onClick={() => setMode('join')}
          className={`flex-1 ${mode === 'join' 
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
        >
          <LogIn className="w-4 h-4 mr-2" />
          Join
        </Button>
        <Button
          data-testid="mode-create-btn"
          variant={mode === 'create' ? 'default' : 'ghost'}
          onClick={() => setMode('create')}
          className={`flex-1 ${mode === 'create' 
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create
        </Button>
        <Button
          data-testid="mode-my-rooms-btn"
          variant={mode === 'my-rooms' ? 'default' : 'ghost'}
          onClick={() => setMode('my-rooms')}
          className={`flex-1 ${mode === 'my-rooms' 
            ? 'bg-indigo-600 hover:bg-indigo-500 text-white' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
        >
          <List className="w-4 h-4 mr-2" />
          My Rooms
        </Button>
      </div>

      {/* Form Card */}
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl shadow-black/50 relative z-10 overflow-hidden">
        {mode === 'my-rooms' ? (
           <div className="flex flex-col h-[450px]">
             <CardHeader className="space-y-1 pb-4 border-b border-slate-800 shrink-0">
               <CardTitle className="text-xl text-slate-200 font-mono">My Rooms</CardTitle>
               <CardDescription className="text-slate-400">Rooms you have created before</CardDescription>
             </CardHeader>
             <CardContent className="p-0 overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar">
                {isLoadingRooms ? (
                   <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                     <span className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
                     Loading your rooms...
                   </div>
                ) : userRooms.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-center px-6">
                     <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 border border-slate-700/50">
                       <Plus className="w-8 h-8 text-slate-600" />
                     </div>
                     <p>You haven't created any rooms yet.</p>
                     <Button variant="link" onClick={() => setMode('create')} className="text-indigo-400 mt-2">
                       Create your first room
                     </Button>
                   </div>
                ) : (
                   <div className="divide-y divide-slate-800/50">
                     {userRooms.map(room => {
                       const date = new Date(room.created_at);
                       const formattedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
                       return (
                         <div 
                           key={room.id} 
                           onClick={async () => {
                             // Pre-fill and automatically trigger join
                             setRoomId(room.id);
                             setIsLoading(true);
                             try {
                               const joinResponse = await api.post(`/api/rooms/${room.id}/join`, {
                                 room_id: room.id,
                                 name: displayName,
                                 user_id: globalUser?.id,
                                 picture: globalUser?.picture,
                                 is_spectator: isSpectator,
                               });
                               setUser(joinResponse.data.user);
                               setRoom(joinResponse.data.room);
                               toast.success('Joined room!');
                               navigate(`/room/${room.id}`);
                             } catch (error) {
                               console.error(error);
                               toast.error('Failed to join room');
                             } finally {
                               setIsLoading(false);
                             }
                           }}
                           className="flex flex-col p-4 hover:bg-slate-800/50 cursor-pointer transition-colors group"
                         >
                           <div className="flex items-center justify-between mb-1">
                             <h3 className="text-slate-200 font-medium truncate pr-4">{room.name}</h3>
                             <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 group-hover:bg-indigo-900/30 group-hover:text-indigo-300 group-hover:border-indigo-500/30 transition-colors">
                               {room.id}
                             </span>
                           </div>
                           <div className="flex items-center justify-between mt-2">
                             <div className="flex items-center text-xs text-slate-500">
                               <Clock className="w-3 h-3 mr-1" />
                               {formattedDate}
                             </div>
                             <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-emerald-400 transition-colors transform group-hover:translate-x-1" />
                           </div>
                         </div>
                       );
                     })}
                   </div>
                )}
             </CardContent>
           </div>
        ) : (
          <>
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl text-slate-200 font-mono">
                {mode === 'join' ? 'Join a Room' : 'Create a Room'}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {mode === 'join' 
                  ? 'Enter the room ID and your display name to join'
                  : 'Create a new room for your planning session'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={mode === 'join' ? handleJoinRoom : handleCreateRoom} className="space-y-6">
                {mode === 'join' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Room ID</label>
                    <Input
                      data-testid="room-id-input"
                      type="text"
                      placeholder="Enter room ID (e.g., ABC123)"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                      className="bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500 uppercase"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Room Name</label>
                      <Input
                        data-testid="room-name-input"
                        type="text"
                        placeholder="e.g., Sprint 42 Planning"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        className="bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Deck Type</label>
                      <Select value={deckType} onValueChange={setDeckType}>
                        <SelectTrigger className="bg-slate-950 border-slate-800 text-slate-200 focus:ring-indigo-500">
                          <SelectValue placeholder="Select deck type" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="FIBONACCI">Fibonacci (0, 1, 2, 3, 5, 8...)</SelectItem>
                          <SelectItem value="T_SHIRT">T-Shirt Size (XS, S, M, L...)</SelectItem>
                          <SelectItem value="SEQUENTIAL">Sequential (0, 1, 2, 3...)</SelectItem>
                          <SelectItem value="CUSTOM">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {deckType === 'CUSTOM' && (
                      <div className="space-y-2 animate-in slide-in-from-top-2">
                        <label className="text-sm font-medium text-slate-300">Custom Deck Values</label>
                        <Input
                          type="text"
                          placeholder="e.g., 1, 10, 100, ?"
                          value={customDeck}
                          onChange={(e) => setCustomDeck(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500"
                        />
                        <p className="text-xs text-slate-500">Comma-separated values</p>
                      </div>
                    )}
                  </>
                )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Your Display Name</label>
                    <Input
                      data-testid="display-name-input"
                      type="text"
                      placeholder="Enter your name"
                      value={displayName}
                      readOnly
                      className="bg-slate-900/50 border-slate-800 text-slate-400 cursor-not-allowed focus:border-slate-800 focus:ring-0 select-none"
                    />
                  </div>

                <div className="flex items-center space-x-3 py-2 px-3 bg-slate-950/50 rounded-lg border border-slate-800">
                  <Checkbox
                    data-testid="spectator-checkbox"
                    id="spectator"
                    checked={isSpectator}
                    onCheckedChange={setIsSpectator}
                    className="border-slate-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                  />
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-400" />
                    <label
                      htmlFor="spectator"
                      className="text-sm text-slate-300 cursor-pointer select-none"
                      
                    >
                      Join as Observer
                    </label>
                  </div>
                  <span className="text-xs text-slate-500 ml-auto">Watch only, no voting</span>
                </div>

                <Button
                  data-testid="submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {mode === 'join' ? 'Joining...' : 'Creating...'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {mode === 'join' ? <Users className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      {mode === 'join' ? 'Join Room' : 'Create Room'}
                    </span>
                  )}
                </Button>
              </form>
            </CardContent>
          </>
        )}
      </Card>

      {/* Footer */}
      <p className="mt-8 text-slate-500 text-sm relative z-10">
        Flexible voting for agile estimation
      </p>
    </div>
  );
};

export default Landing;