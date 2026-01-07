import { Eye, RotateCcw, ListTodo } from 'lucide-react';
import { Button } from '../ui/button';

const AdminControls = ({ 
  onReveal, 
  onReset, 
  onShowTasks,
  cardsRevealed, 
  hasActiveTask,
  allVoted,
  votedCount,
  totalVoters 
}) => {
  return (
    <div className="flex items-center gap-3">
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

      {/* Task List Button */}
      <Button
        data-testid="show-tasks-btn"
        variant="ghost"
        onClick={onShowTasks}
        className="text-slate-400 hover:text-slate-200 hover:bg-slate-800"
      >
        <ListTodo className="w-4 h-4 mr-2" />
        Tasks
      </Button>

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
