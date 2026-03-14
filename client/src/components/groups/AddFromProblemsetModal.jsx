import React, { useState, useEffect, useMemo } from 'react';
import api from '../../api';
import ProblemRow from './ProblemRow';

export default function AddFromProblemsetModal({ isOpen, onClose, onAddProblem, onAddProblems, existingProblems = [] }) {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch user problemset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setError('');
      setSelectedIds([]);
      loadProblems();
    }
  }, [isOpen]);

  const loadProblems = async () => {
    setLoading(true);
    try {
      const res = await api.getCached('/problems', {}, 10000);
      setProblems(res.data);
    } catch (err) {
      console.error('Failed to load problems:', err);
      setError('Failed to load your problems.');
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering
  const filteredProblems = useMemo(() => {
    if (!searchQuery.trim()) return problems;
    
    const query = searchQuery.toLowerCase();
    return problems.filter(p => {
      const titleMatch = p.title?.toLowerCase().includes(query);
      const diffMatch = p.difficulty?.toLowerCase().includes(query);
      const patternMatch = p.pattern_name?.toLowerCase().includes(query);
      const topicMatch = p.topics?.some(topic => topic.toLowerCase().includes(query));
      
      return titleMatch || diffMatch || patternMatch || topicMatch;
    });
  }, [problems, searchQuery]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Convert existing problems array to a Set of IDs for quick lookup
  const existingSet = new Set(existingProblems.map(p => p.id));
  const selectableProblems = filteredProblems.filter(problem => !existingSet.has(problem.id));
  const selectedCount = selectedIds.filter(id => !existingSet.has(id)).length;

  const toggleSelected = (problemId) => {
    setSelectedIds(prev => (
      prev.includes(problemId)
        ? prev.filter(id => id !== problemId)
        : [...prev, problemId]
    ));
  };

  const handleAddSelected = async (problemsToAdd) => {
    if (!problemsToAdd.length || !onAddProblems) return;

    const confirmed = window.confirm(`Add ${problemsToAdd.length} problem${problemsToAdd.length === 1 ? '' : 's'} to this group?`);
    if (!confirmed) return;

    setIsSubmitting(true);
    setError('');

    try {
      const result = await onAddProblems(problemsToAdd);
      setSelectedIds([]);

      if (result?.failedCount) {
        setError(`${result.failedCount} problem${result.failedCount === 1 ? '' : 's'} could not be added.`);
      } else {
        onClose();
      }
    } catch (err) {
      setError('Failed to add selected problems.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAll = async () => {
    await handleAddSelected(problems.filter(problem => !existingSet.has(problem.id)));
  };

  const handleAddCurrentSelection = async () => {
    const selectedProblems = problems.filter(problem => selectedIds.includes(problem.id) && !existingSet.has(problem.id));
    await handleAddSelected(selectedProblems);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-neutral-900 border border-white/10 rounded-2xl p-6 max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors bg-white/5 p-1.5 rounded-lg border border-white/10"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="mb-6 pr-8">
          <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
            </svg>
            Select Problems From Your Problemset
          </h2>
          <p className="text-sm text-gray-400">
            Quickly add problems you've already tracked directly into this group.
          </p>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-4 py-2.5 border border-white/10 rounded-xl leading-5 bg-black/50 text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
            placeholder="Search your problems..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <div className="text-sm text-gray-400">
            {selectedCount} selected · {selectableProblems.length} available in this view
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
              onClick={() => setSelectedIds(selectableProblems.map(problem => problem.id))}
              disabled={!selectableProblems.length || isSubmitting}
            >
              Select Visible
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-gray-300 hover:bg-white/5 transition-colors disabled:opacity-50"
              onClick={() => setSelectedIds([])}
              disabled={!selectedCount || isSubmitting}
            >
              Clear
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-sm text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              onClick={handleAddAll}
              disabled={!problems.some(problem => !existingSet.has(problem.id)) || isSubmitting}
            >
              Add All Not Added
            </button>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-sm font-medium text-white hover:bg-indigo-500 transition-colors disabled:opacity-50"
              onClick={handleAddCurrentSelection}
              disabled={!selectedCount || isSubmitting}
            >
              {isSubmitting ? 'Adding...' : `Add Selected (${selectedCount})`}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[300px]">
          {loading ? (
            <div className="flex h-full items-center justify-center text-gray-500 text-sm">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading problemset...
            </div>
          ) : filteredProblems.length === 0 ? (
            <div className="flex h-full items-center justify-center text-gray-500 text-sm">
              No problems found matching your search.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {filteredProblems.map(prob => {
                const topics = prob.topics || (prob.pattern_name ? [prob.pattern_name] : []);
                
                return (
                  <ProblemRow 
                    key={prob.id} 
                    problem={{ ...prob, topics }} 
                    isAdded={existingSet.has(prob.id)} 
                    isSelected={selectedIds.includes(prob.id)}
                    onToggleSelect={toggleSelected}
                    onAdd={onAddProblem}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
