import { useState, useRef, useEffect, useMemo } from 'react';
import { searchProblems } from '@/features/problems/services/problemsApi';
import {
  parseBulkProblemNumbers,
  createEmptyBulkProgress,
} from '@/shared/components/StatusControls';

const DEFAULT_CONCURRENCY = 3;

// Drives the "Add Problem" dialog shared by the Problems page and a group: the
// debounced single search/preview and the concurrent bulk-add orchestration.
// What it does NOT own is where a problem is committed — the caller injects:
//   commitSingle(preview)        -> resolves on success, throws Error(message) on failure
//   commitBulkItem(number)       -> resolves to { status, number, title?, message }
//   onBulkComplete()             -> optional, awaited once every item is processed
// so the same flow serves "add to my list" and "add to this group" unchanged.
export const useAddProblemFlow = ({
  commitSingle,
  commitBulkItem,
  onBulkComplete,
  concurrency = DEFAULT_CONCURRENCY,
} = {}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState('single');

  // Single-add state.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState(null);
  const [addError, setAddError] = useState('');
  const searchTimeoutRef = useRef(null);

  // Bulk-add state.
  const [bulkInput, setBulkInput] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [isBulkAdding, setIsBulkAdding] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(() => createEmptyBulkProgress());
  const [bulkResults, setBulkResults] = useState([]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const bulkParseResult = useMemo(() => parseBulkProblemNumbers(bulkInput), [bulkInput]);
  const bulkCompletionPercent = bulkProgress.total > 0
    ? Math.round((bulkProgress.completed / bulkProgress.total) * 100)
    : 0;

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

  const openAddModal = () => setShowAddModal(true);

  const closeAddModal = () => {
    if (isBulkAdding) return;
    setShowAddModal(false);
    resetAddModalState();
  };

  const switchAddMode = (mode) => {
    setAddMode(mode);
    if (mode === 'single') setBulkError('');
    else setAddError('');
  };

  const updateBulkInput = (value) => {
    setBulkInput(value);
    setBulkError('');
    setBulkResults([]);
    setBulkProgress(createEmptyBulkProgress());
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
        const res = await searchProblems(query);
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
      await commitSingle(preview);
      closeAddModal();
    } catch (err) {
      setAddError(err?.message || 'Failed to add problem');
    }
  };

  const recordBulkResult = (result) => {
    setBulkResults(prev => [...prev, result]);
    setBulkProgress(prev => {
      const next = { ...prev, completed: prev.completed + 1 };
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
      ...duplicates.map(number => ({ status: 'duplicate', number, message: 'Duplicate in input' })),
      ...invalidTokens.map(token => ({ status: 'invalid', token, message: 'Invalid number' })),
    ];

    setAddError('');
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
          const result = await commitBulkItem(number);
          recordBulkResult(result);
        } catch (err) {
          recordBulkResult({
            status: 'failed',
            number,
            message: err?.message || 'Failed to add problem',
          });
        }
      }
    };

    try {
      const workerCount = Math.min(concurrency, numbers.length);
      await Promise.all(Array.from({ length: workerCount }, addNextProblem));
      if (onBulkComplete) await onBulkComplete();
    } finally {
      setIsBulkAdding(false);
    }
  };

  return {
    showAddModal,
    openAddModal,
    closeAddModal,
    addMode,
    switchAddMode,
    // single
    searchQuery,
    searchResults,
    isSearching,
    preview,
    addError,
    handleSearch,
    handleSelectProblem,
    handleAddProblem,
    // bulk
    bulkInput,
    updateBulkInput,
    bulkError,
    isBulkAdding,
    bulkProgress,
    bulkResults,
    bulkParseResult,
    bulkCompletionPercent,
    handleBulkAddProblems,
  };
};
