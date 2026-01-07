import { Copy, LogOut, Wifi, WifiOff, Crown, Eye, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from '../ui/sonner';

const Sidebar = ({ 
  roomId, 
  roomName, 
  users, 
  currentUserId, 
  votes, 
  cardsRevealed,
  onLeave,
  isConnected 
}) => {
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Room ID copied to clipboard!');
  };

  // Separate voters and spectators
  const voters = users.filter(u => !u.is_spectator);
  const spectators = users.filter(u => u.is_spectator);

  // Get vote status for a user
  const hasVoted = (userId) => {
    return votes.some(v => v.user_id === userId);
  };

  // Get vote value for a user (only when revealed)
  const getVoteValue = (userId) => {
    if (!cardsRevealed) return null;
    const vote = votes.find(v => v.user_id === userId);
    return vote?.value;
  };

  return (
    <aside className="col-span-1 lg:col-span-3 bg-slate-900 border-r border-slate-800 flex flex-col h-full overflow-hidden">
      {/* Room Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-slate-200 truncate font-mono">
            {roomName}
          </h2>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-rose-400" />
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <code className="text-sm text-indigo-400 bg-slate-950 px-3 py-1.5 rounded-md font-mono flex-1 text-center">
            {roomId}
          </code>
          <Button
            data-testid="copy-room-id-btn"
            variant="ghost"
            size="icon"
            onClick={copyRoomId}
            className="text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Users List */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Voters */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Players ({voters.length})
          </h3>
          <div className="space-y-2">
            {voters.map((user) => {
              const voted = hasVoted(user.id);
              const voteValue = getVoteValue(user.id);
              const isCurrentUser = user.id === currentUserId;
              
              return (
                <div
                  key={user.id}
                  data-testid={`user-${user.id}`}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    isCurrentUser 
                      ? 'bg-indigo-600/20 border border-indigo-500/30' 
                      : 'bg-slate-800/50 hover:bg-slate-800'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    isCurrentUser ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  
                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${
                        isCurrentUser ? 'text-slate-200' : 'text-slate-300'
                      }`}>
                        {user.name}
                        {isCurrentUser && <span className="text-slate-500 ml-1">(you)</span>}
                      </span>
                      {user.is_admin && (
                        <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  
                  {/* Vote Status */}
                  <div className="flex-shrink-0">
                    {cardsRevealed && voteValue !== null ? (
                      <span className="w-10 h-10 bg-slate-100 text-slate-900 rounded-lg flex items-center justify-center font-bold font-mono text-lg">
                        {voteValue}
                      </span>
                    ) : voted ? (
                      <span className="w-10 h-10 bg-emerald-600/20 text-emerald-400 rounded-lg flex items-center justify-center">
                        <Check className="w-5 h-5" />
                      </span>
                    ) : (
                      <span className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center">
                        <span className="w-2 h-2 bg-slate-600 rounded-full" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Spectators */}
        {spectators.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" />
              Observers ({spectators.length})
            </h3>
            <div className="space-y-2">
              {spectators.map((user) => {
                const isCurrentUser = user.id === currentUserId;
                
                return (
                  <div
                    key={user.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      isCurrentUser 
                        ? 'bg-slate-800/70 border border-slate-700' 
                        : 'bg-slate-800/30'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center text-xs font-medium text-slate-400">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-slate-400 truncate">
                      {user.name}
                      {isCurrentUser && <span className="text-slate-500 ml-1">(you)</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Leave Button */}
      <div className="p-4 border-t border-slate-800">
        <Button
          data-testid="leave-room-btn"
          variant="ghost"
          onClick={onLeave}
          className="w-full justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-900/20"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Leave Room
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
