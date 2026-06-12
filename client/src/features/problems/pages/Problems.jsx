import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Loader2,
  Trash2,
  Check,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  FileQuestion,
  Download,
} from 'lucide-react';
import api from '../api';
import LeetCodeImport from '../components/LeetCodeImport';
import TopicTags from '../components/TopicTags';
import TopicFilterTabs from '../components/TopicFilterTabs';
import { getProblemTopics } from '../utils/problemFilters';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge, DifficultyBadge } from '../components/ui/badge';
import { Card } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { toast } from '../components/ui/use-toast';
import {
  StatusCheckbox,
  FilterRow,
  BulkResultsPanel,
  BulkParseStats,
  AddModeToggle,
  parseBulkProblemNumbers,
  createEmptyBulkProgress,
} from '../components/problems/shared';

const BULK_ADD_CONCURRENCY = 3;
const PROBLEMS_PAGE_SIZE = 20;

function getProblemNumber(problem) {
  return Number(problem?.leetcode_number ?? problem?.id);
}

export default function Problems() {
  const [allProblems, setAllProblems] = useState([]);
  const [expandedTopics, setExpandedTopics] = useState({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePattern, setActivePattern] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [solvedFilter, setSolvedFilter] = useState('');
  const [sortBy, setSortBy] = useState('number');
  const [visibleCount, setVisibleCount] = useState(PROBLEMS_PAGE_SIZE);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState(null);
  const [addError, setAddError] = useState('');
  const [addMode, setAddMode] = useState('single');
  const [bulkInput, setBulkInput] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(() => createEmptyBulkProgress());
  const [bulkResults, setBulkResults] = useState([]);
  const searchTimeoutRef = useRef(null);

  const fetchProblems = () => {
    setLoading(true);
    return api.getCached('/problems', {}, 10000)
      .then(res => setAllProblems(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Compute dynamic topic tabs from all problems
  const dynamicPatterns = useMemo(() => {
    return getProblemTopics(allProblems);
  }, [allProblems]);

  // Apply filters on the frontend
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

  // Reset pagination whenever the filtered/sorted result set changes.
  useEffect(() => {
    setVisibleCount(PROBLEMS_PAGE_SIZE);
  }, [activePattern, difficultyFilter, solvedFilter, sortBy]);

  const visibleProblems = useMemo(
    () => problems.slice(0, visibleCount),
    [problems, visibleCount]
  );
  const hasMoreProblems = visibleCount < problems.length;

  const bulkParseResult = useMemo(() => parseBulkProblemNumbers(bulkInput), [bulkInput]);
  const bulkCompletionPercent = bulkProgress.total > 0
    ? Math.round((bulkProgress.completed / bulkProgress.total) * 100)
    : 0;

  const addProblemToList = (problem) => {
    if (!problem) return;

    setAllProblems(prev => {
      const incomingNumber = getProblemNumber(problem);
      const exists = prev.some(item => getProblemNumber(item) === incomingNumber);
      if (exists) return prev;
      return [...prev, problem].sort((a, b) => getProblemNumber(a) - getProblemNumber(b));
    });
  };

  const resetAddModalState = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    setPreview(null);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    setAddError('');
    setAddMode('single');
    setBulkInput('');
    setBulkError('');
    setIsBulkAdding(false);
    setBulkProgress(createEmptyBulkProgress());
    setBulkResults([]);
  };

  const closeAddModal = () => {
    if (isBulkAdding) return;
    setShowAddModal(false);
    resetAddModalState();
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setPreview(null);
    setAddError('');

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get(`/problems/search?q=${encodeURIComponent(query)}`);
        setSearchResults(res.data);
      } catch (err) {
        console.error('Search error', err);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce
  };

  const handleSelectProblem = (prob) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    setPreview(prob);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    setAddError('');
  };

  const handleAddProblem = async () => {
    if (!preview) return;
    setAddError('');
    try {
      const res = await api.post('/problems', {
        leetcode_number: preview.number,
        title: preview.title,
        difficulty: preview.difficulty,
        pattern_name: preview.topics?.[0] || null
      });
      addProblemToList(res.data);
      toast({ title: 'Problem added', description: `#${preview.number} ${preview.title}`, variant: 'success' });
      closeAddModal();
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add problem');
    }
  };

  const recordBulkResult = (result) => {
    setBulkResults(prev => [...prev, result]);
    setBulkProgress(prev => {
      const next = {
        ...prev,
        completed: prev.completed + 1,
      };

      if (result.status === 'added') {
        next.added += 1;
      } else if (result.status === 'skipped') {
        next.skipped += 1;
      } else {
        next.failed += 1;
      }

      return next;
    });
  };

  const handleBulkAddProblems = async () => {
    if (isBulkAdding) return;

    const { numbers, duplicates, invalidTokens } = bulkParseResult;
    if (numbers.length === 0) {
      setBulkError('Enter at least one valid LeetCode question number.');
      return;
    }

    const preflightResults = [
      ...duplicates.map(number => ({
        status: 'duplicate',
        number,
        message: 'Duplicate in input',
      })),
      ...invalidTokens.map(token => ({
        status: 'invalid',
        token,
        message: 'Invalid number',
      })),
    ];

    setBulkError('');
    setBulkResults(preflightResults);
    setBulkProgress(createEmptyBulkProgress(numbers.length));
    setIsBulkAdding(true);

    let nextIndex = 0;

    const addNextProblem = async () => {
      while (nextIndex < numbers.length) {
        const number = numbers[nextIndex];
        nextIndex += 1;

        try {
          const res = await api.post('/problems', {
            leetcode_number: number,
            require_dataset: true,
          });
          addProblemToList(res.data);
          recordBulkResult({
            status: 'added',
            number,
            title: res.data.title,
            message: 'Added',
          });
        } catch (err) {
          const responseData = err.response?.data || {};
          const alreadyTracked = responseData.error === 'Problem already in your list' && responseData.problem;

          if (alreadyTracked) {
            addProblemToList(responseData.problem);
            recordBulkResult({
              status: 'skipped',
              number,
              title: responseData.problem.title,
              message: 'Already tracked',
            });
          } else {
            recordBulkResult({
              status: 'failed',
              number,
              message: responseData.error || 'Failed to add problem',
            });
          }
        }
      }
    };

    try {
      const workerCount = Math.min(BULK_ADD_CONCURRENCY, numbers.length);
      await Promise.all(Array.from({ length: workerCount }, addNextProblem));
      await fetchProblems();
    } finally {
      setIsBulkAdding(false);
    }
  };

  const handleSetStatus = async (problemId, nextStatus) => {
    try {
      const res = await api.post(`/problems/${problemId}/status`, { status: nextStatus });
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
      await api.delete(`/problems/${deleteTarget.id}`);
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

  const solvedCount = problems.filter(p => p.status === 'solved').length;
  const attemptedCount = problems.filter(p => p.status === 'attempted').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24 md:pb-12 space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Problems</h1>
          <p className="text-muted-foreground mt-2">
            <span className="text-emerald-400 font-medium">{solvedCount} solved</span>
            <span className="text-muted-foreground/50"> · </span>
            <span className="text-amber-400 font-medium">{attemptedCount} attempted</span>
            <span className="text-muted-foreground/50"> · </span>
            {problems.length} total
            {activePattern !== 'all' && ` in ${activePattern}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            <Download className="h-4 w-4 text-[#FFA116]" />
            Import from LeetCode
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" />
            Add Problem
          </Button>
        </div>
      </header>

      {/* Dynamic Pattern Tabs */}
      <TopicFilterTabs
        patterns={dynamicPatterns}
        activePattern={activePattern}
        onSelect={setActivePattern}
        accent="emerald"
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="gap-2"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Advanced Filters
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showAdvancedFilters && 'rotate-180')} />
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort</span>
          <div className="inline-flex rounded-lg bg-black/40 border border-white/10 p-0.5">
            <button
              onClick={() => setSortBy('number')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                sortBy === 'number' ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-white'
              )}
            >
              Number
            </button>
            <button
              onClick={() => setSortBy('recent')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                sortBy === 'recent' ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-white'
              )}
            >
              Recently solved
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {showAdvancedFilters && (
        <Card className="p-5 mb-6 animate-fade-in">
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            Match <Badge variant="secondary">All</Badge> of the following filters:
          </h3>

          <div className="space-y-3">
            <FilterRow
              label="Status"
              Icon={Check}
              value={solvedFilter}
              onChange={setSolvedFilter}
              onClear={() => setSolvedFilter('')}
              placeholder="Any Status"
              options={[
                { value: 'true', label: 'Solved' },
                { value: 'attempted', label: 'Attempted' },
                { value: 'false', label: 'Unsolved' },
              ]}
            />
            <FilterRow
              label="Difficulty"
              Icon={SlidersHorizontal}
              value={difficultyFilter}
              onChange={setDifficultyFilter}
              onClear={() => setDifficultyFilter('')}
              placeholder="Any Difficulty"
              options={[
                { value: 'Easy', label: 'Easy' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Hard', label: 'Hard' },
              ]}
            />
            <FilterRow
              label="Topics"
              Icon={FileQuestion}
              value={activePattern === 'all' ? '' : activePattern}
              onChange={(v) => setActivePattern(v || 'all')}
              onClear={() => setActivePattern('all')}
              placeholder="Any Topic"
              options={dynamicPatterns.map(p => ({ value: p, label: p }))}
            />
          </div>

          <div className="mt-6 flex justify-end items-center border-t border-white/10 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDifficultyFilter(''); setSolvedFilter(''); setActivePattern('all'); }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
          </div>
        </Card>
      )}

      {/* Problem List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : problems.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5">
            <FileQuestion className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No problems found</h3>
          <p className="text-muted-foreground mb-6">Add your first problem or adjust your filters.</p>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4" />
            Add Problem
          </Button>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {visibleProblems.map((p) => {
              const topics = p.topics?.length ? p.topics : (p.pattern_name ? [p.pattern_name] : []);
              const hasExpandedTopics = expandedTopics[p.id];

              return (
                <Card
                  className={cn(
                    'p-4 space-y-4',
                    p.status === 'solved' ? 'bg-emerald-500/[0.03]' : p.status === 'attempted' ? 'bg-amber-500/[0.03]' : ''
                  )}
                  key={p.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-muted-foreground mb-1">#{p.leetcode_number}</div>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-100 hover:text-emerald-400 transition-colors block">
                        {p.title}
                      </a>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: p.id, title: p.title }); }}
                      title="Delete problem"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <DifficultyBadge difficulty={p.difficulty} />
                    <TopicTags
                      topics={topics}
                      expanded={hasExpandedTopics}
                      onToggle={() => toggleExpandedTopics(p.id)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
                        p.status === 'attempted'
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-white/5 border-white/10 text-gray-300'
                      )}
                      onClick={() => handleSetStatus(p.id, p.status === 'attempted' ? 'unsolved' : 'attempted')}
                    >
                      <span className={cn('w-4 h-4 rounded border flex items-center justify-center', p.status === 'attempted' ? 'border-amber-400' : 'border-white/20')}>
                        {p.status === 'attempted' && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                      Attempted
                    </button>
                    <button
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all',
                        p.status === 'solved'
                          ? 'bg-emerald-500 border-emerald-500 text-black'
                          : 'bg-white/5 border-white/10 text-gray-300'
                      )}
                      onClick={() => handleSetStatus(p.id, p.status === 'solved' ? 'unsolved' : 'solved')}
                    >
                      <span className={cn('w-4 h-4 rounded border flex items-center justify-center', p.status === 'solved' ? 'border-black/20' : 'border-white/20')}>
                        {p.status === 'solved' && <Check className="w-3 h-3" strokeWidth={3} />}
                      </span>
                      Solved
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="grid grid-cols-[110px_110px_60px_minmax(220px,1fr)_100px_minmax(150px,1fr)_48px] gap-4 p-4 border-b border-white/[0.08] text-[11px] font-semibold text-muted-foreground bg-white/[0.03] uppercase tracking-wider">
              <span className="text-center">Attempted</span>
              <span className="text-center">Solved</span>
              <span>#</span>
              <span>Title</span>
              <span>Difficulty</span>
              <span>Topics</span>
              <span className="text-center">Del</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {visibleProblems.map((p) => {
                const topics = p.topics?.length ? p.topics : (p.pattern_name ? [p.pattern_name] : []);
                const hasExpandedTopics = expandedTopics[p.id];

                return (
                  <div
                    className={cn(
                      'grid grid-cols-[110px_110px_60px_minmax(220px,1fr)_100px_minmax(150px,1fr)_48px] gap-4 p-4 items-center transition-colors hover:bg-white/[0.04]',
                      p.status === 'solved' ? 'bg-emerald-500/[0.02]' : p.status === 'attempted' ? 'bg-amber-500/[0.02]' : ''
                    )}
                    key={p.id}
                  >
                    <div className="flex justify-center flex-shrink-0">
                      <StatusCheckbox
                        active={p.status === 'attempted'}
                        kind="attempted"
                        onClick={() => handleSetStatus(p.id, p.status === 'attempted' ? 'unsolved' : 'attempted')}
                        title={p.status === 'attempted' ? 'Mark unattempted' : 'Mark attempted'}
                      />
                    </div>
                    <div className="flex justify-center flex-shrink-0">
                      <StatusCheckbox
                        active={p.status === 'solved'}
                        kind="solved"
                        onClick={() => handleSetStatus(p.id, p.status === 'solved' ? 'unsolved' : 'solved')}
                        title={p.status === 'solved' ? 'Mark unsolved' : 'Mark solved'}
                      />
                    </div>
                    <span className="font-mono text-muted-foreground text-sm">#{p.leetcode_number}</span>
                    <span className="truncate">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-200 hover:text-emerald-400 transition-colors">
                        {p.title}
                      </a>
                    </span>
                    <span>
                      <DifficultyBadge difficulty={p.difficulty} />
                    </span>
                    <div className="flex flex-wrap gap-2 pr-2">
                      <TopicTags
                        topics={topics}
                        expanded={hasExpandedTopics}
                        onToggle={() => toggleExpandedTopics(p.id)}
                      />
                    </div>
                    <div className="flex justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground/60 hover:text-rose-400 hover:bg-rose-500/10"
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: p.id, title: p.title }); }}
                        title="Delete problem"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {hasMoreProblems && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button variant="outline" onClick={() => setVisibleCount(count => count + PROBLEMS_PAGE_SIZE)}>
                Show more
              </Button>
              <span className="text-xs text-muted-foreground">
                Showing {visibleProblems.length} of {problems.length}
              </span>
            </div>
          )}
        </>
      )}

      {/* Add Problem Dialog */}
      <Dialog open={showAddModal} onOpenChange={(open) => { if (!open) closeAddModal(); }}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b border-white/[0.08]">
            <DialogTitle>Add Problem</DialogTitle>
            <DialogDescription>Track a new LeetCode problem in your list.</DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <AddModeToggle
              addMode={addMode}
              setAddMode={setAddMode}
              isBulkAdding={isBulkAdding}
              onSwitch={(mode) => {
                if (mode === 'single') setBulkError('');
                else setAddError('');
              }}
            />

            {addMode === 'single' && (
              <>
                <div className="relative">
                  <Label className="mb-2 block">Search Title or #</Label>
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={e => handleSearch(e.target.value)}
                      placeholder="e.g. Two Sum..."
                      className="pl-10"
                      autoComplete="off"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-emerald-400" />
                    )}
                  </div>

                  {searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-white/10 bg-popover shadow-2xl shadow-black/60 overflow-hidden z-20 max-h-60 overflow-y-auto scrollbar-thin">
                      {searchResults.map(res => (
                        <button
                          key={res.number}
                          type="button"
                          className="w-full flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 text-left"
                          onClick={() => handleSelectProblem(res)}
                        >
                          <span className="text-muted-foreground font-mono text-xs w-10 flex-shrink-0">#{res.number}</span>
                          <span className="font-medium text-gray-200 flex-1 truncate text-sm">{res.title}</span>
                          <DifficultyBadge difficulty={res.difficulty} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {addError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{addError}</div>
                )}

                {preview && (
                  <Card className="p-4 bg-white/[0.03]">
                    <div className="font-medium text-white mb-2.5">
                      <span className="font-mono text-xs text-muted-foreground mr-2">#{preview.number}</span>
                      {preview.title}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <DifficultyBadge difficulty={preview.difficulty} />
                      {preview.topics && preview.topics.map(t => (
                        <Badge variant="topic" key={t}>{t}</Badge>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}

            {addMode === 'bulk' && (
              <>
                <div>
                  <Label className="mb-2 block">LeetCode Question Numbers</Label>
                  <Textarea
                    value={bulkInput}
                    onChange={e => {
                      setBulkInput(e.target.value);
                      setBulkError('');
                      setBulkResults([]);
                      setBulkProgress(createEmptyBulkProgress());
                    }}
                    disabled={isBulkAdding}
                    rows={4}
                    placeholder={`1, 2, 15\n49 53 121\n200; 206; 217`}
                    className="resize-none font-mono"
                  />
                </div>

                {bulkInput.trim() && <BulkParseStats parseResult={bulkParseResult} />}

                {bulkError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{bulkError}</div>
                )}

                <BulkResultsPanel
                  bulkProgress={bulkProgress}
                  bulkResults={bulkResults}
                  isBulkAdding={isBulkAdding}
                  bulkCompletionPercent={bulkCompletionPercent}
                />
              </>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-white/[0.08]">
            <Button variant="outline" onClick={closeAddModal} disabled={isBulkAdding}>
              {addMode === 'bulk' && bulkProgress.completed > 0 && !isBulkAdding ? 'Close' : 'Cancel'}
            </Button>
            {addMode === 'single' ? (
              <Button onClick={handleAddProblem} disabled={!preview}>
                <Plus className="h-4 w-4" />
                Save
              </Button>
            ) : (
              <Button
                onClick={handleBulkAddProblems}
                disabled={isBulkAdding || bulkParseResult.numbers.length === 0}
                className="min-w-32"
              >
                {isBulkAdding && <Loader2 className="h-4 w-4 animate-spin" />}
                {isBulkAdding ? 'Adding...' : 'Add Problems'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete problem?</DialogTitle>
            <DialogDescription>
              This removes <span className="text-foreground font-medium">"{deleteTarget?.title}"</span> from your tracker. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connect LeetCode Dialog */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <div className="bg-gradient-to-b from-[#FFA116]/[0.07] to-transparent px-6 py-5 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#FFA116]/10 flex items-center justify-center border border-[#FFA116]/25 flex-shrink-0">
                <svg className="w-6 h-6 text-[#FFA116]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.105 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.939 5.939 0 0 0 1.271 1.541 5.995 5.995 0 0 0 .678.463 6.115 6.115 0 0 0 1.08.452 6.324 6.324 0 0 0 1.954.218 6.426 6.426 0 0 0 1.109-.134 6.55 6.55 0 0 0 1.97-.68 6.57 6.57 0 0 0 .445-.278 6.643 6.643 0 0 0 .848-.731l6.19-6.6a1.365 1.365 0 0 0 .408-.98 1.353 1.353 0 0 0-.411-.986l-2.092-2.228a1.354 1.354 0 0 0-.974-.423 1.366 1.366 0 0 0-.966.428l-5.694 6.07a1.27 1.27 0 0 1-.9.395 1.246 1.246 0 0 1-.892-.379l-1.636-1.742a1.26 1.26 0 0 1-.378-.893 1.278 1.278 0 0 1 .378-.9l6.305-6.721A1.368 1.368 0 0 0 13.483 0zm-2.866 12.815a1.362 1.362 0 0 0-.96.44l-2.24 2.39a1.351 1.351 0 0 0-.406.983c0 .359.135.703.385.962l2.366 2.516c.26.275.617.432.993.432.378 0 .736-.157.995-.432l2.253-2.396a1.354 1.354 0 0 0 .406-.983 1.34 1.34 0 0 0-.406-.968l-2.39-2.502a1.347 1.347 0 0 0-.996-.442z"></path>
                </svg>
              </div>
              <DialogHeader>
                <DialogTitle>Import from LeetCode</DialogTitle>
                <DialogDescription>Sync your submissions directly from your browser</DialogDescription>
              </DialogHeader>
            </div>
          </div>

          <div className="px-6 py-5">
            <LeetCodeImport
              onSuccess={() => fetchProblems()}
              onCancel={() => setShowImportModal(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
