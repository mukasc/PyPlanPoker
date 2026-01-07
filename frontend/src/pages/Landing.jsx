import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { Toaster, toast } from '../components/ui/sonner';
import { Users, Plus, LogIn, Eye, Sparkles } from 'lucide-react';
import useGameStore from '../store/gameStore';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Landing = () => {
  const navigate = useNavigate();
  const { setUser, setRoom } = useGameStore();
  
  const [mode, setMode] = useState('join'); // 'join' or 'create'
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSpectator, setIsSpectator] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!roomName.trim() || !displayName.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      // Create room
      const roomResponse = await axios.post(`${API}/rooms`, { name: roomName });
      const newRoom = roomResponse.data;

      // Join the room
      const joinResponse = await axios.post(`${API}/rooms/${newRoom.id}/join`, {
        room_id: newRoom.id,
        name: displayName,
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
      const joinResponse = await axios.post(`${API}/rooms/${roomId.toUpperCase()}/join`, {
        room_id: roomId.toUpperCase(),
        name: displayName,
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

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-8 relative z-10">
        <Button
          data-testid="mode-join-btn"
          variant={mode === 'join' ? 'default' : 'ghost'}
          onClick={() => setMode('join')}
          className={mode === 'join' 
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}
        >
          <LogIn className="w-4 h-4 mr-2" />
          Join Room
        </Button>
        <Button
          data-testid="mode-create-btn"
          variant={mode === 'create' ? 'default' : 'ghost'}
          onClick={() => setMode('create')}
          className={mode === 'create' 
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Room
        </Button>
      </div>

      {/* Form Card */}
      <Card className="w-full max-w-md bg-slate-900 border-slate-800 shadow-2xl shadow-black/50 relative z-10">
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
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Your Display Name</label>
              <Input
                data-testid="display-name-input"
                type="text"
                placeholder="Enter your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-600 focus:border-indigo-500 focus:ring-indigo-500"
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
      </Card>

      {/* Footer */}
      <p className="mt-8 text-slate-500 text-sm relative z-10">
        Fibonacci voting for agile estimation
      </p>
    </div>
  );
};

export default Landing;
