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
import ThemeToggle from '../components/ThemeToggle';

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
      if (error.response?.status === 404) {
        toast.error('Room not found');
      } else {
        console.error('Error joining room:', error);
        toast.error('Failed to join room');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/90/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>
      
      <Toaster position="top-center" theme="dark" />
      
      {/* Logo and Title */}
      <div className="text-center mb-12 relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-foreground tracking-tight font-mono">
            PyPlanPoker
          </h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Real-time Planning Poker for Agile Teams
        </p>
      </div>

      {/* User Profile & Logout */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-4">
        <ThemeToggle />
        {globalUser && (
          <div className="flex items-center gap-3 px-3 py-1.5 bg-secondary/50 rounded-full border border-border/50 backdrop-blur-sm">
            {globalUser.picture ? (
               <img src={globalUser.picture} alt={globalUser.name} className="w-8 h-8 rounded-full shadow-md object-cover" />
            ) : (
               <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                 {globalUser.name?.charAt(0) || 'U'}
               </div>
            )}
            <span className="text-foreground text-sm font-medium mr-1 hidden sm:block">{globalUser.name}</span>
          </div>
        )}
        <Button variant="ghost" onClick={() => { logout(); navigate('/login'); }} className="text-muted-foreground hover:text-destructive bg-secondary/50 border border-border backdrop-blur-sm">
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
            ? 'bg-primary hover:bg-primary/90 text-white' 
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
        >
          <LogIn className="w-4 h-4 mr-2" />
          Join
        </Button>
        <Button
          data-testid="mode-create-btn"
          variant={mode === 'create' ? 'default' : 'ghost'}
          onClick={() => setMode('create')}
          className={`flex-1 ${mode === 'create' 
            ? 'bg-primary hover:bg-primary/90 text-white' 
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create
        </Button>
        <Button
          data-testid="mode-my-rooms-btn"
          variant={mode === 'my-rooms' ? 'default' : 'ghost'}
          onClick={() => setMode('my-rooms')}
          className={`flex-1 ${mode === 'my-rooms' 
            ? 'bg-primary hover:bg-primary/90 text-white' 
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'}`}
        >
          <List className="w-4 h-4 mr-2" />
          My Rooms
        </Button>
      </div>

      {/* Form Card */}
      <Card className="w-full max-w-md bg-card border-border shadow-2xl shadow-black/50 relative z-10 overflow-hidden">
        {mode === 'my-rooms' ? (
           <div className="flex flex-col h-[450px]">
             <CardHeader className="space-y-1 pb-4 border-b border-border shrink-0">
               <CardTitle className="text-xl text-card-foreground font-mono">My Rooms</CardTitle>
               <CardDescription className="text-muted-foreground">Rooms you have created before</CardDescription>
             </CardHeader>
             <CardContent className="p-0 overflow-y-auto overflow-x-hidden flex-1 custom-scrollbar">
                {isLoadingRooms ? (
                   <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                     <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
                     Loading your rooms...
                   </div>
                ) : userRooms.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-center px-6">
                     <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4 border border-border/50">
                       <Plus className="w-8 h-8 text-muted-foreground" />
                     </div>
                     <p>You haven't created any rooms yet.</p>
                     <Button variant="link" onClick={() => setMode('create')} className="text-primary mt-2">
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
                           className="flex flex-col p-4 hover:bg-secondary/50 cursor-pointer transition-colors group"
                         >
                           <div className="flex items-center justify-between mb-1">
                             <h3 className="text-foreground font-medium truncate pr-4">{room.name}</h3>
                             <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border group-hover:bg-primary/30 group-hover:text-primary group-hover:border-primary/30 transition-colors">
                               {room.id}
                             </span>
                           </div>
                           <div className="flex items-center justify-between mt-2">
                             <div className="flex items-center text-xs text-muted-foreground">
                               <Clock className="w-3 h-3 mr-1" />
                               {formattedDate}
                             </div>
                             <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors transform group-hover:translate-x-1" />
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
              <CardTitle className="text-2xl text-card-foreground font-mono">
                {mode === 'join' ? 'Join a Room' : 'Create a Room'}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {mode === 'join' 
                  ? 'Enter the room ID and your display name to join'
                  : 'Create a new room for your planning session'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={mode === 'join' ? handleJoinRoom : handleCreateRoom} className="space-y-6">
                {mode === 'join' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Room ID</label>
                    <Input
                      data-testid="room-id-input"
                      type="text"
                      placeholder="Enter room ID (e.g., ABC123)"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary uppercase"
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Room Name</label>
                      <Input
                        data-testid="room-name-input"
                        type="text"
                        placeholder="e.g., Sprint 42 Planning"
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Deck Type</label>
                      <Select value={deckType} onValueChange={setDeckType}>
                        <SelectTrigger className="bg-background border-border text-foreground focus:ring-primary">
                          <SelectValue placeholder="Select deck type" />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="FIBONACCI">Fibonacci (0, 1, 2, 3, 5, 8...)</SelectItem>
                          <SelectItem value="T_SHIRT">T-Shirt Size (XS, S, M, L...)</SelectItem>
                          <SelectItem value="SEQUENTIAL">Sequential (0, 1, 2, 3...)</SelectItem>
                          <SelectItem value="CUSTOM">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {deckType === 'CUSTOM' && (
                      <div className="space-y-2 animate-in slide-in-from-top-2">
                        <label className="text-sm font-medium text-card-foreground">Custom Deck Values</label>
                        <Input
                          type="text"
                          placeholder="e.g., 1, 10, 100, ?"
                          value={customDeck}
                          onChange={(e) => setCustomDeck(e.target.value)}
                          className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground">Comma-separated values</p>
                      </div>
                    )}
                  </>
                )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-card-foreground">Your Display Name</label>
                    <Input
                      data-testid="display-name-input"
                      type="text"
                      placeholder="Enter your name"
                      value={displayName}
                      readOnly
                      className="bg-card/50 border-border text-muted-foreground cursor-not-allowed focus:border-border focus:ring-0 select-none"
                    />
                  </div>

                <div className="flex items-center space-x-3 py-2 px-3 bg-background/50 rounded-lg border border-border">
                  <Checkbox
                    data-testid="spectator-checkbox"
                    id="spectator"
                    checked={isSpectator}
                    onCheckedChange={setIsSpectator}
                    className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <label
                      htmlFor="spectator"
                      className="text-sm text-card-foreground cursor-pointer select-none"
                      
                    >
                      Join as Observer
                    </label>
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto">Watch only, no voting</span>
                </div>

                <Button
                  data-testid="submit-btn"
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-medium shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
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
      <p className="mt-8 text-muted-foreground text-sm relative z-10">
        Flexible voting for agile estimation
      </p>
    </div>
  );
};

export default Landing;