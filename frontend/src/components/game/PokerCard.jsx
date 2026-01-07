import { cn } from '../../lib/utils';

const PokerCard = ({ value, faceUp, hasVoted, isCurrentUser }) => {
  return (
    <div
      className={cn(
        "w-12 h-18 md:w-16 md:h-24 rounded-lg shadow-xl transition-all duration-500 transform-gpu",
        "flex items-center justify-center",
        faceUp 
          ? "bg-slate-100 border-2 border-slate-300 rotate-0" 
          : hasVoted
            ? "bg-gradient-to-br from-indigo-600 to-violet-700 border-2 border-indigo-400/30"
            : "bg-slate-800 border-2 border-slate-700",
        isCurrentUser && hasVoted && !faceUp && "ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-slate-950"
      )}
      style={{
        perspective: '1000px',
        transformStyle: 'preserve-3d',
      }}
    >
      {faceUp ? (
        <span className="text-2xl md:text-3xl font-bold font-mono text-slate-900">
          {value}
        </span>
      ) : hasVoted ? (
        <div className="w-full h-full rounded-md overflow-hidden relative">
          {/* Geometric pattern for card back */}
          <div className="absolute inset-0 opacity-30">
            <svg className="w-full h-full" viewBox="0 0 40 60">
              <pattern id="cardPattern" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                <circle cx="5" cy="5" r="1.5" fill="white" opacity="0.4" />
                <path d="M0,0 L10,10 M10,0 L0,10" stroke="white" strokeWidth="0.5" opacity="0.2" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#cardPattern)" />
            </svg>
          </div>
          {/* Center diamond */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 md:w-8 md:h-8 bg-white/20 rotate-45 rounded-sm" />
          </div>
        </div>
      ) : (
        <div className="w-2 h-2 bg-slate-600 rounded-full" />
      )}
    </div>
  );
};

export default PokerCard;
