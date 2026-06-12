import { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  FileCode2,
  Users,
  ChevronDown,
  Check,
  Minus,
  Loader2,
  AlertCircle,
  CheckCheck,
  ArrowLeft,
  ArrowRight,
  Copy,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { toast } from './ui/use-toast';

const STORAGE_KEY = 'syncTargetGroups';

function loadSavedGroupIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSyncGroupIds(ids) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

const CONSOLE_SCRIPT = `(async () => {
  console.log('LeetTracker: Fetching solved and attempted problems...');

  const apiResp = await fetch('/api/problems/all/', {
    headers: { 'Content-Type': 'application/json' }
  });
  const apiJson = await apiResp.json();

  if (!apiJson.stat_status_pairs) {
    console.error('LeetTracker: Failed to fetch problems. Are you logged in?');
    return;
  }

  const allSlugs = new Set(
    apiJson.stat_status_pairs
      .filter(p => p.status === 'ac')
      .map(p => p.stat.question__title_slug)
  );
  console.log(\`LeetTracker: Found \${allSlugs.size} solved problems.\`);

  const subQuery = \`query submissionList($offset: Int!, $limit: Int!) {
    submissionList(offset: $offset, limit: $limit) {
      hasNext submissions { titleSlug statusDisplay timestamp }
    }
  }\`;

  const solvedDateMap = {};
  const attemptedDateMap = {};
  let offset = 0, hasNext = true, page = 1;

  while (hasNext) {
    console.log(\`LeetTracker: Fetching dates page \${page}...\`);
    const resp = await fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: subQuery, variables: { offset, limit: 50 } })
    });
    const json = await resp.json();
    const list = json?.data?.submissionList;
    if (!list) break;

    for (const sub of list.submissions) {
      if (!sub?.titleSlug) continue;

      if (sub.statusDisplay === 'Accepted') {
        if (!solvedDateMap[sub.titleSlug]) {
          solvedDateMap[sub.titleSlug] = sub.timestamp;
        }
      } else if (!attemptedDateMap[sub.titleSlug]) {
        attemptedDateMap[sub.titleSlug] = sub.timestamp;
      }
    }

    hasNext = list.hasNext;
    offset += 50;
    page++;
    if (hasNext) await new Promise(r => setTimeout(r, 400));
  }

  const fallbackTs = Math.floor(Date.now() / 1000).toString();
  const solvedMap = {};
  for (const slug of allSlugs)
    solvedMap[slug] = solvedDateMap[slug] || fallbackTs;

  const attemptedMap = {};
  for (const [slug, timestamp] of Object.entries(attemptedDateMap))
    if (!allSlugs.has(slug))
      attemptedMap[slug] = timestamp || fallbackTs;

  const withDates = Object.values(solvedMap).filter(t => t !== fallbackTs).length;
  console.log(\`LeetTracker: \${withDates}/\${allSlugs.size} have exact dates. Rest use today as fallback.\`);
  console.log(\`LeetTracker: Found \${Object.keys(attemptedMap).length} attempted-only problems.\`);

  const importPayload = {
    solvedMap,
    attemptedMap
  };

  // Prepare final JSON (pretty)
  const finalJson = JSON.stringify(importPayload, null, 2);

  // 1) Try modern clipboard API
  let copied = false;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(finalJson);
      console.log('LeetTracker: Successfully copied JSON to clipboard (navigator.clipboard).');
      copied = true;
    } catch (err) {
      console.warn('LeetTracker: navigator.clipboard failed:', err);
      copied = false;
    }
  }

  // 2) Fallback to document.execCommand copy attempt
  if (!copied) {
    try {
      const ta = document.createElement('textarea');
      ta.value = finalJson;
      // keep off-screen
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) {
        console.log('LeetTracker: Successfully copied JSON to clipboard (execCommand).');
        copied = true;
      } else {
        console.warn('LeetTracker: execCommand copy returned false.');
      }
    } catch (err) {
      console.warn('LeetTracker: execCommand copy failed:', err);
    }
  }

  // 3) ALWAYS print to console for visibility
  console.log('LeetTracker: Final import JSON (copy manually if needed):');
  console.log(finalJson);

  // 4) Create visible panel with textarea + buttons so user can manually copy/select
  (function createCopyPanel() {
    // Avoid creating multiple panels if script run multiple times
    if (document.getElementById('leettracker-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'leettracker-panel';
    panel.style.position = 'fixed';
    panel.style.right = '12px';
    panel.style.bottom = '12px';
    panel.style.width = '420px';
    panel.style.maxWidth = 'calc(100% - 24px)';
    panel.style.zIndex = 999999;
    panel.style.background = 'white';
    panel.style.border = '1px solid rgba(0,0,0,0.12)';
    panel.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
    panel.style.borderRadius = '8px';
    panel.style.padding = '10px';
    panel.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial';
    panel.style.fontSize = '12px';
    panel.style.color = '#111';

    const title = document.createElement('div');
    title.textContent = 'LeetTracker — import JSON';
    title.style.fontWeight = '600';
    title.style.marginBottom = '8px';
    panel.appendChild(title);

    const ta = document.createElement('textarea');
    ta.value = finalJson;
    ta.readOnly = true;
    ta.style.width = '100%';
    ta.style.height = '200px';
    ta.style.resize = 'vertical';
    ta.style.fontFamily = 'monospace';
    ta.style.fontSize = '11px';
    ta.style.lineHeight = '1.2';
    ta.style.padding = '8px';
    ta.style.boxSizing = 'border-box';
    panel.appendChild(ta);

    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.marginTop = '8px';
    btnRow.style.justifyContent = 'flex-end';

    const selectBtn = document.createElement('button');
    selectBtn.textContent = 'Select all';
    selectBtn.onclick = () => {
      ta.focus();
      ta.select();
    };
    selectBtn.style.cursor = 'pointer';
    selectBtn.style.padding = '6px 8px';
    selectBtn.style.borderRadius = '6px';
    selectBtn.style.border = '1px solid rgba(0,0,0,0.12)';
    selectBtn.style.background = '#fff';

    const copyBtn = document.createElement('button');
    copyBtn.textContent = copied ? 'Copied' : 'Copy to clipboard';
    copyBtn.style.cursor = 'pointer';
    copyBtn.style.padding = '6px 8px';
    copyBtn.style.borderRadius = '6px';
    copyBtn.style.border = '1px solid rgba(0,0,0,0.12)';
    copyBtn.style.background = copied ? '#e6ffe6' : '#fff';
    copyBtn.onclick = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(ta.value);
        } else {
          ta.select();
          document.execCommand('copy');
        }
        copyBtn.textContent = 'Copied';
        copyBtn.style.background = '#e6ffe6';
        console.log('LeetTracker: User clicked copy — successful.');
      } catch (err) {
        console.error('LeetTracker: User clicked copy — failed:', err);
        copyBtn.textContent = 'Copy failed — select manually';
        copyBtn.style.background = '#ffe6e6';
      }
    };

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '6px 8px';
    closeBtn.style.borderRadius = '6px';
    closeBtn.style.border = '1px solid rgba(0,0,0,0.12)';
    closeBtn.style.background = '#fff';
    closeBtn.onclick = () => panel.remove();

    btnRow.appendChild(selectBtn);
    btnRow.appendChild(copyBtn);
    btnRow.appendChild(closeBtn);
    panel.appendChild(btnRow);

    document.body.appendChild(panel);
  })();

})();`;

export default function LeetCodeImport({ onSuccess, onCancel }) {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState(0); // 0: Method Selection, 1-3: Advanced, 4: Success, 5: Instant Setup
  const [importMethod, setImportMethod] = useState(null); // 'instant' or 'advanced'
  const [pastedData, setPastedData] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Instant Sync states
  const [tempUsername, setTempUsername] = useState(user?.leetcodeUsername || '');

  // Group selection states
  const [userGroups, setUserGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [selectedGroupIds, setSelectedGroupIds] = useState(() => loadSavedGroupIds());
  const [showGroupConfig, setShowGroupConfig] = useState(false);

  // Fetch user's groups on mount
  useEffect(() => {
    api.getCached('/groups', {}, 15000)
      .then(res => {
        setUserGroups(res.data || []);
        // Prune stale group IDs
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
      const next = prev.length === userGroups.length
        ? []
        : userGroups.map(g => g.id);
      saveSyncGroupIds(next);
      return next;
    });
  }, [userGroups]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(CONSOLE_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      // 1. If username is new, save it to profile first
      if (normalizedUsername !== user?.leetcodeUsername) {
        await api.put('/auth/me/leetcode-username', { leetcodeUsername: normalizedUsername });
        updateUser({ ...user, leetcodeUsername: normalizedUsername });
      }

      // 2. Trigger sync with groupIds
      const resp = await api.post('/leetcode/sync', {
        groupIds: selectedGroupIds,
      });
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
      const parsed = JSON.parse(pastedData.trim());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();

      if ('solvedMap' in parsed || 'attemptedMap' in parsed) {
        importPayload = {
          solvedMap: parsed.solvedMap && typeof parsed.solvedMap === 'object' && !Array.isArray(parsed.solvedMap)
            ? parsed.solvedMap
            : {},
          attemptedMap: parsed.attemptedMap && typeof parsed.attemptedMap === 'object' && !Array.isArray(parsed.attemptedMap)
            ? parsed.attemptedMap
            : {},
        };
      } else {
        importPayload = {
          solvedMap: parsed,
          attemptedMap: {},
        };
      }

      if (
        Object.keys(importPayload.solvedMap).length === 0
        && Object.keys(importPayload.attemptedMap).length === 0
      ) {
        throw new Error();
      }
    } catch {
      setError('Invalid data. Make sure you pasted the full output from the console script.');
      setLoading(false);
      return;
    }

    try {
      const resp = await api.post('/leetcode/import', {
        ...importPayload,
        groupIds: selectedGroupIds,
      });
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

  const selectedCount = selectedGroupIds.length;

  return (
    <div className="text-gray-300">
      {/* Step indicators (only for Advanced) */}
      {importMethod === 'advanced' && step > 0 && step < 4 && (
        <div className="flex items-center gap-2 mb-6 justify-center">
          {[1, 2, 3].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={cn('w-8 h-px', step > i ? 'bg-[#FFA116]' : 'bg-white/10')} />}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors border',
                  step > s
                    ? 'bg-[#FFA116]/15 text-[#FFA116] border-[#FFA116]/40'
                    : step === s
                      ? 'bg-[#FFA116] text-black border-[#FFA116]'
                      : 'bg-white/5 text-muted-foreground border-white/10'
                )}
              >
                {step > s ? <Check className="w-4 h-4" strokeWidth={3} /> : s}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── STEP 0: Selection ── */}
      {step === 0 && !loading && (
        <div className="space-y-6 animate-fade-in">
          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* ── Group Config Panel ── */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <button
              onClick={() => setShowGroupConfig(!showGroupConfig)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                  <Users className="w-4.5 h-4.5 text-indigo-400" size={18} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-white">Auto-add to Groups</div>
                  <div className="text-xs text-muted-foreground">
                    {groupsLoading
                      ? 'Loading groups...'
                      : selectedCount > 0
                        ? `${selectedCount} group${selectedCount > 1 ? 's' : ''} selected`
                        : 'No groups selected — problems go to your tracker only'}
                  </div>
                </div>
              </div>
              <ChevronDown className={cn('w-5 h-5 text-muted-foreground transition-transform duration-200', showGroupConfig && 'rotate-180')} />
            </button>

            {showGroupConfig && (
              <div className="border-t border-white/10 p-4 animate-fade-in">
                {groupsLoading ? (
                  <div className="text-center text-muted-foreground text-sm py-4">Loading your groups...</div>
                ) : userGroups.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm mb-2">You haven't joined any groups yet.</p>
                    <a href="/groups" className="text-indigo-400 text-sm font-medium hover:text-indigo-300 transition-colors">
                      Browse Groups &rarr;
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Select All toggle */}
                    <button
                      onClick={toggleAllGroups}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                    >
                      <div className={cn(
                        'w-5 h-5 rounded-md flex items-center justify-center border transition-all flex-shrink-0',
                        selectedGroupIds.length === userGroups.length
                          ? 'bg-indigo-500 border-indigo-500'
                          : selectedGroupIds.length > 0
                            ? 'bg-indigo-500/30 border-indigo-500/50'
                            : 'border-white/20'
                      )}>
                        {selectedGroupIds.length > 0 && (
                          selectedGroupIds.length === userGroups.length
                            ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                            : <Minus className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                        )}
                      </div>
                      <span className="text-sm font-medium text-gray-300">
                        {selectedGroupIds.length === userGroups.length ? 'Deselect All' : 'Select All'}
                      </span>
                    </button>

                    <div className="h-px bg-white/5" />

                    {/* Group list */}
                    {userGroups.map(group => {
                      const isSelected = selectedGroupIds.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          onClick={() => toggleGroup(group.id)}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left border',
                            isSelected ? 'bg-indigo-500/10 border-indigo-500/20' : 'hover:bg-white/5 border-transparent'
                          )}
                        >
                          <div className={cn(
                            'w-5 h-5 rounded-md flex items-center justify-center border transition-all flex-shrink-0',
                            isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-white/20'
                          )}>
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-white truncate">{group.name}</div>
                            <div className="text-xs text-muted-foreground">{group.member_count} member{group.member_count !== 1 ? 's' : ''} · {group.problem_count} problem{group.problem_count !== 1 ? 's' : ''}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Import Method Cards */}
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => {
                setImportMethod('instant');
                if (user?.leetcodeUsername) handleInstantSync(user.leetcodeUsername);
                else setStep(5);
              }}
              className="group p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-[#FFA116]/50 hover:bg-[#FFA116]/5 transition-all text-left"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="w-11 h-11 rounded-xl bg-[#FFA116]/10 flex items-center justify-center border border-[#FFA116]/20 flex-shrink-0">
                  <Zap className="w-5 h-5 text-[#FFA116]" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Instant Sync</h4>
                  <p className="text-[11px] text-[#FFA116] font-semibold uppercase tracking-wider">Zero Config</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Uses your public profile to import recent solved problems plus best-effort recent attempts. Fast and easy, but limited to your most recent public activity.
              </p>
            </button>

            <button
              onClick={() => {
                setImportMethod('advanced');
                setStep(1);
              }}
              className="group p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-left"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 flex-shrink-0">
                  <FileCode2 className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Advanced Import</h4>
                  <p className="text-[11px] text-indigo-400 font-semibold uppercase tracking-wider">Full History</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Uses a browser script to fetch your full solved history and attempted-only problems from your logged-in LeetCode session.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5: Instant Setup ── */}
      {step === 5 && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Set Your LeetCode Username</h3>
            <p className="text-muted-foreground text-sm">We need your public username to fetch your recent solved and attempted activity.</p>
          </div>

          <div className="space-y-3">
            <Input
              type="text"
              placeholder="Your LeetCode Username"
              className="h-11 focus-visible:ring-[#FFA116]/40 focus-visible:border-[#FFA116]/60"
              value={tempUsername}
              onChange={e => setTempUsername(e.target.value)}
            />
            {error && (
              <p className="flex items-center gap-2 text-rose-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              className="flex-1 bg-[#FFA116] text-black hover:bg-[#ffb038] font-semibold"
              onClick={() => handleInstantSync()}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  Start Syncing
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── SYNC LOADING (if username already exists) ── */}
      {loading && step === 0 && (
        <div className="py-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-[#FFA116]" />
          <p className="text-muted-foreground animate-pulse">Fetching your recent LeetCode activity...</p>
        </div>
      )}

      {step === 1 && importMethod === 'advanced' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Step 1: Open LeetCode</h3>
            <p className="text-muted-foreground">Open a new tab and go to LeetCode. Make sure you are logged in.</p>
          </div>

          <div className="flex gap-3">
            <a
              href="https://leetcode.com"
              target="_blank"
              rel="noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#FFA116] px-6 py-2.5 text-sm font-semibold text-black hover:bg-[#ffb038] transition-colors"
              onClick={() => setStep(2)}
            >
              Open LeetCode
              <ArrowRight className="w-4 h-4" />
            </a>
            <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
              I'm already logged in
            </Button>
          </div>
        </div>
      )}

      {step === 2 && importMethod === 'advanced' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="text-xl font-bold text-white mb-3">Step 2: Run the Script in Console</h3>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-muted-foreground">
              <li>On the LeetCode tab, press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-200 text-xs">F12</kbd> (Windows) or <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-200 text-xs">Cmd + Option + J</kbd> (Mac) to open DevTools.</li>
              <li>Click the <strong className="text-white">Console</strong> tab.</li>
              <li>Copy the script below and paste it into the console, then press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-200 text-xs">Enter</kbd>.</li>
              <li>Wait for the floating panel or the final import JSON in the console.</li>
            </ol>
          </div>

          <div className="relative group">
            <pre className="bg-black/50 border border-white/10 p-4 rounded-xl text-xs font-mono text-gray-300 overflow-x-auto max-h-48 overflow-y-auto scrollbar-thin">
              {CONSOLE_SCRIPT}
            </pre>
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-3 right-3 backdrop-blur-md"
              onClick={handleCopyScript}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          <div className="flex items-start gap-2.5 text-xs text-amber-300/90 bg-amber-500/10 p-3.5 rounded-xl border border-amber-500/20">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Never paste scripts from unknown sources into your browser console.
              This script only reads your submission list from LeetCode and copies it locally —
              it does not send your cookies or credentials anywhere.
            </span>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              className="flex-1 bg-[#FFA116] text-black hover:bg-[#ffb038] font-semibold"
              onClick={() => setStep(3)}
            >
              Script ran successfully
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && importMethod === 'advanced' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Step 3: Paste the Result Here</h3>
            <p className="text-sm text-muted-foreground">
              The script copied your data to clipboard automatically.
              Just paste it below (<kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Ctrl+V</kbd> / <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-xs">Cmd+V</kbd>).
            </p>
          </div>

          <Textarea
            className="font-mono text-sm focus-visible:ring-[#FFA116]/40 focus-visible:border-[#FFA116]/60"
            rows={5}
            placeholder='Paste your data here... it should start with {"solvedMap":{...},"attemptedMap":{...}}'
            value={pastedData}
            onChange={e => {
              setPastedData(e.target.value);
              setError('');
            }}
          />

          {error && (
            <p className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              className="flex-1 bg-[#FFA116] text-black hover:bg-[#ffb038] font-semibold"
              onClick={handleImport}
              disabled={!pastedData.trim() || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import My Problems'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Success ── */}
      {step === 4 && result && (
        <div className="space-y-6 animate-fade-in">
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-500/15 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
              <CheckCheck className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Import Complete!</h3>
          </div>

          <div className={cn('grid gap-3', typeof result.attempted === 'number' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2')}>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-emerald-400 tabular-nums">{result.solved}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{result.mode === 'recent-sync' ? 'Solved Imported' : 'Newly Imported'}</div>
            </div>
            {typeof result.attempted === 'number' && (
              <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-amber-300 tabular-nums">{result.attempted || 0}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Attempted Imported</div>
              </div>
            )}
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-300 tabular-nums">{result.alreadyExists}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{result.mode === 'recent-sync' ? 'Already Up To Date' : 'Already Existed'}</div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-rose-400 tabular-nums">{result.failed}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Failed</div>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white tabular-nums">{result.total}</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{result.mode === 'recent-sync' ? 'Recent Found' : 'Total Found'}</div>
            </div>
          </div>

          {/* Group add results */}
          {(result.groupsUpdated > 0 || result.groupsFailed > 0) && (
            <div className={cn(
              'p-4 rounded-xl border flex items-center gap-3',
              result.groupsFailed > 0
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-indigo-500/10 border-indigo-500/20'
            )}>
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                result.groupsFailed > 0 ? 'bg-amber-500/20' : 'bg-indigo-500/20'
              )}>
                <Users className={cn('w-5 h-5', result.groupsFailed > 0 ? 'text-amber-400' : 'text-indigo-400')} />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">
                  Problems added to {result.groupsUpdated} group{result.groupsUpdated !== 1 ? 's' : ''}
                </div>
                {result.groupsFailed > 0 && (
                  <div className="text-xs text-amber-400 mt-0.5">
                    {result.groupsFailed} group{result.groupsFailed !== 1 ? 's' : ''} failed (not a member or group removed)
                  </div>
                )}
              </div>
            </div>
          )}

          {result.mode === 'recent-sync' && result.total === 0 && result.totalSolvedOnLeetCode > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
              No recent public activity was available to import right now. Use Advanced Import once if you want your full LeetCode history.
            </div>
          )}

          {result.mode === 'recent-sync' && result.bestEffortAttempted && result.recentAttemptedFound > 0 && (
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 text-gray-300 text-sm">
              Attempted imports are best-effort and only come from your recent public submissions.
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setStep(0);
                setImportMethod(null);
                setPastedData('');
                setResult(null);
              }}
            >
              Import Again
            </Button>
            <Button className="flex-1 font-semibold" onClick={onCancel}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
