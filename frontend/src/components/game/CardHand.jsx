import { cn } from '../../lib/utils';

const CardHand = ({ cards, selectedCard, onSelect, disabled }) => {
  return (
    <div className="p-4 md:p-6">
      <div className="flex justify-center gap-1 md:gap-2 flex-wrap">
        {cards.map((card, index) => {
          const isSelected = selectedCard === card;
          const cardValue = String(card);
          
          return (
            <button
              key={cardValue}
              data-testid={`vote-card-${cardValue}`}
              onClick={() => !disabled && onSelect(card)}
              disabled={disabled}
              className={cn(
                "w-12 h-18 md:w-16 md:h-24 rounded-lg font-mono font-bold text-xl md:text-2xl",
                "transition-all duration-200 transform",
                "flex items-center justify-center",
                "border-2 shadow-lg",
                disabled
                  ? "opacity-50 cursor-not-allowed bg-slate-800 border-slate-700 text-slate-500"
                  : isSelected
                    ? "bg-emerald-600 border-emerald-400 text-white -translate-y-4 shadow-emerald-600/30 shadow-xl ring-2 ring-emerald-400/50"
                    : "bg-slate-100 border-slate-300 text-slate-900 hover:-translate-y-2 hover:shadow-xl cursor-pointer active:translate-y-0"
              )}
              style={{
                animationDelay: `${index * 30}ms`,
              }}
            >
              {cardValue}
            </button>
          );
        })}
      </div>
      
      {disabled && (
        <p className="text-center text-slate-500 text-sm mt-4">
          {selectedCard !== null 
            ? 'Cards revealed - waiting for next task' 
            : 'Select a task to start voting'}
        </p>
      )}
    </div>
  );
};

export default CardHand;
