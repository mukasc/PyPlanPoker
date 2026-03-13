import { Eye, RotateCcw, ListTodo, Hourglass } from 'lucide-react';
import { Button } from '../ui/button';
import { useState } from 'react';

const AdminControls = ({ 
  onReveal, 
  onReset,
  cardsRevealed, 
  hasActiveTask,
  allVoted,
  votedCount,
  totalVoters,
  onStartTimer,
  onStopTimer,
  timerEnd
}) => {
  return (
    <div className="flex items-center gap-3">
      {/* Timer Controls */}
      <Button
        variant="outline"
        size="sm"
        onClick={timerEnd ? onStopTimer : () => onStartTimer(120)}
        className={`${timerEnd ? 'border-rose-500/50 text-rose-400 bg-rose-500/10' : 'border-slate-700 text-slate-400'} h-9`}
      >
        <Hourglass className={`w-4 h-4 mr-2 ${timerEnd ? 'animate-spin' : ''}`} />
        {timerEnd ? 'Stop Timer' : 'Timer 2m'}
      </Button>
      {/* Vote Progress */}
      {hasActiveTask && !cardsRevealed && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex gap-0.5">
            {Array.from({ length: totalVoters }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i < votedCount ? 'bg-emerald-400' : 'bg-slate-600'
                }`}
              />
            ))}
          </div>
          <span className="text-sm text-slate-400 font-mono">
            {votedCount}/{totalVoters}
          </span>
        </div>
      )}

      {/* Reveal Button */}
      {hasActiveTask && !cardsRevealed && (
        <Button
          data-testid="reveal-cards-btn"
          onClick={onReveal}
          disabled={votedCount === 0}
          className={`${
            allVoted 
              ? 'bg-emerald-600 hover:bg-emerald-500 animate-pulse' 
              : 'bg-emerald-600/50 hover:bg-emerald-600'
          } text-white font-medium shadow-lg shadow-emerald-900/20 transition-all`}
        >
          <Eye className="w-4 h-4 mr-2" />
          Reveal Cards
        </Button>
      )}

      {/* Reset/Revote Button */}
      {hasActiveTask && cardsRevealed && (
        <Button
          data-testid="reset-votes-btn"
          onClick={onReset}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Clear & Revote
        </Button>
      )}
    </div>
  );
};

export default AdminControls;
