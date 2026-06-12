import { useState, useEffect, useCallback } from 'react';
import { syncLeetcode, importLeetcode } from '@/features/problems/services/problemsApi';
import { updateLeetcodeUsername } from '@/features/auth/services/authApi';
import { listGroups } from '@/features/groups/services/groupsApi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { CONSOLE_SCRIPT } from '@/features/problems/constants/consoleScript';
import { toast } from '@/shared/ui/use-toast';

const STORAGE_KEY = 'syncTargetGroups';

const loadSavedGroupIds = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveSyncGroupIds = (ids) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
};

const parseImportPayload = (raw) => {
  const parsed = JSON.parse(raw.trim());
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');

  let payload;
  if ('solvedMap' in parsed || 'attemptedMap' in parsed) {
    payload = {
      solvedMap: parsed.solvedMap && typeof parsed.solvedMap === 'object' && !Array.isArray(parsed.solvedMap)
        ? parsed.solvedMap
        : {},
      attemptedMap: parsed.attemptedMap && typeof parsed.attemptedMap === 'object' && !Array.isArray(parsed.attemptedMap)
        ? parsed.attemptedMap
        : {},
    };
  } else {
    payload = { solvedMap: parsed, attemptedMap: {} };
  }

  if (Object.keys(payload.solvedMap).length === 0 && Object.keys(payload.attemptedMap).length === 0) {
    throw new Error('empty');
  }
  return payload;
};

// Drives the LeetCode import wizard: step machine, group-target selection
// (persisted to localStorage), the instant-sync and advanced-import requests.
// The dialog only renders the step this returns.
export const useLeetCodeImport = ({ onSuccess, onCancel } = {}) => {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(0); // 0: select, 1-3: advanced, 4: success, 5: instant setup
  const [importMethod, setImportMethod] = useState(null); // 'instant' | 'advanced'
  const [pastedData, setPastedData] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [tempUsername, setTempUsername] = useState(user?.leetcodeUsername || '');

  const [userGroups, setUserGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedGroupIds, setSelectedGroupIds] = useState(() => loadSavedGroupIds());
  const [showGroupConfig, setShowGroupConfig] = useState(false);

  useEffect(() => {
    listGroups()
      .then(res => {
        setUserGroups(res.data || []);
        const validIds = new Set((res.data || []).map(g => g.id));
        setSelectedGroupIds(prev => {
          const pruned = prev.filter(id => validIds.has(id));
          saveSyncGroupIds(pruned);
          return pruned;
        });
      })
      .catch(() => setUserGroups([]))
      .finally(() => setGroupsLoading(false));
  }, []);

  const toggleGroup = useCallback((groupId) => {
    setSelectedGroupIds(prev => {
      const next = prev.includes(groupId)
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId];
      saveSyncGroupIds(next);
      return next;
    });
  }, []);

  const toggleAllGroups = useCallback(() => {
    setSelectedGroupIds(prev => {
      const next = prev.length === userGroups.length ? [] : userGroups.map(g => g.id);
      saveSyncGroupIds(next);
      return next;
    });
  }, [userGroups]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(CONSOLE_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onPasteChange = (value) => {
    setPastedData(value);
    setError('');
  };

  const handleInstantSync = async (usernameToUse = tempUsername) => {
    const normalizedUsername = usernameToUse.trim();
    if (!normalizedUsername) {
      setError('Please enter your LeetCode username');
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (normalizedUsername !== user?.leetcodeUsername) {
        await updateLeetcodeUsername(normalizedUsername);
        updateUser({ ...user, leetcodeUsername: normalizedUsername });
      }

      const resp = await syncLeetcode({ groupIds: selectedGroupIds });
      const {
        newlyImported,
        attemptedImported = 0,
        alreadyTracked,
        totalFound,
        failed = 0,
        totalSolvedOnLeetCode = 0,
        recentSolvedFound = 0,
        recentAttemptedFound = 0,
        bestEffortAttempted = false,
        groupsUpdated = 0,
        groupsFailed = 0,
      } = resp.data;

      setResult({
        mode: 'recent-sync',
        solved: newlyImported,
        attempted: attemptedImported,
        alreadyExists: alreadyTracked,
        failed,
        total: totalFound,
        totalSolvedOnLeetCode,
        recentSolvedFound,
        recentAttemptedFound,
        bestEffortAttempted,
        groupsUpdated,
        groupsFailed,
      });
      setStep(4);
      toast({ title: 'Sync complete', description: `${newlyImported} solved problem${newlyImported === 1 ? '' : 's'} imported.`, variant: 'success' });
      if (onSuccess) onSuccess();
    } catch (err) {
      setStep(5);
      setError(err.response?.data?.error || 'Sync failed. Check your username and privacy settings on LeetCode.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setError('');
    setLoading(true);

    let importPayload;
    try {
      importPayload = parseImportPayload(pastedData);
    } catch {
      setError('Invalid data. Make sure you pasted the full output from the console script.');
      setLoading(false);
      return;
    }

    try {
      const resp = await importLeetcode({ ...importPayload, groupIds: selectedGroupIds });
      setResult({
        ...resp.data,
        mode: 'advanced-import',
        groupsUpdated: resp.data.groupsUpdated || 0,
        groupsFailed: resp.data.groupsFailed || 0,
      });
      setStep(4);
      toast({ title: 'Import complete', description: 'Your LeetCode history has been imported.', variant: 'success' });
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectInstant = () => {
    setImportMethod('instant');
    if (user?.leetcodeUsername) handleInstantSync(user.leetcodeUsername);
    else setStep(5);
  };

  const selectAdvanced = () => {
    setImportMethod('advanced');
    setStep(1);
  };

  const restart = () => {
    setStep(0);
    setImportMethod(null);
    setPastedData('');
    setResult(null);
  };

  return {
    step,
    setStep,
    importMethod,
    error,
    loading,
    result,
    copied,
    handleCopyScript,
    pastedData,
    onPasteChange,
    tempUsername,
    setTempUsername,
    // groups
    userGroups,
    groupsLoading,
    selectedGroupIds,
    selectedCount: selectedGroupIds.length,
    showGroupConfig,
    setShowGroupConfig,
    toggleGroup,
    toggleAllGroups,
    // navigation / actions
    selectInstant,
    selectAdvanced,
    handleInstantSync,
    handleImport,
    restart,
    onCancel,
  };
};
