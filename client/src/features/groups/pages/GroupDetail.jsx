import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Plus,
  UserPlus,
  ListPlus,
  Trash2,
  Search,
  Loader2,
  Check,
  ChevronDown,
  SlidersHorizontal,
  RotateCcw,
  Users,
  FileQuestion,
  Tag,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import AddFromProblemsetModal from '../components/groups/AddFromProblemsetModal';
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

const BULK_GROUP_ADD_CONCURRENCY = 3;
const PROBLEMS_PAGE_SIZE = 20;

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddProblem, setShowAddProblem] = useState(false);
  const [showAddFromProblemset, setShowAddFromProblemset] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showDeleteGroup, setShowDeleteGroup] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [expandedTopics, setExpandedTopics] = useState({});
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  // Advanced filters
  const [activePattern, setActivePattern] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [solvedFilter, setSolvedFilter] = useState('');
  const [groupStatusFilter, setGroupStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('number');
  const [visibleCount, setVisibleCount] = useState(PROBLEMS_PAGE_SIZE);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState(null);
  const [addMode, setAddMode] = useState('single');
  const [bulkInput, setBulkInput] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(() => createEmptyBulkProgress());
  const [bulkResults, setBulkResults] = useState([]);
  const searchTimeoutRef = useRef(null);

  const fetchGroup = useCallback(() => {
    return api.getCached(`/groups/${id}`, {}, 10000)
      .then(res => setGroup(res.data))
      .catch(() => navigate('/groups'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const patterns = useMemo(() => {
    return getProblemTopics(group?.problems || []);
  }, [group]);

  // Filter problems by active pattern and other filters
  const filteredProblems = useMemo(() => {
    if (!group?.problems) return [];

    const filtered = group.problems.filter(p => {
      // Pattern filter
      const matchPattern = activePattern === 'all' ||
                           (p.topics?.includes(activePattern) || p.pattern_name === activePattern);
      if (!matchPattern) return false;

      // Difficulty filter
      if (difficultyFilter && p.difficulty !== difficultyFilter) return false;

      // Personal Status Filter (match behavior of Problems page)
      if (solvedFilter) {
        const myStatus = p.member_statuses?.find(ms => ms.user_id === user?.id)?.status || 'unsolved';
        if (solvedFilter === 'true' && myStatus !== 'solved') return false;
        if (solvedFilter === 'false' && myStatus !== 'unsolved') return false;
        if (solvedFilter === 'attempted' && myStatus !== 'attempted') return false;
      }

      // Group Status Filter (any member solved vs none)
      if (groupStatusFilter) {
        const anySolved = p.member_statuses?.some(ms => ms.solved);
        if (groupStatusFilter === 'true' && !anySolved) return false;
        if (groupStatusFilter === 'false' && anySolved) return false;
      }

      return true;
    });

    if (sortBy === 'recent') {
      // Most recently solved (by me) first. If timestamps are unavailable
      // (older data), fall back to my status so solved problems rise to the top.
      const statusRank = { solved: 2, attempted: 1, unsolved: 0 };
      const mine = (p) => p.member_statuses?.find(ms => ms.user_id === user?.id);
      const mySolvedAt = (p) => {
        const m = mine(p);
        return m?.solvedAt ? new Date(m.solvedAt).getTime() : 0;
      };
      filtered.sort((a, b) => {
        const diff = mySolvedAt(b) - mySolvedAt(a);
        if (diff !== 0) return diff;
        const rankDiff = (statusRank[mine(b)?.status] ?? 0) - (statusRank[mine(a)?.status] ?? 0);
        if (rankDiff !== 0) return rankDiff;
        return a.leetcode_number - b.leetcode_number;
      });
    } else {
      filtered.sort((a, b) => a.leetcode_number - b.leetcode_number);
    }

    return filtered;
  }, [group, user, activePattern, difficultyFilter, solvedFilter, groupStatusFilter, sortBy]);

  // Reset pagination whenever the filtered/sorted result set changes.
  useEffect(() => {
    setVisibleCount(PROBLEMS_PAGE_SIZE);
  }, [activePattern, difficultyFilter, solvedFilter, groupStatusFilter, sortBy]);

  const visibleProblems = useMemo(
    () => filteredProblems.slice(0, visibleCount),
    [filteredProblems, visibleCount]
  );
  const hasMoreProblems = visibleCount < filteredProblems.length;

  const isGroupCreator = group?.created_by === user?.id;
  const bulkParseResult = useMemo(() => parseBulkProblemNumbers(bulkInput), [bulkInput]);
  const bulkCompletionPercent = bulkProgress.total > 0
    ? Math.round((bulkProgress.completed / bulkProgress.total) * 100)
    : 0;

  const handleAddMember = async () => {
    if (!username.trim()) return;
    setError('');
    try {
      await api.post(`/groups/${id}/members`, { username: username.trim() });
      toast({ title: 'Member added', description: username.trim(), variant: 'success' });
      setUsername('');
      setShowAddMember(false);
      fetchGroup();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setPreview(null);
    setError('');

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
    setError('');
  };

  const resetProblemModal = () => {
    if (isBulkAdding) return;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
    setShowAddProblem(false);
    setError('');
    setPreview(null);
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    setAddMode('single');
    setBulkInput('');
    setBulkError('');
    setBulkProgress(createEmptyBulkProgress());
    setBulkResults([]);
  };

  const upsertGroupProblem = (problem, currentUserStatus = 'unsolved') => {
    setGroup(prev => {
      if (!prev) return prev;

      const normalizedProblem = {
        ...problem,
        member_statuses: prev.members.map(member => {
          const existingStatus = problem.member_statuses?.find(status => status.user_id === member.id);
          if (existingStatus) {
            return existingStatus;
          }

          const status = member.id === user?.id ? currentUserStatus : 'unsolved';
          return {
            user_id: member.id,
            username: member.username,
            solved: status === 'solved' ? 1 : 0,
            status,
          };
        }),
      };

      const nextProblems = prev.problems.some(existing => existing.id === normalizedProblem.id)
        ? prev.problems.map(existing => (existing.id === normalizedProblem.id ? { ...existing, ...normalizedProblem } : existing))
        : [...prev.problems, normalizedProblem];

      nextProblems.sort((a, b) => a.leetcode_number - b.leetcode_number);

      return {
        ...prev,
        problems: nextProblems,
      };
    });
  };

  const updateCurrentUserStatus = (problemId, nextStatus) => {
    setGroup(prev => {
      if (!prev) return prev;

      return {
        ...prev,
        problems: prev.problems.map(problem => {
          if (problem.id !== problemId) return problem;

          return {
            ...problem,
            member_statuses: problem.member_statuses.map(memberStatus => (
              memberStatus.user_id === user?.id
                ? {
                    ...memberStatus,
                    status: nextStatus,
                    solved: nextStatus === 'solved' ? 1 : 0,
                    solvedAt: nextStatus === 'solved' ? new Date().toISOString() : null,
                  }
                : memberStatus
            )),
          };
        }),
      };
    });
  };

  const handleAddProblem = async () => {
    if (!preview) return;
    setError('');
    try {
      // First ensure the problem exists in the DB
      let problemRes;
      try {
        problemRes = await api.post('/problems', {
          leetcode_number: preview.number,
          title: preview.title,
          difficulty: preview.difficulty,
          pattern_name: preview.topics?.[0] || null
        });
      } catch (err) {
        // If problem already exists, get it from the list
        if (err.response?.data?.problem) {
          problemRes = { data: err.response.data.problem };
        } else {
          throw err;
        }
      }

      // Add problem to group
      const addRes = await api.post(`/groups/${id}/problems`, { problem_id: problemRes.data.id });
      upsertGroupProblem(addRes.data, problemRes.data.status || 'unsolved');
      toast({ title: 'Problem added to group', description: `#${preview.number} ${preview.title}`, variant: 'success' });
      resetProblemModal();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add problem');
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

    setError('');
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
          let problemData;
          try {
            const problemRes = await api.post('/problems', {
              leetcode_number: number,
              require_dataset: true,
            });
            problemData = problemRes.data;
          } catch (err) {
            if (err.response?.data?.problem) {
              problemData = err.response.data.problem;
            } else {
              throw err;
            }
          }

          try {
            const addRes = await api.post(`/groups/${id}/problems`, { problem_id: problemData.id });
            upsertGroupProblem(addRes.data, problemData.status || 'unsolved');
            recordBulkResult({
              status: 'added',
              number,
              title: addRes.data.title || problemData.title,
              message: 'Added',
            });
          } catch (err) {
            const responseError = err.response?.data?.error || '';
            if (err.response?.status === 400 && responseError.includes('already in group')) {
              recordBulkResult({
                status: 'skipped',
                number,
                title: problemData.title,
                message: 'Already in group',
              });
            } else {
              throw err;
            }
          }
        } catch (err) {
          recordBulkResult({
            status: 'failed',
            number,
            message: err.response?.data?.error || 'Failed to add problem',
          });
        }
      }
    };

    try {
      const workerCount = Math.min(BULK_GROUP_ADD_CONCURRENCY, numbers.length);
      await Promise.all(Array.from({ length: workerCount }, addNextProblem));
      await fetchGroup();
    } finally {
      setIsBulkAdding(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group || deleteConfirmName !== group.name || isDeletingGroup) return;

    setDeleteError('');
    setIsDeletingGroup(true);

    try {
      await api.delete(`/groups/${id}`, { data: { name: deleteConfirmName } });
      toast({ title: 'Group deleted', description: group.name });
      navigate('/groups');
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete group');
      setIsDeletingGroup(false);
    }
  };

  const handleAddFromProblemset = async (problem) => {
    try {
      const res = await api.post(`/groups/${id}/problems`, { problem_id: problem.id });
      upsertGroupProblem(res.data, problem.status || 'unsolved');
      toast({ title: 'Problem added to group', description: problem.title, variant: 'success' });
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error.includes('already in group')) {
        toast({ title: 'Already in group', description: problem.title, variant: 'destructive' });
      } else {
        toast({ title: 'Failed to add problem', description: err.response?.data?.error || '', variant: 'destructive' });
      }
    }
  };

  const addProblemsInChunks = async (problemsToAdd, chunkSize = 4) => {
    const succeeded = [];
    let failedCount = 0;

    for (let i = 0; i < problemsToAdd.length; i += chunkSize) {
      const chunk = problemsToAdd.slice(i, i + chunkSize);
      const chunkResults = await Promise.allSettled(
        chunk.map(async (problem) => {
          const res = await api.post(`/groups/${id}/problems`, { problem_id: problem.id });
          return { addedProblem: res.data, sourceProblem: problem };
        })
      );

      chunkResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          succeeded.push(result.value);
        } else {
          failedCount += 1;
        }
      });
    }

    return { succeeded, failedCount };
  };

  const handleAddMultipleFromProblemset = async (problemsToAdd) => {
    let succeeded = [];
    let failedCount = 0;

    try {
      const res = await api.post(`/groups/${id}/problems/bulk`, {
        problem_ids: problemsToAdd.map((problem) => problem.id),
      });

      const problemsById = new Map(problemsToAdd.map((problem) => [problem.id, problem]));
      succeeded = (res.data?.added || []).map((addedProblem) => ({
        addedProblem,
        sourceProblem: problemsById.get(addedProblem.id) || problemsById.get(addedProblem.leetcode_number),
      })).filter((entry) => entry.sourceProblem);
      failedCount = res.data?.failedCount || 0;
    } catch (err) {
      console.warn('Bulk add failed, falling back to throttled single adds:', err);
      const fallbackResults = await addProblemsInChunks(problemsToAdd);
      succeeded = fallbackResults.succeeded;
      failedCount = fallbackResults.failedCount;
    }

    succeeded.forEach(({ addedProblem, sourceProblem }) => {
      upsertGroupProblem(addedProblem, sourceProblem.status || 'unsolved');
    });

    if (succeeded.length > 0) {
      toast({
        title: `${succeeded.length} problem${succeeded.length === 1 ? '' : 's'} added to group`,
        variant: 'success',
      });
    }

    return {
      addedCount: succeeded.length,
      failedCount,
    };
  };

  const handleSetStatus = async (problemId, nextStatus) => {
    try {
      await api.post(`/problems/${problemId}/status`, { status: nextStatus });
      updateCurrentUserStatus(problemId, nextStatus);
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  };

  const renderStatusControl = (problemId, memberStatus, targetStatus, isCurrentUser) => {
    const isActive = memberStatus?.status === targetStatus;

    if (isCurrentUser) {
      const nextStatus = isActive ? 'unsolved' : targetStatus;
      return (
        <StatusCheckbox
          active={isActive}
          kind={targetStatus}
          onClick={() => handleSetStatus(problemId, nextStatus)}
          title={isActive ? `Mark ${targetStatus} off` : `Mark ${targetStatus}`}
        />
      );
    }

    return <StatusCheckbox active={isActive} kind={targetStatus} readOnly />;
  };

  const toggleExpandedTopics = (problemId) => {
    setExpandedTopics(prev => ({
      ...prev,
      [problemId]: !prev[problemId],
    }));
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }
  if (!group) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-8 space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 gap-2"
            onClick={() => navigate('/groups')}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Groups
          </Button>
          <h1 className="text-3xl font-bold text-white tracking-tight">{group.name}</h1>
          <p className="text-muted-foreground mt-2">
            {group.members?.length} members · {group.problems?.length} problems · Created by {group.creator_name}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setShowAddMember(true)}>
            <UserPlus className="w-4 h-4" />
            Add Member
          </Button>
          <Button variant="outline" onClick={() => setShowAddFromProblemset(true)}>
            <ListPlus className="w-4 h-4" />
            Add From My Problems
          </Button>
          <Button onClick={() => setShowAddProblem(true)}>
            <Plus className="w-4 h-4" />
            Add Problem
          </Button>
          {isGroupCreator && (
            <Button
              variant="destructive"
              onClick={() => {
                setDeleteConfirmName('');
                setDeleteError('');
                setShowDeleteGroup(true);
              }}
            >
              <Trash2 className="w-4 h-4" />
              Delete Group
            </Button>
          )}
        </div>
      </div>

      {/* Members Bar */}
      <div className="flex flex-wrap gap-3">
        {group.members?.map(m => (
          <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 px-3 py-1.5 rounded-full" key={m.id}>
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border',
              m.id === user?.id
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
            )}>
              {m.username.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-300">{m.username}</span>
            {m.id === user?.id && <span className="text-[10px] text-muted-foreground">you</span>}
          </div>
        ))}
      </div>

      {/* Dynamic Pattern Tabs */}
      <div className="mt-6">
        <TopicFilterTabs
          patterns={patterns}
          activePattern={activePattern}
          onSelect={setActivePattern}
          accent="indigo"
        />
      </div>

      <div className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-3">
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
                sortBy === 'number' ? 'bg-indigo-500/20 text-indigo-400' : 'text-muted-foreground hover:text-white'
              )}
            >
              Number
            </button>
            <button
              onClick={() => setSortBy('recent')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                sortBy === 'recent' ? 'bg-indigo-500/20 text-indigo-400' : 'text-muted-foreground hover:text-white'
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
              label="My Status"
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
              label="Group Status"
              Icon={Users}
              value={groupStatusFilter}
              onChange={setGroupStatusFilter}
              onClear={() => setGroupStatusFilter('')}
              placeholder="Any Group Status"
              options={[
                { value: 'true', label: 'Solved by Anyone' },
                { value: 'false', label: 'Unsolved by All' },
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
              label="Topic"
              Icon={Tag}
              value={activePattern === 'all' ? '' : activePattern}
              onChange={(v) => setActivePattern(v || 'all')}
              onClear={() => setActivePattern('all')}
              placeholder="Any Topic"
              options={patterns.map(p => ({ value: p, label: p }))}
            />
          </div>

          <div className="mt-6 flex justify-end items-center border-t border-white/10 pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDifficultyFilter(''); setSolvedFilter(''); setGroupStatusFilter(''); setActivePattern('all'); }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </Button>
          </div>
        </Card>
      )}

      {/* Group Problem Table */}
      {filteredProblems.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-5">
            <FileQuestion className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">{activePattern === 'all' ? 'No problems in this group' : `No "${activePattern}" problems`}</h3>
          <p className="text-muted-foreground">{activePattern === 'all' ? 'Add problems to start tracking progress together!' : 'Try selecting a different pattern.'}</p>
        </Card>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {visibleProblems.map((p) => {
              const myStatus = p.member_statuses?.find(ms => ms.user_id === user?.id)?.status || 'unsolved';
              const hasExpandedTopics = expandedTopics[p.id];

              return (
                <Card
                  className={cn(
                    'p-4 space-y-4',
                    myStatus === 'solved' ? 'bg-emerald-500/[0.03]' : myStatus === 'attempted' ? 'bg-amber-500/[0.03]' : ''
                  )}
                  key={p.leetcode_number}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-muted-foreground mb-1">#{p.leetcode_number}</div>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-100 hover:text-indigo-400 transition-colors block">
                        {p.title}
                      </a>
                    </div>
                    <DifficultyBadge difficulty={p.difficulty} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <TopicTags
                      topics={p.topics || []}
                      expanded={hasExpandedTopics}
                      onToggle={() => toggleExpandedTopics(p.id)}
                      emptyLabel="No topics"
                    />
                  </div>

                  <div className="space-y-2.5">
                    {p.member_statuses?.map(ms => (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5" key={ms.user_id}>
                        <span className="text-sm font-medium text-gray-200 truncate">{ms.username}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground uppercase">A</span>
                          {renderStatusControl(p.id, ms, 'attempted', ms.user_id === user?.id)}
                          <span className="ml-2 text-[10px] text-muted-foreground uppercase">S</span>
                          {renderStatusControl(p.id, ms, 'solved', ms.user_id === user?.id)}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block overflow-x-auto scrollbar-thin">
            <div className="min-w-max">
              {/* Table Header */}
              <div className="flex p-4 border-b border-white/[0.08] text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-white/[0.03]">
                <span className="w-16 flex-shrink-0">#</span>
                <span className="w-64 flex-shrink-0">Problem</span>
                <span className="w-32 flex-shrink-0">Difficulty</span>
                <span className="min-w-[140px] flex-1 pr-6">Topics</span>
                <div className="flex flex-none justify-end gap-6 pl-6">
                  {group.members?.map(m => (
                    <div className="w-24 flex-shrink-0 text-center" key={m.id} title={m.username}>
                      <div className="truncate">{m.username.substring(0, 5)}</div>
                      <div className="mt-1 flex justify-center gap-3 text-[10px] text-muted-foreground/70">
                        <span className="w-6 text-center">A</span>
                        <span className="w-6 text-center">S</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Table Body */}
              <div className="divide-y divide-white/[0.04]">
                {visibleProblems.map((p) => {
                  const myStatus = p.member_statuses?.find(ms => ms.user_id === user?.id)?.status || 'unsolved';
                  const hasExpandedTopics = expandedTopics[p.id];

                  return (
                    <div
                      className={cn(
                        'flex p-4 items-center transition-colors hover:bg-white/[0.04]',
                        myStatus === 'solved' ? 'bg-emerald-500/[0.02]' : myStatus === 'attempted' ? 'bg-amber-500/[0.02]' : ''
                      )}
                      key={p.leetcode_number}
                    >
                      <span className="w-16 flex-shrink-0 font-mono text-muted-foreground text-sm">#{p.leetcode_number}</span>
                      <span className="w-64 flex-shrink-0 truncate pr-4">
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-200 hover:text-indigo-400 transition-colors">
                          {p.title}
                        </a>
                      </span>
                      <span className="w-32 flex-shrink-0">
                        <DifficultyBadge difficulty={p.difficulty} />
                      </span>
                      <div className="min-w-[140px] flex-1 flex flex-wrap items-center gap-2 pr-6">
                        <TopicTags
                          topics={p.topics || []}
                          expanded={hasExpandedTopics}
                          onToggle={() => toggleExpandedTopics(p.id)}
                          emptyLabel="No topics"
                        />
                      </div>
                      <div className="flex flex-none justify-end gap-6 pl-6">
                        {p.member_statuses?.map(ms => (
                          <div className="w-24 flex-shrink-0 flex justify-center gap-3" key={ms.user_id}>
                            {renderStatusControl(p.id, ms, 'attempted', ms.user_id === user?.id)}
                            {renderStatusControl(p.id, ms, 'solved', ms.user_id === user?.id)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {hasMoreProblems && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <Button variant="outline" onClick={() => setVisibleCount(count => count + PROBLEMS_PAGE_SIZE)}>
                Show more
              </Button>
              <span className="text-xs text-muted-foreground">
                Showing {visibleProblems.length} of {filteredProblems.length}
              </span>
            </div>
          )}
        </>
      )}

      {/* Add Member Dialog */}
      <Dialog open={showAddMember} onOpenChange={(open) => { if (!open) { setShowAddMember(false); setError(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>Invite a LeetTracker user to this group.</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="member-username">Username</Label>
            <Input
              id="member-username"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter LeetTracker username..."
              onKeyDown={e => e.key === 'Enter' && handleAddMember()}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowAddMember(false); setError(''); }}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={!username.trim()}>
              <UserPlus className="w-4 h-4" />
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddFromProblemsetModal
        isOpen={showAddFromProblemset}
        onClose={() => setShowAddFromProblemset(false)}
        onAddProblem={handleAddFromProblemset}
        onAddProblems={handleAddMultipleFromProblemset}
        existingProblems={group.problems || []}
      />

      {/* Add Problem Dialog */}
      <Dialog open={showAddProblem} onOpenChange={(open) => { if (!open) resetProblemModal(); }}>
        <DialogContent className="max-w-lg p-0 gap-0">
          <DialogHeader className="px-6 py-5 border-b border-white/[0.08]">
            <DialogTitle>Add Problem to Group</DialogTitle>
            <DialogDescription>Everyone in the group will be able to track it.</DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <AddModeToggle
              addMode={addMode}
              setAddMode={setAddMode}
              isBulkAdding={isBulkAdding}
              onSwitch={(mode) => {
                if (mode === 'single') setBulkError('');
                else setError('');
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
                      <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-indigo-400" />
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

                {error && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>
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
                  accent="indigo"
                  skippedLabel="In group"
                />
              </>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-white/[0.08]">
            <Button variant="outline" onClick={resetProblemModal} disabled={isBulkAdding}>
              {addMode === 'bulk' && bulkProgress.completed > 0 && !isBulkAdding ? 'Close' : 'Cancel'}
            </Button>
            {addMode === 'single' ? (
              <Button onClick={handleAddProblem} disabled={!preview}>
                <Plus className="h-4 w-4" />
                Add Problem
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

      {/* Delete Group Dialog */}
      <Dialog
        open={showDeleteGroup}
        onOpenChange={(open) => {
          if (!open) {
            if (isDeletingGroup) return;
            setShowDeleteGroup(false);
            setDeleteConfirmName('');
            setDeleteError('');
          }
        }}
      >
        <DialogContent className="max-w-md border-rose-500/20">
          <DialogHeader>
            <DialogTitle>Delete Group</DialogTitle>
            <DialogDescription>
              This will permanently delete <span className="font-semibold text-foreground">{group.name}</span> for every member, including all group membership and problem entries.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              {deleteError}
            </div>
          )}

          <div className="space-y-2">
            <Label>
              Type <span className="font-mono text-foreground">{group.name}</span> to confirm.
            </Label>
            <Input
              type="text"
              value={deleteConfirmName}
              onChange={e => {
                setDeleteConfirmName(e.target.value);
                setDeleteError('');
              }}
              className="focus-visible:ring-rose-500/50 focus-visible:border-rose-500/60"
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteGroup(false);
                setDeleteConfirmName('');
                setDeleteError('');
              }}
              disabled={isDeletingGroup}
            >
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-500 text-white border-0"
              onClick={handleDeleteGroup}
              disabled={deleteConfirmName !== group.name || isDeletingGroup}
            >
              {isDeletingGroup && <Loader2 className="h-4 w-4 animate-spin" />}
              {isDeletingGroup ? 'Deleting...' : 'Delete Group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
