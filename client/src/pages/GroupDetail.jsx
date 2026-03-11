import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import './GroupDetail.css';

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddProblem, setShowAddProblem] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [activePattern, setActivePattern] = useState('all');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState(null);

  const fetchGroup = () => {
    api.get(`/groups/${id}`)
      .then(res => setGroup(res.data))
      .catch(() => navigate('/groups'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchGroup(); }, [id]);

  // Extract unique patterns from group problems
  const patterns = useMemo(() => {
    if (!group?.problems) return [];
    const patternSet = new Set();
    group.problems.forEach(p => {
      if (p.pattern_name) patternSet.add(p.pattern_name);
    });
    return Array.from(patternSet).sort();
  }, [group]);

  // Filter problems by active pattern
  const filteredProblems = useMemo(() => {
    if (!group?.problems) return [];
    if (activePattern === 'all') return group.problems;
    return group.problems.filter(p => p.pattern_name === activePattern);
  }, [group, activePattern]);

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

  let searchTimeout = null;

  const handleSearch = async (query) => {
    setSearchQuery(query);
    setPreview(null);
    setError('');
    
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
    setError('');
  };

  const resetProblemModal = () => {
    setShowAddProblem(false);
    setError('');
    setPreview(null);
    setSearchQuery('');
    setSearchResults([]);
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
      await api.post(`/groups/${id}/problems`, { problem_id: problemRes.data.id });
      resetProblemModal();
      fetchGroup();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add problem');
    }
  };

  const handleToggle = async (problemId) => {
    try {
      await api.post(`/problems/${problemId}/toggle`);
      fetchGroup();
    } catch (err) {
      console.error(err);
    }
  };



  if (loading) return <div className="page-loading">Loading group...</div>;
  if (!group) return null;

  return (
    <div className="group-detail container animate-fade-in">
      <div className="page-header">
        <div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/groups')} style={{ marginBottom: '0.75rem' }}>
            ← Back to Groups
          </button>
          <h1>{group.name}</h1>
          <p className="page-desc">
            {group.members?.length} members · {group.problems?.length} problems · Created by {group.creator_name}
          </p>
        </div>
        <div className="group-actions">
          <button className="btn btn-secondary" onClick={() => setShowAddMember(true)}>+ Add Member</button>
          <button className="btn btn-primary" onClick={() => setShowAddProblem(true)}>+ Add Problem</button>
        </div>
      </div>

      {/* Members Bar */}
      <div className="members-bar">
        {group.members?.map(m => (
          <div className="member-chip" key={m.id}>
            <div className="member-avatar">{m.username.charAt(0).toUpperCase()}</div>
            <span>{m.username}</span>
          </div>
        ))}
      </div>

      {/* Pattern Tabs */}
      {patterns.length > 0 && (
        <div className="pattern-tabs-container">
          <div className="pattern-tabs">
            <button 
              className={`pattern-tab ${activePattern === 'all' ? 'active' : ''}`}
              onClick={() => setActivePattern('all')}
            >
              All ({group.problems?.length})
            </button>
            {patterns.map(p => {
              const count = group.problems.filter(prob => prob.pattern_name === p).length;
              return (
                <button 
                  key={p}
                  className={`pattern-tab ${activePattern === p ? 'active' : ''}`}
                  onClick={() => setActivePattern(p)}
                >
                  {p} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Group Problem Table */}
      {filteredProblems.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </span>
          <h3>{activePattern === 'all' ? 'No problems in this group' : `No "${activePattern}" problems`}</h3>
          <p>{activePattern === 'all' ? 'Add problems by their LeetCode number!' : 'Try selecting a different pattern.'}</p>
        </div>
      ) : (
        <div className="group-table">
          <div className="group-header-row">
            <span className="gcol-num">#</span>
            <span className="gcol-title">Problem</span>
            <span className="gcol-diff">Difficulty</span>
            {group.members?.map(m => (
              <span className="gcol-member" key={m.id} title={m.username}>
                {m.username.substring(0, 3)}
              </span>
            ))}
          </div>
          {filteredProblems.map((p, i) => (
            <div 
              className={`group-problem-row ${p.solved ? 'solved' : ''}`}
              key={p.leetcode_number}
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <span className="gcol-num">{p.leetcode_number}</span>
              <span className="gcol-title">
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="problem-link">
                  {p.title}
                </a>
              </span>
              <span className="gcol-diff">
                <span className={`badge badge-${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
              </span>
              {p.member_statuses?.map(ms => (
                <span className="gcol-member" key={ms.user_id}>
                  {ms.user_id === user?.id ? (
                    <button 
                      className={`check-btn ${ms.solved ? 'checked' : ''}`}
                      onClick={() => handleToggle(p.id)}
                    >
                      {ms.solved ? '✓' : ''}
                    </button>
                  ) : (
                    <span className={`member-status ${ms.solved ? 'done' : ''}`}>
                      {ms.solved ? '✓' : '—'}
                    </span>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="modal-overlay" onClick={() => { setShowAddMember(false); setError(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add Member</h2>
            {error && <div className="auth-error">{error}</div>}
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username..."
                onKeyDown={e => e.key === 'Enter' && handleAddMember()}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => { setShowAddMember(false); setError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddMember}>Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Problem Modal */}
      {showAddProblem && (
        <div className="modal-overlay backdrop-blur-sm transition-all duration-300" onClick={resetProblemModal}>
          <div className="modal-content shadow-2xl shadow-green-900/20" onClick={e => e.stopPropagation()}>
            <h2>Add Problem to Group</h2>
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

            {error && <div className="auth-error">{error}</div>}

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
              <button className="btn btn-secondary" onClick={resetProblemModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddProblem} disabled={!preview}>Add Problem</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
