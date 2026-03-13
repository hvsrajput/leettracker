import { useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const CONSOLE_SCRIPT = `(async () => {
  console.log('LeetTracker: Fetching all solved problems...');

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

  const dateMap = {};
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

    for (const sub of list.submissions)
      if (sub.statusDisplay === 'Accepted' && !dateMap[sub.titleSlug])
        dateMap[sub.titleSlug] = sub.timestamp;

    hasNext = list.hasNext;
    offset += 50;
    page++;
    if (hasNext) await new Promise(r => setTimeout(r, 400));
  }

  const fallbackTs = Math.floor(Date.now() / 1000).toString();
  const solvedMap = {};
  for (const slug of allSlugs)
    solvedMap[slug] = dateMap[slug] || fallbackTs;

  const withDates = Object.values(solvedMap).filter(t => t !== fallbackTs).length;
  console.log(\`LeetTracker: \${withDates}/\${allSlugs.size} have exact dates. Rest use today as fallback.\`);

  // Prepare final JSON (pretty)
  const finalJson = JSON.stringify(solvedMap, null, 2);

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
  console.log('LeetTracker: Final solved map JSON (copy manually if needed):');
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
    title.textContent = 'LeetTracker — solvedMap JSON';
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

  const handleCopyScript = () => {
    navigator.clipboard.writeText(CONSOLE_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInstantSync = async (usernameToUse = tempUsername) => {
    if (!usernameToUse.trim()) {
      setError('Please enter your LeetCode username');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // 1. If username is new, save it to profile first
      if (usernameToUse !== user?.leetcodeUsername) {
        await api.put('/auth/profile', { leetcodeUsername: usernameToUse });
        updateUser({ ...user, leetcodeUsername: usernameToUse });
      }

      // 2. Trigger sync
      const resp = await api.post('/leetcode/sync');
      const { newlyImported, alreadyTracked, totalFound } = resp.data;
      
      setResult({
        solved: newlyImported,
        alreadyExists: alreadyTracked,
        failed: totalFound - (newlyImported + alreadyTracked),
        total: totalFound
      });
      setStep(4);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Sync failed. Check your username and privacy settings on LeetCode.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setError('');
    setLoading(true);

    let solvedMap;
    try {
      solvedMap = JSON.parse(pastedData.trim());
      if (typeof solvedMap !== 'object' || Array.isArray(solvedMap)) throw new Error();
    } catch {
      setError('Invalid data. Make sure you pasted the full output from the console script.');
      setLoading(false);
      return;
    }

    try {
      const resp = await api.post('/leetcode/import', { solvedMap });
      setResult(resp.data);
      setStep(4);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="text-gray-300">
      {/* Step indicators (only for Advanced) */}
      {importMethod === 'advanced' && step > 0 && step < 4 && (
        <div className="flex gap-2 mb-6 justify-center">
          {[1, 2, 3].map(s => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= s ? 'bg-[#FFA116] text-black' : 'bg-white/10 text-gray-500'}`}>
              {s}
            </div>
          ))}
        </div>
      )}

      {/* ── STEP 0: Selection ── */}
      {step === 0 && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 gap-4">
            <button 
              onClick={() => {
                setImportMethod('instant');
                if (user?.leetcodeUsername) handleInstantSync(user.leetcodeUsername);
                else setStep(5);
              }}
              className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-[#FFA116]/50 hover:bg-[#FFA116]/5 transition-all text-left"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-xl bg-[#FFA116]/10 flex items-center justify-center border border-[#FFA116]/20">
                  <svg className="w-6 h-6 text-[#FFA116]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Instant Sync</h4>
                  <p className="text-xs text-[#FFA116] font-medium uppercase tracking-wider">Zero Config</p>
                </div>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Uses your public profile to import recently solved problems. Fast and easy, but limited to the last 20 exact dates.
              </p>
            </button>

            <button 
              onClick={() => {
                setImportMethod('advanced');
                setStep(1);
              }}
              className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-left"
            >
              <div className="flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Advanced Import</h4>
                  <p className="text-xs text-indigo-400 font-medium uppercase tracking-wider">Full History</p>
                </div>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Uses a browser script to fetch your entire solved history with exact dates for every problem. Recommended for first-time setup.
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
            <p className="text-gray-400 text-sm">We need your public username to fetch your solved problems.</p>
          </div>
          
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Your LeetCode Username"
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-1 focus:ring-[#FFA116] focus:border-[#FFA116] outline-none transition-all"
              value={tempUsername}
              onChange={e => setTempUsername(e.target.value)}
            />
            {error && <p className="text-red-400 text-sm">❌ {error}</p>}
          </div>

          <div className="flex gap-4">
            <button className="px-4 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors" onClick={() => setStep(0)}>
              &larr; Back
            </button>
            <button 
              className="flex-1 px-6 py-2.5 rounded-lg bg-[#FFA116] text-black font-semibold hover:bg-[#ffb038] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              onClick={() => handleInstantSync()}
              disabled={loading}
            >
              {loading ? (
                <><svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Syncing...</>
              ) : 'Start Syncing &rarr;'}
            </button>
          </div>
        </div>
      )}

      {/* ── SYNC LOADING (if username already exists) ── */}
      {loading && step === 0 && (
         <div className="py-12 flex flex-col items-center justify-center space-y-4">
            <svg className="animate-spin h-10 w-10 text-[#FFA116]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-400 animate-pulse">Fetching your LeetCode progress...</p>
         </div>
      )}

      {step === 1 && importMethod === 'advanced' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Step 1: Open LeetCode</h3>
            <p className="text-gray-400">Open a new tab and go to LeetCode. Make sure you are logged in.</p>
          </div>
          
          <div className="flex gap-4">
            <a
              href="https://leetcode.com"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-2.5 rounded-lg bg-[#FFA116] text-black font-semibold hover:bg-[#ffb038] transition-colors flex-1 text-center"
              onClick={() => setStep(2)}
            >
              Open LeetCode &rarr;
            </a>
            <button className="px-6 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors flex-1" onClick={() => setStep(2)}>
              I'm already logged in
            </button>
          </div>
        </div>
      )}

      {step === 2 && importMethod === 'advanced' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Step 2: Run the Script in Console</h3>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-gray-400">
              <li>On the LeetCode tab, press <kbd className="bg-white/10 px-1 rounded text-gray-200">F12</kbd> (Windows) or <kbd className="bg-white/10 px-1 rounded text-gray-200">Cmd + Option + J</kbd> (Mac) to open DevTools.</li>
              <li>Click the <strong className="text-white">Console</strong> tab.</li>
              <li>Copy the script below and paste it into the console, then press <kbd className="bg-white/10 px-1 rounded text-gray-200">Enter</kbd>.</li>
              <li>Wait for the message: <code className="text-[#FFA116] bg-[#FFA116]/10 px-1 rounded">LeetTracker: Copied to clipboard!</code></li>
            </ol>
          </div>

          <div className="relative group">
            <pre className="bg-black/50 border border-white/10 p-4 rounded-xl text-xs font-mono text-gray-300 overflow-x-auto max-h-48 overflow-y-auto">
              {CONSOLE_SCRIPT}
            </pre>
            <button 
              className="absolute top-3 right-3 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-md transition-colors backdrop-blur-md border border-white/10"
              onClick={handleCopyScript}
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>

          <p className="text-xs text-yellow-500/80 bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/20">
            ⚠️ Never paste scripts from unknown sources into your browser console.
            This script only reads your submission list from LeetCode and copies it locally — 
            it does not send your cookies or credentials anywhere.
          </p>

          <div className="flex gap-4">
            <button className="px-4 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors" onClick={() => setStep(1)}>
              &larr; Back
            </button>
            <button className="flex-1 px-6 py-2.5 rounded-lg bg-[#FFA116] text-black font-semibold hover:bg-[#ffb038] transition-colors" onClick={() => setStep(3)}>
              Script ran successfully &rarr;
            </button>
          </div>
        </div>
      )}

      {step === 3 && importMethod === 'advanced' && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="text-xl font-bold text-white mb-2">Step 3: Paste the Result Here</h3>
            <p className="text-sm text-gray-400">
              The script copied your data to clipboard automatically.
              Just paste it below (<kbd className="bg-white/10 px-1 rounded">Ctrl+V</kbd> / <kbd className="bg-white/10 px-1 rounded">Cmd+V</kbd>).
            </p>
          </div>

          <textarea
            className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-mono text-sm text-gray-300 focus:border-[#FFA116] focus:ring-1 focus:ring-[#FFA116] outline-none transition-all placeholder:text-gray-600"
            rows={5}
            placeholder='Paste your data here... it should start with {"two-sum":"1693000000",...}'
            value={pastedData}
            onChange={e => {
              setPastedData(e.target.value);
              setError('');
            }}
          />

          {error && <p className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">❌ {error}</p>}

          <div className="flex gap-4">
            <button className="px-4 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors" onClick={() => setStep(2)}>
              &larr; Back
            </button>
            <button
              className="flex-1 px-6 py-2.5 rounded-lg bg-[#FFA116] text-black font-semibold hover:bg-[#ffb038] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              onClick={handleImport}
              disabled={!pastedData.trim() || loading}
            >
              {loading ? (
                <><svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Importing...</>
              ) : 'Import My Problems'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Success ── */}
      {step === 4 && result && (
        <div className="space-y-6 animate-fade-in">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Import Complete!</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-green-400">{result.solved}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Newly Imported</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-gray-300">{result.alreadyExists}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Already Existed</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-red-400">{result.failed}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Not in Dataset</div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">{result.total}</div>
              <div className="text-xs text-gray-400 uppercase tracking-wider mt-1">Total Found</div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button className="px-4 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors" onClick={() => {
              setStep(0);
              setImportMethod(null);
              setPastedData('');
              setResult(null);
            }}>
              Import Again
            </button>
            <button className="flex-1 px-6 py-2.5 rounded-lg bg-white text-black font-semibold hover:bg-gray-200 transition-colors" onClick={onCancel}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
