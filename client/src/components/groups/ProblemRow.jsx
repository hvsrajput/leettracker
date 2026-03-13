import React from 'react';

export default function ProblemRow({ problem, isAdded, isSelected, onToggleSelect, onAdd }) {
  return (
    <div className="flex items-center justify-between border-b border-white/10 py-3 last:border-0 hover:bg-white/5 transition-colors px-4 -mx-4 rounded-lg">
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
        <button
          type="button"
          onClick={() => !isAdded && onToggleSelect(problem.id)}
          className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
            isAdded
              ? 'border-white/10 bg-white/5 text-gray-600 cursor-not-allowed'
              : isSelected
                ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                : 'border-white/20 bg-transparent text-transparent hover:border-white/40'
          }`}
          disabled={isAdded}
          aria-label={isSelected ? 'Deselect problem' : 'Select problem'}
        >
          {(isSelected || isAdded) && (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </button>

        <div className="flex flex-col gap-1 min-w-0">
          <h4 className="text-white font-medium truncate" title={problem.title}>
            {problem.title}
          </h4>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-semibold tracking-wide uppercase ${
              problem.difficulty === 'Easy' ? 'text-blue-400' :
              problem.difficulty === 'Medium' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {problem.difficulty}
            </span>
            {problem.topics && problem.topics.length > 0 && (
              <span className="text-xs text-gray-400 truncate" title={problem.topics.join(', ')}>
                • {problem.topics.join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>
      <div>
        {isAdded ? (
          <span className="text-gray-500 text-xs font-medium px-3 py-1 flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Added
          </span>
        ) : (
          <button
            onClick={() => onAdd(problem)}
            className="bg-emerald-500/20 text-emerald-400 rounded-lg px-3 py-1 hover:bg-emerald-500/30 transition-colors text-sm font-medium whitespace-nowrap"
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}
