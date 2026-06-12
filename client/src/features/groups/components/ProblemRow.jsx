import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

const DIFFICULTY_TEXT = {
  Easy: 'text-sky-400',
  Medium: 'text-amber-400',
  Hard: 'text-rose-400',
};

export default function ProblemRow({ problem, isAdded, isSelected, onToggleSelect, onAdd }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 px-4 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
        <button
          type="button"
          onClick={() => !isAdded && onToggleSelect(problem.id)}
          className={cn(
            'w-5 h-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0',
            isAdded
              ? 'border-white/10 bg-white/5 text-muted-foreground/60 cursor-not-allowed'
              : isSelected
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                : 'border-white/20 bg-transparent text-transparent hover:border-white/40'
          )}
          disabled={isAdded}
          aria-label={isSelected ? 'Deselect problem' : 'Select problem'}
        >
          {(isSelected || isAdded) && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
        </button>

        <div className="flex flex-col gap-1 min-w-0">
          <h4 className="text-foreground font-medium truncate text-sm" title={problem.title}>
            {problem.title}
          </h4>
          <div className="flex items-center gap-3">
            <span className={cn(
              'text-[11px] font-bold tracking-wide uppercase',
              DIFFICULTY_TEXT[problem.difficulty] || DIFFICULTY_TEXT.Medium
            )}>
              {problem.difficulty}
            </span>
            {problem.topics && problem.topics.length > 0 && (
              <span className="text-xs text-muted-foreground truncate" title={problem.topics.join(', ')}>
                • {problem.topics.join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex-shrink-0">
        {isAdded ? (
          <span className="text-muted-foreground text-xs font-medium px-3 py-1 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            Added
          </span>
        ) : (
          <button
            onClick={() => onAdd(problem)}
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 transition-colors whitespace-nowrap"
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}
