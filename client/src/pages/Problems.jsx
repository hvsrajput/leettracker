import { useState, useEffect } from 'react';
import api from '../api';
import './Problems.css';

export default function Problems() {
  const [problems, setProblems] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePattern, setActivePattern] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [solvedFilter, setSolvedFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState(null);
  const [addError, setAddError] = useState('');
  const [newPatternName, setNewPatternName] = useState('');

  // LeetCode Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [lcUsername, setLcUsername] = useState('');
  const [lcSessionCookie, setLcSessionCookie] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [importError, setImportError] = useState('');

  const fetchProblems = () => {
    const params = new URLSearchParams();
    if (activePattern !== 'all') params.append('pattern', activePattern);
    if (difficultyFilter) params.append('difficulty', difficultyFilter);
    if (solvedFilter) params.append('solved', solvedFilter);
    if (companyFilter) params.append('company', companyFilter);

    api.get(`/problems?${params.toString()}`)
      .then(res => setProblems(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/patterns').then(res => setPatterns(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchProblems();
  }, [activePattern, difficultyFilter, solvedFilter, companyFilter]);

  let searchTimeout = null;

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setPreview(null);
    setAddError('');
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    searchTimeout = setTimeout(async () => {
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
    setPreview(prob);
    setSearchQuery('');
    setSearchResults([]);
    setAddError('');
  };

  const handleAddProblem = async () => {
    if (!preview) return;
    setAddError('');
    try {
      await api.post('/problems', { 
        leetcode_number: preview.number,
        title: preview.title,
        difficulty: preview.difficulty,
        pattern_name: preview.topics?.[0] || null
      });
      setShowAddModal(false);
      setPreview(null);
      setSearchQuery('');
      fetchProblems();
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add problem');
    }
  };

  const handleToggle = async (problemId) => {
    try {
      const res = await api.post(`/problems/${problemId}/toggle`);
      setProblems(prev => prev.map(p => 
        p.id === problemId ? { ...p, solved: res.data.solved } : p
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (problemId, problemTitle) => {
    if (window.confirm(`Are you sure you want to delete "${problemTitle}" from the tracker?`)) {
      try {
        await api.delete(`/problems/${problemId}`);
        setProblems(prev => prev.filter(p => p.id !== problemId));
        // Re-fetch patterns to remove orphaned ones
        api.get('/patterns').then(res => setPatterns(res.data)).catch(console.error);
      } catch (err) {
        console.error('Failed to delete problem', err);
      }
    }
  };

  const handleAddPattern = async () => {
    if (!newPatternName.trim()) return;
    try {
      const res = await api.post('/patterns', { name: newPatternName.trim() });
      setPatterns(prev => [...prev, res.data]);
      setNewPatternName('');
      setShowPatternModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleImport = async () => {
    if (!lcUsername.trim() && !lcSessionCookie.trim()) return;
    setIsImporting(true);
    setImportError('');
    setImportResult('');
    try {
      const res = await api.post('/leetcode/import', { 
        username: lcUsername.trim(),
        sessionCookie: lcSessionCookie.trim()
      });
      const { solved, attempted, alreadyExists, failed, total } = res.data;
      let msg = `Found ${total} submissions. ${solved} solved, ${attempted || 0} attempted imported.`;
      if (alreadyExists) msg += ` ${alreadyExists} already tracked.`;
      if (failed) msg += ` ${failed} couldn't be fetched.`;
      setImportResult(msg);
      setLcUsername('');
      setLcSessionCookie('');
      fetchProblems(); // Refresh the grid
    } catch (err) {
      setImportError(err.response?.data?.error || 'Failed to import from LeetCode');
    } finally {
      setIsImporting(false);
    }
  };

  const solvedCount = problems.filter(p => p.solved).length;

  return (
    <div className="problems-page container animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Problems</h1>
          <p className="page-desc">
            {problems.filter(p => p.status === 'solved').length} solved, {problems.filter(p => p.status === 'attempted').length} attempted of {problems.length}
            {activePattern !== 'all' && ` in ${activePattern}`}
          </p>
        </div>
        <div className="flex gap-4">
          <button className="btn btn-secondary flex items-center gap-2" onClick={() => setShowImportModal(true)}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Import from LeetCode
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Problem
          </button>
        </div>
      </div>

      {/* Pattern Tabs */}
      <div className="pattern-tabs-container">
        <div className="pattern-tabs">
          <button 
            className={`pattern-tab ${activePattern === 'all' ? 'active' : ''}`}
            onClick={() => setActivePattern('all')}
          >
            All
          </button>
          {patterns.map(p => (
            <button 
              key={p.id}
              className={`pattern-tab ${activePattern === p.name ? 'active' : ''}`}
              onClick={() => setActivePattern(p.name)}
            >
              {p.name}
            </button>
          ))}
          <button 
            className="pattern-tab tab-add"
            onClick={() => setShowPatternModal(true)}
            title="Add custom pattern"
          >
            +
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select value={difficultyFilter} onChange={e => setDifficultyFilter(e.target.value)}>
          <option value="">All Difficulties</option>
          <option value="Easy">Easy</option>
          <option value="Medium">Medium</option>
          <option value="Hard">Hard</option>
        </select>
        <select value={solvedFilter} onChange={e => setSolvedFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="true">Solved</option>
          <option value="attempted">Attempted</option>
          <option value="false">Unsolved</option>
        </select>
        <select value={companyFilter} onChange={e => setCompanyFilter(e.target.value)}>
          <option value="">All Companies</option>
          <option value="Amazon">Amazon</option>
          <option value="Google">Google</option>
          <option value="Meta">Meta</option>
          <option value="Microsoft">Microsoft</option>
          <option value="Apple">Apple</option>
          <option value="Uber">Uber</option>
          <option value="Adobe">Adobe</option>
          <option value="Netflix">Netflix</option>
        </select>
      </div>

      {/* Problem List */}
      {loading ? (
        <div className="page-loading">Loading problems...</div>
      ) : problems.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </span>
          <h3>No problems yet</h3>
          <p>Add your first problem to start tracking!</p>
        </div>
      ) : (
        <div className="problem-table">
          <div className="problem-header-row">
            <span className="col-check">Status</span>
            <span className="col-num">#</span>
            <span className="col-title">Title</span>
            <span className="col-diff">Difficulty</span>
            <span className="col-pattern">Pattern</span>
            <span className="col-action"></span>
          </div>
          {problems.map((p, i) => (
            <div 
              className={`problem-row ${p.status === 'solved' ? 'solved' : p.status === 'attempted' ? 'attempted' : ''} transition-all duration-300 hover:scale-[1.01] hover:ring-1 hover:ring-green-500/30 cursor-pointer`} 
              key={p.id}
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <span className="col-check">
                <button 
                  className={`check-btn ${p.status === 'solved' ? 'checked' : p.status === 'attempted' ? 'attempted' : ''}`}
                  onClick={() => handleToggle(p.id)}
                  title={p.status === 'solved' ? 'Mark unsolved' : 'Mark solved'}
                >
                  {p.status === 'solved' ? '✓' : p.status === 'attempted' ? '•' : '○'}
                </button>
              </span>
              <span className="col-num">{p.leetcode_number}</span>
              <span className="col-title">
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="problem-link">
                  {p.title}
                </a>
              </span>
              <span className="col-diff">
                <span className={`badge badge-${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
              </span>
              <span className="col-pattern flex gap-1 flex-wrap">
                {p.pattern_name && (
                  <span className="badge badge-pattern">{p.pattern_name}</span>
                )}
                {p.companies && p.companies.length > 0 && (
                  <span className="badge badge-pattern text-xs opacity-75">{p.companies[0]}</span>
                )}
              </span>
              <span className="col-action flex justify-center items-center">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.title); }} 
                  className="text-gray-500 hover:text-red-500 transition-colors" 
                  title="Delete problem"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add Problem Modal */}
      {showAddModal && (
        <div className="modal-overlay backdrop-blur-sm transition-all duration-300" onClick={() => setShowAddModal(false)}>
          <div className="modal-content shadow-2xl shadow-green-900/20" onClick={e => e.stopPropagation()}>
            <h2>Add Problem</h2>
            <div className="form-group search-group">
              <label>Search Problem (Title or Number)</label>
              <div className="search-input-wrapper">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="e.g. Two Sum, 1..."
                  autoComplete="off"
                />
                {isSearching && <span className="search-spinner">...</span>}
              </div>
              
              {searchResults.length > 0 && (
                <div className="autocomplete-dropdown">
                  {searchResults.map(res => (
                    <div 
                      key={res.number} 
                      className="autocomplete-item"
                      onClick={() => handleSelectProblem(res)}
                    >
                      <span className="ac-num">#{res.number}</span>
                      <span className="ac-title">{res.title}</span>
                      <span className={`ac-diff badge badge-${res.difficulty.toLowerCase()}`}>{res.difficulty}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {addError && <div className="auth-error">{addError}</div>}

            {preview && (
              <div className="preview-card">
                <div className="preview-title">{preview.title}</div>
                <div className="preview-meta">
                  <span className={`badge badge-${preview.difficulty.toLowerCase()}`}>{preview.difficulty}</span>
                  {preview.topics && preview.topics.map(t => (
                    <span className="badge badge-pattern" key={t}>{t}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => { setShowAddModal(false); setPreview(null); setSearchQuery(''); setSearchResults([]); }}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAddProblem} disabled={!preview}>
                Add Problem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Pattern Modal */}
      {showPatternModal && (
        <div className="modal-overlay backdrop-blur-sm transition-all duration-300" onClick={() => setShowPatternModal(false)}>
          <div className="modal-content shadow-2xl shadow-green-900/20" onClick={e => e.stopPropagation()}>
            <h2>Add Custom Pattern</h2>
            <div className="form-group">
              <label>Pattern Name</label>
              <input
                type="text"
                value={newPatternName}
                onChange={e => setNewPatternName(e.target.value)}
                placeholder="e.g. Monotonic Stack, Trie..."
                onKeyDown={e => e.key === 'Enter' && handleAddPattern()}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowPatternModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddPattern}>Add Pattern</button>
            </div>
          </div>
        </div>
      )}
          {/* Connect LeetCode Modal */}
      {showImportModal && (
        <div className="modal-overlay backdrop-blur-sm transition-all duration-300 flex items-center justify-center z-50 p-4" onClick={() => !isImporting && setShowImportModal(false)}>
          <div className="modal-content shadow-2xl shadow-green-900/20 max-w-lg w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-[var(--bg-tertiary)] p-6 border-b border-[var(--border-light)] relative">
              <button 
                onClick={() => !isImporting && setShowImportModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                disabled={isImporting}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFA116]/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#FFA116]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.105 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.939 5.939 0 0 0 1.271 1.541 5.995 5.995 0 0 0 .678.463 6.115 6.115 0 0 0 1.08.452 6.324 6.324 0 0 0 1.954.218 6.426 6.426 0 0 0 1.109-.134 6.55 6.55 0 0 0 1.97-.68 6.57 6.57 0 0 0 .445-.278 6.643 6.643 0 0 0 .848-.731l6.19-6.6a1.365 1.365 0 0 0 .408-.98 1.353 1.353 0 0 0-.411-.986l-2.092-2.228a1.354 1.354 0 0 0-.974-.423 1.366 1.366 0 0 0-.966.428l-5.694 6.07a1.27 1.27 0 0 1-.9.395 1.246 1.246 0 0 1-.892-.379l-1.636-1.742a1.26 1.26 0 0 1-.378-.893 1.278 1.278 0 0 1 .378-.9l6.305-6.721A1.368 1.368 0 0 0 13.483 0zm-2.866 12.815a1.362 1.362 0 0 0-.96.44l-2.24 2.39a1.351 1.351 0 0 0-.406.983c0 .359.135.703.385.962l2.366 2.516c.26.275.617.432.993.432.378 0 .736-.157.995-.432l2.253-2.396a1.354 1.354 0 0 0 .406-.983 1.34 1.34 0 0 0-.406-.968l-2.39-2.502a1.347 1.347 0 0 0-.996-.442z"></path>
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white m-0">Connect LeetCode</h2>
                  <p className="text-gray-400 text-sm mt-1">Sync your submissions automatically</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="bg-[#161b22] border border-[var(--border-light)] rounded-xl p-4 mb-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#FFA116]"></div>
                <h3 className="font-semibold text-white mb-2 text-sm flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#FFA116]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  How to get your session cookie:
                </h3>
                <ol className="text-sm text-gray-400 pl-4 space-y-2 mb-0 list-decimal">
                  <li>Log in to <a href="https://leetcode.com" target="_blank" rel="noreferrer" className="text-[#FFA116] hover:underline">leetcode.com</a> in your browser</li>
                  <li>Right click anywhere and select <strong>Inspect</strong> (or press F12)</li>
                  <li>Go to the <strong>Network</strong> tab and refresh the page</li>
                  <li>Click the first request (usually `leetcode.com` or `graphql`)</li>
                  <li>Scroll down to <strong>Request Headers</strong> and copy the entire <code className="bg-black/50 px-1.5 py-0.5 rounded text-accent-cyan">Cookie:</code> string</li>
                </ol>
              </div>

              <div className="space-y-4">
                <div className="form-group">
                  <label className="text-gray-300 font-medium mb-1.5 block">LeetCode Username</label>
                  <input
                    type="text"
                    value={lcUsername}
                    onChange={e => setLcUsername(e.target.value)}
                    placeholder="e.g. hvsrajput"
                    className="w-full bg-[#0d1117] border border-[var(--border-light)] rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-[#FFA116] focus:border-[#FFA116] outline-none transition-all placeholder-gray-600"
                    disabled={isImporting}
                    onKeyDown={e => e.key === 'Enter' && handleImport()}
                  />
                </div>
                
                <div className="form-group">
                  <label className="text-gray-300 font-medium mb-1.5 block">Session Cookie <span className="text-xs font-normal text-gray-500 ml-2">(Required for full sync)</span></label>
                  <input
                    type="password"
                    value={lcSessionCookie}
                    onChange={e => setLcSessionCookie(e.target.value)}
                    placeholder="Paste the entire 'Cookie' header string here..."
                    className="w-full bg-[#0d1117] border border-[var(--border-light)] rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-[#FFA116] focus:border-[#FFA116] outline-none transition-all placeholder-gray-600 font-mono text-xs"
                    disabled={isImporting}
                    onKeyDown={e => e.key === 'Enter' && handleImport()}
                  />
                </div>
              </div>

              {importError && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {importError}
                </div>
              )}
              
              {importResult && (
                <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  {importResult}
                </div>
              )}

              <div className="mt-8 flex gap-3">
                <button 
                  className="flex-1 py-2.5 px-4 rounded-lg border border-[var(--border-light)] text-gray-300 font-medium hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50" 
                  onClick={() => setShowImportModal(false)} 
                  disabled={isImporting}
                >
                  Cancel
                </button>
                <button 
                  className="flex-[2] py-2.5 px-4 rounded-lg bg-[#FFA116] text-black font-semibold hover:bg-[#ffb038] transition-colors disabled:opacity-50 disabled:bg-[#FFA116]/50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,161,22,0.3)] hover:shadow-[0_0_20px_rgba(255,161,22,0.5)]" 
                  onClick={handleImport} 
                  disabled={isImporting || (!lcUsername.trim() && !lcSessionCookie.trim())}
                >
                  {isImporting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Connecting & Syncing...
                    </>
                  ) : (
                    'Connect & Sync Problems'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}    </div>
  );
}
