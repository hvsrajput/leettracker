import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getGroup,
  addGroupMember,
  addProblemToGroup,
  bulkAddProblemsToGroup,
  deleteGroup,
} from '@/features/groups/services/groupsApi';
import { updateProblemStatus } from '@/features/problems/services/problemsApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getProblemTopics } from '@/shared/lib/problemFilters';
import { toast } from '@/shared/ui/use-toast';

const PROBLEMS_PAGE_SIZE = 20;
const STATUS_RANK = { solved: 2, attempted: 1, unsolved: 0 };

// Owns everything the GroupDetail page needs: the group itself, its filtered/
// sorted problem list with pagination, the per-member status mutations, member
// invites, and group deletion. The page only renders.
export const useGroupDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedTopics, setExpandedTopics] = useState({});

  // Member invite.
  const [showAddMember, setShowAddMember] = useState(false);
  const [username, setUsername] = useState('');
  const [memberError, setMemberError] = useState('');

  // Add-from-problemset modal.
  const [showAddFromProblemset, setShowAddFromProblemset] = useState(false);

  // Filters / sort / pagination.
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [activePattern, setActivePattern] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [solvedFilter, setSolvedFilter] = useState('');
  const [groupStatusFilter, setGroupStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('number');
  const [visibleCount, setVisibleCount] = useState(PROBLEMS_PAGE_SIZE);

  // Delete group.
  const [showDeleteGroup, setShowDeleteGroup] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);

  const fetchGroup = useCallback(() => {
    return getGroup(id)
      .then(res => setGroup(res.data))
      .catch(() => navigate('/groups'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  const patterns = useMemo(() => getProblemTopics(group?.problems || []), [group]);

  const myStatusOf = useCallback(
    (problem) => problem.member_statuses?.find(ms => ms.user_id === user?.id),
    [user]
  );

  const filteredProblems = useMemo(() => {
    if (!group?.problems) return [];

    const filtered = group.problems.filter(p => {
      const matchPattern = activePattern === 'all' ||
                           (p.topics?.includes(activePattern) || p.pattern_name === activePattern);
      if (!matchPattern) return false;

      if (difficultyFilter && p.difficulty !== difficultyFilter) return false;

      if (solvedFilter) {
        const myStatus = myStatusOf(p)?.status || 'unsolved';
        if (solvedFilter === 'true' && myStatus !== 'solved') return false;
        if (solvedFilter === 'false' && myStatus !== 'unsolved') return false;
        if (solvedFilter === 'attempted' && myStatus !== 'attempted') return false;
      }

      if (groupStatusFilter) {
        const anySolved = p.member_statuses?.some(ms => ms.solved);
        if (groupStatusFilter === 'true' && !anySolved) return false;
        if (groupStatusFilter === 'false' && anySolved) return false;
      }

      return true;
    });

    if (sortBy === 'recent') {
      const mySolvedAt = (p) => {
        const m = myStatusOf(p);
        return m?.solvedAt ? new Date(m.solvedAt).getTime() : 0;
      };
      filtered.sort((a, b) => {
        const diff = mySolvedAt(b) - mySolvedAt(a);
        if (diff !== 0) return diff;
        const rankDiff = (STATUS_RANK[myStatusOf(b)?.status] ?? 0) - (STATUS_RANK[myStatusOf(a)?.status] ?? 0);
        if (rankDiff !== 0) return rankDiff;
        return a.leetcode_number - b.leetcode_number;
      });
    } else {
      filtered.sort((a, b) => a.leetcode_number - b.leetcode_number);
    }

    return filtered;
  }, [group, myStatusOf, activePattern, difficultyFilter, solvedFilter, groupStatusFilter, sortBy]);

  // Reset pagination whenever the filter/sort selection changes. Done during
  // render (not in an effect) so it collapses into the same render pass.
  const filterKey = `${activePattern}|${difficultyFilter}|${solvedFilter}|${groupStatusFilter}|${sortBy}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(PROBLEMS_PAGE_SIZE);
  }

  const visibleProblems = useMemo(
    () => filteredProblems.slice(0, visibleCount),
    [filteredProblems, visibleCount]
  );
  const hasMoreProblems = visibleCount < filteredProblems.length;
  const isGroupCreator = group?.created_by === user?.id;

  const upsertGroupProblem = useCallback((problem, currentUserStatus = 'unsolved') => {
    setGroup(prev => {
      if (!prev) return prev;

      const normalizedProblem = {
        ...problem,
        member_statuses: prev.members.map(member => {
          const existingStatus = problem.member_statuses?.find(status => status.user_id === member.id);
          if (existingStatus) return existingStatus;

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

      return { ...prev, problems: nextProblems };
    });
  }, [user]);

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

  const handleSetStatus = async (problemId, nextStatus) => {
    try {
      await updateProblemStatus(problemId, nextStatus);
      updateCurrentUserStatus(problemId, nextStatus);
    } catch (err) {
      console.error(err);
      toast({ title: 'Failed to update status', variant: 'destructive' });
    }
  };

  const toggleExpandedTopics = (problemId) => {
    setExpandedTopics(prev => ({ ...prev, [problemId]: !prev[problemId] }));
  };

  const resetFilters = () => {
    setDifficultyFilter('');
    setSolvedFilter('');
    setGroupStatusFilter('');
    setActivePattern('all');
  };

  const showMore = () => setVisibleCount(count => count + PROBLEMS_PAGE_SIZE);

  const openAddMember = () => { setShowAddMember(true); };

  const closeAddMember = () => {
    setShowAddMember(false);
    setMemberError('');
  };

  const handleAddMember = async () => {
    const name = username.trim();
    if (!name) return;
    setMemberError('');
    try {
      await addGroupMember(id, name);
      toast({ title: 'Member added', description: name, variant: 'success' });
      setUsername('');
      setShowAddMember(false);
      fetchGroup();
    } catch (err) {
      setMemberError(err.response?.data?.error || 'Failed to add member');
    }
  };

  const handleAddFromProblemset = async (problem) => {
    try {
      const res = await addProblemToGroup(id, problem.id);
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
          const res = await addProblemToGroup(id, problem.id);
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
      const res = await bulkAddProblemsToGroup(id, problemsToAdd.map((problem) => problem.id));
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

    return { addedCount: succeeded.length, failedCount };
  };

  const openDeleteGroup = () => {
    setDeleteConfirmName('');
    setDeleteError('');
    setShowDeleteGroup(true);
  };

  const closeDeleteGroup = () => {
    if (isDeletingGroup) return;
    setShowDeleteGroup(false);
    setDeleteConfirmName('');
    setDeleteError('');
  };

  const handleDeleteGroup = async () => {
    if (!group || deleteConfirmName !== group.name || isDeletingGroup) return;
    setDeleteError('');
    setIsDeletingGroup(true);
    try {
      await deleteGroup(id, deleteConfirmName);
      toast({ title: 'Group deleted', description: group.name });
      navigate('/groups');
    } catch (err) {
      setDeleteError(err.response?.data?.error || 'Failed to delete group');
      setIsDeletingGroup(false);
    }
  };

  return {
    // identity
    groupId: id,
    userId: user?.id,
    group,
    loading,
    isGroupCreator,
    fetchGroup,
    navigate,
    // problem list
    patterns,
    filteredProblems,
    visibleProblems,
    hasMoreProblems,
    expandedTopics,
    toggleExpandedTopics,
    handleSetStatus,
    upsertGroupProblem,
    showMore,
    // filters
    showAdvancedFilters,
    setShowAdvancedFilters,
    activePattern,
    setActivePattern,
    difficultyFilter,
    setDifficultyFilter,
    solvedFilter,
    setSolvedFilter,
    groupStatusFilter,
    setGroupStatusFilter,
    sortBy,
    setSortBy,
    resetFilters,
    // member invite
    showAddMember,
    openAddMember,
    closeAddMember,
    username,
    setUsername,
    memberError,
    handleAddMember,
    // add from problemset
    showAddFromProblemset,
    setShowAddFromProblemset,
    handleAddFromProblemset,
    handleAddMultipleFromProblemset,
    // delete group
    showDeleteGroup,
    openDeleteGroup,
    closeDeleteGroup,
    deleteConfirmName,
    setDeleteConfirmName,
    deleteError,
    isDeletingGroup,
    handleDeleteGroup,
  };
};
