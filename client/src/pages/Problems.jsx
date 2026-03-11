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
  }, [activePattern, difficultyFilter, solvedFilter]);

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
      const { imported, alreadyExists, failed, total } = res.data;
      let msg = `Found ${total} AC submissions. Imported ${imported} new.`;
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
            {solvedCount} of {problems.length} solved
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
          <option value="false">Unsolved</option>
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
              className={`problem-row ${p.solved ? 'solved' : ''} transition-all duration-300 hover:scale-[1.01] hover:ring-1 hover:ring-green-500/30 cursor-pointer`} 
              key={p.id}
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <span className="col-check">
                <button 
                  className={`check-btn ${p.solved ? 'checked' : ''}`}
                  onClick={() => handleToggle(p.id)}
                  title={p.solved ? 'Mark unsolved' : 'Mark solved'}
                >
                  {p.solved ? '✓' : ''}
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
              <span className="col-pattern">
                {p.pattern_name && (
                  <span className="badge badge-pattern">{p.pattern_name}</span>
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay backdrop-blur-sm transition-all duration-300" onClick={() => !isImporting && setShowImportModal(false)}>
          <div className="modal-content shadow-2xl shadow-green-900/20" onClick={e => e.stopPropagation()}>
            <h2>Import from LeetCode</h2>
            <p className="text-gray-400 text-sm mb-4">
              Enter your LeetCode username to automatically import your mostly recently accepted submissions (up to 20).
            </p>
            <div className="form-group">
              <label>LeetCode Username (Public profile)</label>
              <input
                type="text"
                value={lcUsername}
                onChange={e => setLcUsername(e.target.value)}
                placeholder="e.g. hvsrajput"
                disabled={isImporting}
                onKeyDown={e => e.key === 'Enter' && handleImport()}
              />
            </div>
            <div className="form-group mt-2">
              <label className="text-sm! text-gray-300!">Full "Cookie" Header (Optional, bypasses 20 limit!)</label>
              <input
                type="password"
                value={lcSessionCookie}
                onChange={e => setLcSessionCookie(e.target.value)}
                placeholder="Paste the 'Cookie' header here"
                disabled={isImporting}
                onKeyDown={e => e.key === 'Enter' && handleImport()}
              />
              <p className="text-xs text-gray-500 mt-1">To import ALL problems: Open LeetCode, F12 &gt; Network Tab &gt; Refresh &gt; Click any request &gt; scroll down to Request Headers and copy the ENTIRE "Cookie:" string value.</p>
            </div>
            {importError && <div className="auth-error mt-4">{importError}</div>}
            {importResult && <div className="text-green-500 mb-4 mt-4">{importResult}</div>}
            <div className="form-actions mt-4">
              <button className="btn btn-secondary" onClick={() => setShowImportModal(false)} disabled={isImporting}>
                Close
              </button>
              <button className="btn btn-primary flex items-center justify-center gap-2" onClick={handleImport} disabled={isImporting || (!lcUsername.trim() && !lcSessionCookie.trim())}>
                {isImporting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Importing...
                  </>
                ) : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
