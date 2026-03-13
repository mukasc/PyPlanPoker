import { useMemo, useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { cn } from '../../lib/utils';
import PokerCard from './PokerCard';
import useSound from '../../hooks/useSound';

const PokerTable = ({ users, votes, cardsRevealed, currentUserId, activeTask, timerEnd }) => {
  const { playSound, SOUNDS } = useSound();
  const [revealedUserIds, setRevealedUserIds] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(null);
  const [hasPlayedEndSound, setHasPlayedEndSound] = useState(false);
  
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
    
    // Absolute consensus: Everyone voted the same value
    const isAbsoluteConsensus = numericVotes.length === voters.length && 
                                consensus.length === 1 && 
                                maxCount === voters.length;

    return {
      average: avg.toFixed(1),
      min,
      max,
      spread: max - min,
      consensus: consensus.length === 1 ? consensus[0] : null,
      totalVotes: votes.length,
      isAbsoluteConsensus
    };
  }, [votes, cardsRevealed, voters.length]);

  // Trigger celebration
  useEffect(() => {
    if (cardsRevealed && voteStats?.isAbsoluteConsensus) {
      playSound(SOUNDS.SUCCESS);
      // Fire confetti from both sides
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        // since particles fall down, start a bit higher than random
        confetti({ 
          ...defaults, 
          particleCount, 
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#10b981', '#6366f1', '#ffffff']
        });
        confetti({ 
          ...defaults, 
          particleCount, 
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#10b981', '#6366f1', '#ffffff']
        });
      }, 250);
    }
  }, [cardsRevealed, voteStats?.isAbsoluteConsensus, playSound]);

  // Staggered reveal logic
  useEffect(() => {
    if (cardsRevealed) {
      // Find all users who voted
      const userIdsToReveal = voters
        .filter(u => votes.some(v => v.user_id === u.id))
        .map(u => u.id);

      let currentRevealIndex = 0;
      const revealDelay = 300; // ms between each card

      const interval = setInterval(() => {
        if (currentRevealIndex >= userIdsToReveal.length) {
          clearInterval(interval);
          return;
        }

        const nextId = userIdsToReveal[currentRevealIndex];
        setRevealedUserIds(prev => new Set([...prev, nextId]));
        currentRevealIndex++;
      }, revealDelay);

      return () => clearInterval(interval);
    } else {
      // Reset when cards are hidden
      setRevealedUserIds(new Set());
    }
  }, [cardsRevealed, voters, votes]);

  // Timer Ticker Logic
  useEffect(() => {
    if (!timerEnd) {
      setTimeLeft(null);
      setHasPlayedEndSound(false);
      return;
    }

    const targetDate = new Date(timerEnd).getTime();
    
    const updateTimer = () => {
      const now = Date.now();
      const difference = Math.max(0, Math.floor((targetDate - now) / 1000));
      setTimeLeft(difference);

      if (difference === 0 && !hasPlayedEndSound) {
        playSound(SOUNDS.TIMER_END);
        setHasPlayedEndSound(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [timerEnd, playSound, SOUNDS.TIMER_END, hasPlayedEndSound]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
      <div className={cn(
        "absolute inset-8 md:inset-12 bg-slate-900/80 rounded-[3rem] border-4 border-slate-700/50 shadow-2xl shadow-black/50 transition-all duration-1000",
        cardsRevealed && voteStats?.isAbsoluteConsensus && "consensus-glow"
      )}>
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
              {timeLeft !== null ? (
                <div className={`flex flex-col items-center justify-center animate-in zoom-in duration-300 ${timeLeft <= 10 ? 'text-rose-500 animate-pulse' : 'text-indigo-400'}`}>
                   <div className="text-6xl md:text-7xl font-bold font-mono">
                    {formatTime(timeLeft)}
                  </div>
                  <div className="text-xs uppercase tracking-widest opacity-60 mt-1">Discussion Time</div>
                  {timeLeft === 0 && <div className="text-xl font-bold mt-2 animate-bounce">TIME UP!</div>}
                </div>
              ) : (
                <div className="text-slate-500 text-sm">
                  {votes.length === 0 ? 'Waiting for votes...' : `${votes.length}/${voters.length} voted`}
                </div>
              )}
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
              faceUp={revealedUserIds.has(user.id)}
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
