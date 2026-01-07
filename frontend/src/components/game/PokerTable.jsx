import { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import PokerCard from './PokerCard';

const PokerTable = ({ users, votes, cardsRevealed, currentUserId, activeTask }) => {
  // Only show voters (not spectators) on the table
  const voters = useMemo(() => users.filter(u => !u.is_spectator), [users]);

  // Get vote for a user
  const getVote = (userId) => {
    const vote = votes.find(v => v.user_id === userId);
    return vote;
  };

  // Calculate positions around the table
  const getPosition = (index, total) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radiusX = 42; // % of container width
    const radiusY = 35; // % of container height
    
    return {
      left: `${50 + radiusX * Math.cos(angle)}%`,
      top: `${50 + radiusY * Math.sin(angle)}%`,
    };
  };

  // Calculate voting statistics when revealed
  const voteStats = useMemo(() => {
    if (!cardsRevealed || votes.length === 0) return null;
    
    const numericVotes = votes
      .filter(v => v.value !== '?' && v.value !== undefined)
      .map(v => parseFloat(v.value))
      .filter(v => !isNaN(v));
    
    if (numericVotes.length === 0) return null;
    
    const sum = numericVotes.reduce((a, b) => a + b, 0);
    const avg = sum / numericVotes.length;
    const sorted = [...numericVotes].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    
    // Find most common vote
    const counts = {};
    votes.forEach(v => {
      counts[v.value] = (counts[v.value] || 0) + 1;
    });
    const maxCount = Math.max(...Object.values(counts));
    const consensus = Object.entries(counts)
      .filter(([_, count]) => count === maxCount)
      .map(([value]) => value);
    
    return {
      average: avg.toFixed(1),
      min,
      max,
      spread: max - min,
      consensus: consensus.length === 1 ? consensus[0] : null,
      totalVotes: votes.length,
    };
  }, [votes, cardsRevealed]);

  if (!activeTask) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-400 gap-4">
        <AlertCircle className="w-16 h-16 text-slate-600" />
        <div className="text-center">
          <p className="text-lg font-medium text-slate-300">No Active Task</p>
          <p className="text-sm text-slate-500 mt-1">
            {voters.some(u => u.is_admin) 
              ? 'Select a task to start voting'
              : 'Waiting for admin to select a task'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-4xl aspect-[16/10]">
      {/* Table Background */}
      <div className="absolute inset-8 md:inset-12 bg-slate-900/80 rounded-[3rem] border-4 border-slate-700/50 shadow-2xl shadow-black/50">
        {/* Inner felt */}
        <div className="absolute inset-4 bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-[2rem] border border-slate-700/30" />
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {cardsRevealed && voteStats ? (
            <div className="text-center animate-in fade-in duration-500">
              {voteStats.consensus ? (
                <>
                  <div className="text-6xl md:text-7xl font-bold text-emerald-400 font-mono mb-2">
                    {voteStats.consensus}
                  </div>
                  <div className="text-slate-400 text-sm">Consensus!</div>
                </>
              ) : (
                <>
                  <div className="text-5xl md:text-6xl font-bold text-indigo-400 font-mono mb-2">
                    {voteStats.average}
                  </div>
                  <div className="text-slate-500 text-xs mb-4">Average</div>
                  <div className="flex gap-6 text-sm">
                    <div className="text-center">
                      <div className="text-slate-400 font-mono text-lg">{voteStats.min}</div>
                      <div className="text-slate-600 text-xs">Min</div>
                    </div>
                    <div className="text-center">
                      <div className="text-slate-400 font-mono text-lg">{voteStats.max}</div>
                      <div className="text-slate-600 text-xs">Max</div>
                    </div>
                    <div className="text-center">
                      <div className="text-amber-400 font-mono text-lg">{voteStats.spread}</div>
                      <div className="text-slate-600 text-xs">Spread</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-slate-500 text-sm">
                {votes.length === 0 ? 'Waiting for votes...' : `${votes.length}/${voters.length} voted`}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Player positions around the table */}
      {voters.map((user, index) => {
        const position = getPosition(index, voters.length);
        const vote = getVote(user.id);
        const hasVoted = !!vote;
        const isCurrentUser = user.id === currentUserId;

        return (
          <div
            key={user.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
            style={position}
          >
            {/* Card */}
            <PokerCard
              value={vote?.value}
              faceUp={cardsRevealed && hasVoted}
              hasVoted={hasVoted}
              isCurrentUser={isCurrentUser}
            />
            
            {/* Name badge */}
            <div className={`px-3 py-1 rounded-full text-xs font-medium truncate max-w-24 ${
              isCurrentUser 
                ? 'bg-indigo-600/80 text-white' 
                : 'bg-slate-800/90 text-slate-300'
            }`}>
              {user.name}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PokerTable;
