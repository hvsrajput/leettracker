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
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
          + Add Problem
        </button>
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
          <span className="empty-icon">📝</span>
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
          </div>
          {problems.map((p, i) => (
            <div 
              className={`problem-row ${p.solved ? 'solved' : ''}`} 
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
            </div>
          ))}
        </div>
      )}

      {/* Add Problem Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
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
        <div className="modal-overlay" onClick={() => setShowPatternModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
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
    </div>
  );
}
