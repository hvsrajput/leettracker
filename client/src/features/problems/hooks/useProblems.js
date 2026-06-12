import { useState, useEffect, useMemo } from 'react';
import {
  listProblems,
  updateProblemStatus,
  deleteProblem,
} from '@/features/problems/services/problemsApi';
import { getProblemNumber, getProblemTopics } from '@/shared/lib/problemFilters';
import { toast } from '@/shared/ui/use-toast';

const PROBLEMS_PAGE_SIZE = 20;

// Owns the problem list and everything derived from it: the source data, the
// filter/sort/pagination state, the status & delete mutations, and the small
// pieces of UI state (advanced filters, expanded topics, modals). The page that
// consumes this hook only renders — it holds no logic of its own.
export const useProblems = () => {
  const [allProblems, setAllProblems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter / sort / pagination state.
  const [activePattern, setActivePattern] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [solvedFilter, setSolvedFilter] = useState('');
  const [sortBy, setSortBy] = useState('number');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [visibleCount, setVisibleCount] = useState(PROBLEMS_PAGE_SIZE);

  // Modal state.
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchProblems = () => {
    setLoading(true);
    return listProblems()
      .then(res => setAllProblems(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  // Compute dynamic topic tabs from all problems.
  const dynamicPatterns = useMemo(() => getProblemTopics(allProblems), [allProblems]);

  // Apply filters + sort on the frontend.
  const problems = useMemo(() => {
    const filtered = allProblems.filter(p => {
      const matchPattern = activePattern === 'all' ||
                           (p.topics?.includes(activePattern) || p.pattern_name === activePattern);
      const matchDifficulty = !difficultyFilter || p.difficulty === difficultyFilter;
      const matchSolved = !solvedFilter
        || (solvedFilter === 'true' && p.status === 'solved')
        || (solvedFilter === 'false' && p.status === 'unsolved')
        || (solvedFilter === 'attempted' && p.status === 'attempted');
      return matchPattern && matchDifficulty && matchSolved;
    });

    if (sortBy === 'recent') {
      // Most recently solved first. If timestamps are unavailable (older data),
      // fall back to status priority so solved problems still rise to the top.
      const statusRank = { solved: 2, attempted: 1, unsolved: 0 };
      filtered.sort((a, b) => {
        const aTime = a.solvedAt ? new Date(a.solvedAt).getTime() : 0;
        const bTime = b.solvedAt ? new Date(b.solvedAt).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
        const rankDiff = (statusRank[b.status] ?? 0) - (statusRank[a.status] ?? 0);
        if (rankDiff !== 0) return rankDiff;
        return getProblemNumber(a) - getProblemNumber(b);
      });
    } else {
      filtered.sort((a, b) => getProblemNumber(a) - getProblemNumber(b));
    }

    return filtered;
  }, [allProblems, activePattern, difficultyFilter, solvedFilter, sortBy]);

  // Reset pagination whenever the filter/sort selection changes. Done during
  // render (not in an effect) so it collapses into the same render pass.
  const filterKey = `${activePattern}|${difficultyFilter}|${solvedFilter}|${sortBy}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(PROBLEMS_PAGE_SIZE);
  }

  const visibleProblems = useMemo(
    () => problems.slice(0, visibleCount),
    [problems, visibleCount]
  );
  const hasMoreProblems = visibleCount < problems.length;

  const solvedCount = problems.filter(p => p.status === 'solved').length;
  const attemptedCount = problems.filter(p => p.status === 'attempted').length;

  // Inserts a freshly added/imported problem in place without a refetch.
  const addProblemToList = (problem) => {
    if (!problem) return;

    setAllProblems(prev => {
      const incomingNumber = getProblemNumber(problem);
      const exists = prev.some(item => getProblemNumber(item) === incomingNumber);
      if (exists) return prev;
      return [...prev, problem].sort((a, b) => getProblemNumber(a) - getProblemNumber(b));
    });
  };

  const handleSetStatus = async (problemId, nextStatus) => {
    try {
      const res = await updateProblemStatus(problemId, nextStatus);
      setAllProblems(prev => prev.map(p =>
        p.id === problemId
          ? {
              ...p,
              solved: res.data.solved,
              status: res.data.status,
              solvedAt: res.data.status === 'solved' ? new Date().toISOString() : null,
            }
          : p
      ));
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProblem(deleteTarget.id);
      setAllProblems(prev => prev.filter(p => p.id !== deleteTarget.id));
      toast({ title: 'Problem deleted', description: deleteTarget.title });
    } catch (err) {
      console.error('Failed to delete problem', err);
      toast({ title: 'Failed to delete problem', variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleExpandedTopics = (problemId) => {
    setExpandedTopics(prev => ({
      ...prev,
      [problemId]: !prev[problemId],
    }));
  };

  const showMore = () => setVisibleCount(count => count + PROBLEMS_PAGE_SIZE);

  const resetFilters = () => {
    setDifficultyFilter('');
    setSolvedFilter('');
    setActivePattern('all');
  };

  return {
    // data
    loading,
    problems,
    visibleProblems,
    hasMoreProblems,
    dynamicPatterns,
    solvedCount,
    attemptedCount,
    // filter / sort state
    activePattern,
    setActivePattern,
    difficultyFilter,
    setDifficultyFilter,
    solvedFilter,
    setSolvedFilter,
    sortBy,
    setSortBy,
    showAdvancedFilters,
    setShowAdvancedFilters,
    expandedTopics,
    toggleExpandedTopics,
    resetFilters,
    showMore,
    // mutations
    fetchProblems,
    addProblemToList,
    handleSetStatus,
    // delete modal
    deleteTarget,
    setDeleteTarget,
    handleConfirmDelete,
    // import modal
    showImportModal,
    setShowImportModal,
  };
};
