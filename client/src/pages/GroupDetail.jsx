import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import AddFromProblemsetModal from '../components/groups/AddFromProblemsetModal';
import TopicTags from '../components/TopicTags';
import TopicFilterTabs from '../components/TopicFilterTabs';
import { getProblemTopics } from '../utils/problemFilters';

const BULK_GROUP_ADD_CONCURRENCY = 3;
const PROBLEMS_PAGE_SIZE = 20;

function createEmptyBulkProgress(total = 0) {
  return {
    total,
    completed: 0,
    added: 0,
    skipped: 0,
    failed: 0,
  };
}

function parseBulkProblemNumbers(input) {
  const tokens = input.split(/[,\s;]+/).map(token => token.trim()).filter(Boolean);
  const seen = new Set();
  const numbers = [];
  const duplicates = [];
  const invalidTokens = [];

  tokens.forEach(token => {
    if (!/^\d+$/.test(token)) {
      invalidTokens.push(token);
      return;
    }

    const number = Number(token);
    if (!Number.isSafeInteger(number) || number <= 0) {
      invalidTokens.push(token);
      return;
    }

    if (seen.has(number)) {
      duplicates.push(number);
      return;
    }

    seen.add(number);
    numbers.push(number);
  });

  return { tokens, numbers, duplicates, invalidTokens };
}

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
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error.includes('already in group')) {
        alert('Problem already exists in this group');
      } else {
        alert(err.response?.data?.error || 'Failed to add problem');
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
    }
  };

  const renderStatusControl = (problemId, memberStatus, targetStatus, isCurrentUser) => {
    const isActive = memberStatus?.status === targetStatus;
    const activeClasses = targetStatus === 'solved'
      ? 'bg-green-500 border-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.3)]'
      : 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300';
    const inactiveClasses = 'bg-white/5 border-white/20 text-transparent hover:border-white/40';
    const staticInactiveClasses = 'bg-transparent border-white/5 text-white/10';

    if (isCurrentUser) {
      const nextStatus = isActive ? 'unsolved' : targetStatus;
      return (
        <button
          className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${isActive ? activeClasses : inactiveClasses}`}
          onClick={() => handleSetStatus(problemId, nextStatus)}
          title={isActive ? `Mark ${targetStatus} off` : `Mark ${targetStatus}`}
        >
          {isActive && (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
        </button>
      );
    }

    return (
      <div className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${isActive ? activeClasses : staticInactiveClasses}`}>
        {isActive ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ) : (
          <div className="w-1.5 h-px bg-white/20"></div>
        )}
      </div>
    );
  };

  const toggleExpandedTopics = (problemId) => {
    setExpandedTopics(prev => ({
      ...prev,
      [problemId]: !prev[problemId],
    }));
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh] text-gray-400">Loading group...</div>;
  if (!group) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-8 space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button 
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4" 
            onClick={() => navigate('/groups')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to Groups
          </button>
          <h1 className="text-3xl font-bold text-white tracking-tight">{group.name}</h1>
          <p className="text-gray-400 mt-2">
            {group.members?.length} members · {group.problems?.length} problems · Created by {group.creator_name}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-medium text-sm text-gray-200" 
            onClick={() => setShowAddMember(true)}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
            Add Member
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-medium text-sm text-gray-200" 
            onClick={() => setShowAddFromProblemset(true)}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            Add From My Problems
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 transition-all font-medium text-sm text-white shadow-lg shadow-indigo-900/20" 
            onClick={() => setShowAddProblem(true)}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Problem
          </button>
          {isGroupCreator && (
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 transition-all font-medium text-sm text-red-300"
              onClick={() => {
                setDeleteConfirmName('');
                setDeleteError('');
                setShowDeleteGroup(true);
              }}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Delete Group
            </button>
          )}
        </div>
      </div>

      {/* Members Bar */}
      <div className="flex flex-wrap gap-3">
        {group.members?.map(m => (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full" key={m.id}>
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold border border-indigo-500/30">
              {m.username.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-300">{m.username}</span>
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
        <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <svg className={`w-4 h-4 transform transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          Advanced Filters
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Sort</span>
          <div className="inline-flex rounded-lg bg-black/40 border border-white/10 p-0.5">
            <button
              onClick={() => setSortBy('number')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${sortBy === 'number' ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-400 hover:text-white'}`}
            >
              Number
            </button>
            <button
              onClick={() => setSortBy('recent')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${sortBy === 'recent' ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-400 hover:text-white'}`}
            >
              Recently solved
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {showAdvancedFilters && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 shadow-lg shadow-black/20 animate-fade-in">
          <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
            Match <span className="bg-black/50 px-2 py-1 rounded text-white border border-white/10">All</span> of the following filters:
          </h3>
          
          <div className="space-y-3">
            {/* Personal Status Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full group">
              <div className="flex items-center gap-2 w-32 flex-shrink-0 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-sm">My Status</span>
              </div>
              <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 w-24 flex-shrink-0">
                <span>is</span>
                <svg className="w-3 h-3 ml-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
              <select 
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-indigo-500 appearance-none bg-no-repeat bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5H7z%22%20fill%3D%22%23ffffff40%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_8px_center] pr-10"
                value={solvedFilter} 
                onChange={e => setSolvedFilter(e.target.value)}
              >
                <option value="">Any Status</option>
                <option value="true">Solved</option>
                <option value="attempted">Attempted</option>
                <option value="false">Unsolved</option>
              </select>
              <button className="p-1.5 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100" onClick={() => setSolvedFilter('')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
              </button>
            </div>
            {/* Group Status Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full group">
              <div className="flex items-center gap-2 w-32 flex-shrink-0 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
                <span className="text-sm">Group Status</span>
              </div>
              <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 w-24 flex-shrink-0">
                <span>is</span>
                <svg className="w-3 h-3 ml-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
              <select 
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-indigo-500 appearance-none bg-no-repeat bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5H7z%22%20fill%3D%22%23ffffff40%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_8px_center] pr-10"
                value={groupStatusFilter} 
                onChange={e => setGroupStatusFilter(e.target.value)}
              >
                <option value="">Any Group Status</option>
                <option value="true">Solved by Anyone</option>
                <option value="false">Unsolved by All</option>
              </select>
              <button className="p-1.5 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100" onClick={() => setGroupStatusFilter('')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
              </button>
            </div>

            {/* Difficulty Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full group">
              <div className="flex items-center gap-2 w-32 flex-shrink-0 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-sm">Difficulty</span>
              </div>
              <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 w-24 flex-shrink-0">
                <span>is</span>
                <svg className="w-3 h-3 ml-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
              <select 
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-indigo-500 appearance-none bg-no-repeat bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5H7z%22%20fill%3D%22%23ffffff40%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_8px_center] pr-10"
                value={difficultyFilter} 
                onChange={e => setDifficultyFilter(e.target.value)}
              >
                <option value="">Any Difficulty</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
              <button className="p-1.5 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100" onClick={() => setDifficultyFilter('')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
              </button>
            </div>

            {/* Topics Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full group">
              <div className="flex items-center gap-2 w-32 flex-shrink-0 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                </svg>
                <span className="text-sm">Topic</span>
              </div>
              <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 w-24 flex-shrink-0">
                <span>is</span>
                <svg className="w-3 h-3 ml-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
              <select 
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-indigo-500 appearance-none bg-no-repeat bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5H7z%22%20fill%3D%22%23ffffff40%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_8px_center] pr-10"
                value={activePattern === 'all' ? '' : activePattern} 
                onChange={e => setActivePattern(e.target.value || 'all')}
              >
                <option value="">Any Topic</option>
                {patterns.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button className="p-1.5 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100" onClick={() => setActivePattern('all')}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
              </button>
            </div>

          </div>
          
          <div className="mt-6 flex justify-end items-center border-t border-white/10 pt-4">
            <button 
              className="text-gray-400 hover:text-white font-medium text-sm flex items-center gap-2 transition-colors"
              onClick={() => { setDifficultyFilter(''); setSolvedFilter(''); setGroupStatusFilter(''); setActivePattern('all'); }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Group Problem Table */}
      {filteredProblems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-12 flex flex-col items-center justify-center text-center">
          <svg className="w-16 h-16 text-gray-600 mb-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <h3 className="text-xl font-semibold text-white mb-2">{activePattern === 'all' ? 'No problems in this group' : `No "${activePattern}" problems`}</h3>
          <p className="text-gray-400">{activePattern === 'all' ? 'Add problems to start tracking progress together!' : 'Try selecting a different pattern.'}</p>
        </div>
      ) : (
        <>
          <div className="md:hidden space-y-4">
            {visibleProblems.map((p) => {
              const myStatus = p.member_statuses?.find(ms => ms.user_id === user?.id)?.status || 'unsolved';
              const hasExpandedTopics = expandedTopics[p.id];

              return (
                <div
                  className={`rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-4 space-y-4 ${myStatus === 'solved' ? 'bg-green-500/[0.03]' : myStatus === 'attempted' ? 'bg-yellow-500/[0.03]' : ''}`}
                  key={p.leetcode_number}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-xs text-gray-500 mb-1">#{p.leetcode_number}</div>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-100 hover:text-indigo-400 transition-colors block">
                        {p.title}
                      </a>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase border inline-block ${
                      p.difficulty === 'Easy' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      p.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {p.difficulty}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <TopicTags
                      topics={p.topics || []}
                      expanded={hasExpandedTopics}
                      onToggle={() => toggleExpandedTopics(p.id)}
                      emptyLabel="No topics"
                    />
                  </div>

                  <div className="space-y-3">
                    {p.member_statuses?.map(ms => (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5" key={ms.user_id}>
                        <span className="text-sm font-medium text-gray-200 truncate">{ms.username}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 uppercase">A</span>
                          {renderStatusControl(p.id, ms, 'attempted', ms.user_id === user?.id)}
                          <span className="ml-2 text-[10px] text-gray-500 uppercase">S</span>
                          {renderStatusControl(p.id, ms, 'solved', ms.user_id === user?.id)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md overflow-x-auto">
            <div className="min-w-max">
              {/* Table Header */}
              <div className="flex p-4 border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-white/5">
                <span className="w-16 flex-shrink-0">#</span>
                <span className="w-64 flex-shrink-0">Problem</span>
                <span className="w-32 flex-shrink-0">Difficulty</span>
                <span className="min-w-[140px] flex-1 pr-6">Topics</span>
                <div className="flex flex-none justify-end gap-6 pl-6">
                  {group.members?.map(m => (
                    <div className="w-24 flex-shrink-0 text-center" key={m.id} title={m.username}>
                      <div className="truncate">{m.username.substring(0, 5)}</div>
                      <div className="mt-1 flex justify-center gap-3 text-[10px] text-gray-500">
                        <span className="w-6 text-center">A</span>
                        <span className="w-6 text-center">S</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Table Body */}
              <div className="divide-y divide-white/5">
                {visibleProblems.map((p) => {
                  const myStatus = p.member_statuses?.find(ms => ms.user_id === user?.id)?.status || 'unsolved';
                  const hasExpandedTopics = expandedTopics[p.id];

                  return (
                  <div 
                    className={`flex p-4 items-center transition-all duration-200 hover:bg-white/5 ${myStatus === 'solved' ? 'bg-green-500/[0.02]' : myStatus === 'attempted' ? 'bg-yellow-500/[0.02]' : ''}`}
                    key={p.leetcode_number}
                  >
                    <span className="w-16 flex-shrink-0 font-mono text-gray-500 text-sm">#{p.leetcode_number}</span>
                    <span className="w-64 flex-shrink-0 truncate pr-4">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-200 hover:text-indigo-400 transition-colors title-link">
                        {p.title}
                      </a>
                    </span>
                    <span className="w-32 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase border inline-block ${
                        p.difficulty === 'Easy' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        p.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {p.difficulty}
                      </span>
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
          </div>

          {hasMoreProblems && (
            <div className="flex flex-col items-center gap-2 pt-2">
              <button
                onClick={() => setVisibleCount(count => count + PROBLEMS_PAGE_SIZE)}
                className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all font-medium text-sm text-gray-200"
              >
                Show more
              </button>
              <span className="text-xs text-gray-500">
                Showing {visibleProblems.length} of {filteredProblems.length}
              </span>
            </div>
          )}
        </>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowAddMember(false); setError(''); }}>
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6">Add Member</h2>
            {error && <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter LeetTracker username..."
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-gray-600"
                onKeyDown={e => e.key === 'Enter' && handleAddMember()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors" onClick={() => { setShowAddMember(false); setError(''); }}>Cancel</button>
              <button className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-gray-200 transition-colors" onClick={handleAddMember} disabled={!username.trim()}>Add</button>
            </div>
          </div>
        </div>
      )}

      <AddFromProblemsetModal
        isOpen={showAddFromProblemset}
        onClose={() => setShowAddFromProblemset(false)}
        onAddProblem={handleAddFromProblemset}
        onAddProblems={handleAddMultipleFromProblemset}
        existingProblems={group.problems || []}
      />

      {/* Add Problem Modal */}
      {showAddProblem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4" onClick={resetProblemModal}>
          <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl relative max-h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-white/10 flex-shrink-0">
              <h2 className="text-xl font-bold text-white">Add Problem to Group</h2>
              <button
                type="button"
                onClick={resetProblemModal}
                disabled={isBulkAdding}
                className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/40 border border-white/10 p-1">
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    addMode === 'single'
                      ? 'bg-white text-black shadow'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  } ${isBulkAdding ? 'cursor-not-allowed opacity-60' : ''}`}
                  onClick={() => {
                    if (isBulkAdding) return;
                    setAddMode('single');
                    setBulkError('');
                  }}
                  disabled={isBulkAdding}
                >
                  Single
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    addMode === 'bulk'
                      ? 'bg-white text-black shadow'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  } ${isBulkAdding ? 'cursor-not-allowed opacity-60' : ''}`}
                  onClick={() => {
                    if (isBulkAdding) return;
                    setAddMode('bulk');
                    setError('');
                  }}
                  disabled={isBulkAdding}
                >
                  Bulk
                </button>
              </div>

              {addMode === 'single' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Search Title or #</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="e.g. Two Sum..."
                        className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white pl-10 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-gray-600"
                        autoComplete="off"
                      />
                      <svg className="w-5 h-5 absolute left-3 top-3 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                      </svg>
                      {isSearching && <span className="absolute right-3 top-2.5 text-indigo-400">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </span>}
                    </div>
                    
                    {searchResults.length > 0 && (
                      <div className="absolute left-5 right-5 mt-1 bg-neutral-800 border border-white/10 rounded-lg shadow-xl overflow-hidden z-20 max-h-60 overflow-y-auto">
                        {searchResults.map(res => (
                          <div 
                            key={res.number} 
                            className="flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0"
                            onClick={() => handleSelectProblem(res)}
                          >
                            <span className="text-gray-500 font-mono text-xs w-8">#{res.number}</span>
                            <span className="font-medium text-gray-200 flex-1 truncate">{res.title}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              res.difficulty === 'Easy' ? 'bg-blue-500/10 text-blue-400' : 
                              res.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400' : 
                              'bg-red-500/10 text-red-400'
                            }`}>{res.difficulty}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

                  {preview && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-4">
                      <div className="font-medium text-white mb-2">{preview.title}</div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          preview.difficulty === 'Easy' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                          preview.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        } border`}>{preview.difficulty}</span>
                        {preview.topics && preview.topics.map(t => (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20" key={t}>{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {addMode === 'bulk' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">LeetCode Question Numbers</label>
                    <textarea
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
                      className="w-full resize-none bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-gray-600 disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  {bulkInput.trim() && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                        <div className="text-base font-bold text-white">{bulkParseResult.numbers.length}</div>
                        <div className="text-[11px] uppercase tracking-wide text-gray-500">Unique</div>
                      </div>
                      <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                        <div className="text-base font-bold text-yellow-400">{bulkParseResult.duplicates.length}</div>
                        <div className="text-[11px] uppercase tracking-wide text-gray-500">Duplicates</div>
                      </div>
                      <div className="rounded-xl bg-white/5 border border-white/10 p-2.5">
                        <div className="text-base font-bold text-red-400">{bulkParseResult.invalidTokens.length}</div>
                        <div className="text-[11px] uppercase tracking-wide text-gray-500">Invalid</div>
                      </div>
                    </div>
                  )}

                  {bulkError && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{bulkError}</div>}

                  {(bulkProgress.total > 0 || bulkResults.length > 0) && (
                    <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-3">
                      {bulkProgress.total > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-white">
                              {isBulkAdding ? 'Adding problems...' : 'Bulk add complete'}
                            </span>
                            <span className="text-gray-400">{bulkProgress.completed} / {bulkProgress.total}</span>
                          </div>
                          <div className="h-2 rounded-full bg-black/50 border border-white/10 overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 transition-all duration-300"
                              style={{ width: `${bulkCompletionPercent}%` }}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-2 py-2 text-green-400">
                              {bulkProgress.added} added
                            </div>
                            <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-2 py-2 text-yellow-400">
                              {bulkProgress.skipped} in group
                            </div>
                            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-2 py-2 text-red-400">
                              {bulkProgress.failed} failed
                            </div>
                          </div>
                        </div>
                      )}

                      {bulkResults.length > 0 && (
                        <div className="max-h-32 overflow-y-auto divide-y divide-white/5 rounded-lg border border-white/10 bg-black/30">
                          {bulkResults.map((result, index) => {
                            const isGood = result.status === 'added';
                            const isWarning = result.status === 'skipped' || result.status === 'duplicate';
                            const badgeClass = isGood
                              ? 'bg-green-500/10 text-green-400 border-green-500/20'
                              : isWarning
                                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                : 'bg-red-500/10 text-red-400 border-red-500/20';
                            const statusLabel = result.status === 'added'
                              ? 'Added'
                              : result.status === 'skipped'
                                ? 'In group'
                                : result.status === 'duplicate'
                                  ? 'Duplicate'
                                  : result.status === 'invalid'
                                    ? 'Invalid'
                                    : 'Failed';
                            const label = result.number ? `#${result.number}` : result.token;

                            return (
                              <div key={`${result.status}-${label}-${index}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                                <span className="font-mono text-gray-500 w-16 flex-shrink-0 truncate">{label}</span>
                                <span className="text-gray-300 flex-1 min-w-0 truncate">{result.title || result.message}</span>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${badgeClass}`}>
                                  {statusLabel}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-3 px-5 py-4 border-t border-white/10 bg-neutral-900 flex-shrink-0">
              <button
                className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={resetProblemModal}
                disabled={isBulkAdding}
              >
                {addMode === 'bulk' && bulkProgress.completed > 0 && !isBulkAdding ? 'Close' : 'Cancel'}
              </button>
              {addMode === 'single' ? (
                <button 
                  className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                  onClick={handleAddProblem} 
                  disabled={!preview}
                >
                  Add Problem
                </button>
              ) : (
                <button
                  className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-32"
                  onClick={handleBulkAddProblems}
                  disabled={isBulkAdding || bulkParseResult.numbers.length === 0}
                >
                  {isBulkAdding && (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {isBulkAdding ? 'Adding...' : 'Add Problems'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Modal */}
      {showDeleteGroup && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => {
            if (isDeletingGroup) return;
            setShowDeleteGroup(false);
            setDeleteConfirmName('');
            setDeleteError('');
          }}
        >
          <div className="bg-neutral-900 border border-red-500/20 rounded-2xl p-6 w-full max-w-md shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-3">Delete Group</h2>
            <p className="text-sm text-gray-400 mb-5">
              This will permanently delete <span className="font-semibold text-white">{group.name}</span> for every member, including all group membership and problem entries.
            </p>

            {deleteError && (
              <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {deleteError}
              </div>
            )}

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-300">
                Type <span className="font-mono text-white">{group.name}</span> to confirm.
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={e => {
                  setDeleteConfirmName(e.target.value);
                  setDeleteError('');
                }}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none transition-all placeholder-gray-600"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button
                className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
                onClick={() => {
                  setShowDeleteGroup(false);
                  setDeleteConfirmName('');
                  setDeleteError('');
                }}
                disabled={isDeletingGroup}
              >
                Cancel
              </button>
              <button
                className="px-5 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDeleteGroup}
                disabled={deleteConfirmName !== group.name || isDeletingGroup}
              >
                {isDeletingGroup ? 'Deleting...' : 'Delete Group'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
