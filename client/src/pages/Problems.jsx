import { useState, useEffect, useMemo } from 'react';
import api from '../api';
import LeetCodeImport from '../components/LeetCodeImport';
import { COMPANY_OPTIONS, getProblemTopics } from '../utils/problemFilters';

export default function Problems() {
  const [allProblems, setAllProblems] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePattern, setActivePattern] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [solvedFilter, setSolvedFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState(null);
  const [addError, setAddError] = useState('');

  const fetchProblems = () => {
    setLoading(true);
    api.get('/problems')
      .then(res => setAllProblems(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  // Compute dynamic topic tabs from all problems
  const dynamicPatterns = useMemo(() => {
    return getProblemTopics(allProblems);
  }, [allProblems]);

  // Apply filters on the frontend
  const problems = useMemo(() => {
    return allProblems.filter(p => {
      const matchPattern = activePattern === 'all' || 
                           (p.topics?.includes(activePattern) || p.pattern_name === activePattern);
      const matchDifficulty = !difficultyFilter || p.difficulty === difficultyFilter;
      const matchSolved = !solvedFilter || p.status === solvedFilter;
      const matchCompany = !companyFilter || p.companies?.includes(companyFilter);
      return matchPattern && matchDifficulty && matchSolved && matchCompany;
    });
  }, [allProblems, activePattern, difficultyFilter, solvedFilter, companyFilter]);

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

  const handleSetStatus = async (problemId, nextStatus) => {
    try {
      const res = await api.post(`/problems/${problemId}/status`, { status: nextStatus });
      setAllProblems(prev => prev.map(p => 
        p.id === problemId ? { ...p, solved: res.data.solved, status: res.data.status } : p
      ));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (problemId, problemTitle) => {
    if (window.confirm(`Are you sure you want to delete "${problemTitle}" from the tracker?`)) {
      try {
        await api.delete(`/problems/${problemId}`);
        setAllProblems(prev => prev.filter(p => p.id !== problemId));
      } catch (err) {
        console.error('Failed to delete problem', err);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Problems</h1>
          <p className="text-gray-400 mt-2">
            {problems.filter(p => p.status === 'solved').length} solved, {problems.filter(p => p.status === 'attempted').length} attempted of {problems.length}
            {activePattern !== 'all' && ` in ${activePattern}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button 
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all font-medium text-sm text-gray-200"
            onClick={() => setShowImportModal(true)}
          >
            <svg className="w-5 h-5 text-[#FFA116]" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Import from LeetCode
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 border border-green-500 transition-all font-medium text-sm text-white shadow-lg shadow-green-900/20"
            onClick={() => setShowAddModal(true)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Problem
          </button>
        </div>
      </div>


      {/* Dynamic Pattern Tabs */}
      <div className="flex flex-wrap gap-3 mb-4">
        <button 
          onClick={() => setActivePattern('all')}
          className={`transition-all ${activePattern === 'all' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl px-4 py-2' : 'bg-white/5 border border-white/10 rounded-xl px-4 py-2 hover:bg-white/10 text-gray-300'}`}
        >
          All
        </button>
        {dynamicPatterns.map(p => (
           <button 
             key={p}
             onClick={() => setActivePattern(p)}
             className={`transition-all ${activePattern === p ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl px-4 py-2' : 'bg-white/5 border border-white/10 rounded-xl px-4 py-2 hover:bg-white/10 text-gray-300'}`}
           >
             {p}
           </button>
        ))}
      </div>

      <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="mb-6 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
        <svg className={`w-4 h-4 transform transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        Advanced Filters
      </button>

      {/* Advanced Filter Panel */}
      {showAdvancedFilters && (
      <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6 shadow-lg shadow-black/20 animate-fade-in">
        <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          Match <span className="bg-black/50 px-2 py-1 rounded text-white border border-white/10">All</span> of the following filters:
        </h3>
        
        <div className="space-y-3">
          {/* Status Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full group">
            <div className="flex items-center gap-2 w-32 flex-shrink-0 text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              <span className="text-sm">Status</span>
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
              <span className="text-sm">Topics</span>
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
              {dynamicPatterns.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button className="p-1.5 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100" onClick={() => setActivePattern('all')}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
            </button>
          </div>

          {/* Company Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full group">
            <div className="flex items-center gap-2 w-32 flex-shrink-0 text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />
              </svg>
              <span className="text-sm">Company</span>
            </div>
            <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 w-24 flex-shrink-0">
              <span>is</span>
              <svg className="w-3 h-3 ml-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
            <select 
              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-indigo-500 appearance-none bg-no-repeat bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5H7z%22%20fill%3D%22%23ffffff40%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_8px_center] pr-10"
              value={companyFilter} 
              onChange={e => setCompanyFilter(e.target.value)}
            >
              <option value="">Any Company</option>
              {COMPANY_OPTIONS.map(company => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
            <button className="p-1.5 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100" onClick={() => setCompanyFilter('')}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
            </button>
          </div>
          
        </div>
        
        <div className="mt-6 flex justify-end items-center border-t border-white/10 pt-4">
          <button 
            className="text-gray-400 hover:text-white font-medium text-sm flex items-center gap-2 transition-colors"
            onClick={() => { setDifficultyFilter(''); setSolvedFilter(''); setCompanyFilter(''); setActivePattern('all'); }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
            Reset
          </button>
        </div>
      </div>
      )}

      {/* Problem List */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px] text-gray-400">Loading problems...</div>
      ) : problems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-12 flex flex-col items-center justify-center text-center">
          <svg className="w-16 h-16 text-gray-600 mb-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <h3 className="text-xl font-semibold text-white mb-2">No problems found</h3>
          <p className="text-gray-400 mb-6">Add your first problem or adjust your filters.</p>
          <button className="btn btn-primary bg-white text-black hover:bg-gray-200 px-6 py-2 rounded-lg font-medium transition-colors" onClick={() => setShowAddModal(true)}>
            Add Problem
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md overflow-hidden">
          <div className="grid grid-cols-[112px_112px_60px_minmax(200px,1fr)_100px_minmax(150px,1fr)_48px] gap-4 p-4 border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-white/5">
            <span className="text-center whitespace-nowrap tracking-normal">Attempted</span>
            <span className="text-center whitespace-nowrap tracking-normal">Solved</span>
            <span>#</span>
            <span>Title</span>
            <span>Difficulty</span>
            <span>Pattern / Company</span>
            <span className="text-center">Del</span>
          </div>
          <div className="divide-y divide-white/5">
            {problems.map((p, i) => (
              <div 
                className={`grid grid-cols-[112px_112px_60px_minmax(200px,1fr)_100px_minmax(150px,1fr)_48px] gap-4 p-4 items-center transition-all duration-200 hover:bg-white/5 ${p.status === 'solved' ? 'bg-green-500/[0.02]' : p.status === 'attempted' ? 'bg-yellow-500/[0.02]' : ''}`} 
                key={p.id}
              >
                <div className="flex justify-center flex-shrink-0">
                  <button 
                    className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                      p.status === 'attempted' ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-300' : 
                      'bg-white/5 border border-white/20 text-transparent hover:border-white/40'
                    }`}
                    onClick={() => handleSetStatus(p.id, p.status === 'attempted' ? 'unsolved' : 'attempted')}
                    title={p.status === 'attempted' ? 'Mark unattempted' : 'Mark attempted'}
                  >
                    {p.status === 'attempted' && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex justify-center flex-shrink-0">
                  <button 
                    className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                      p.status === 'solved' ? 'bg-green-500 border border-green-500 text-black' : 
                      'bg-white/5 border border-white/20 text-transparent hover:border-white/40'
                    }`}
                    onClick={() => handleSetStatus(p.id, p.status === 'solved' ? 'unsolved' : 'solved')}
                    title={p.status === 'solved' ? 'Mark unsolved' : 'Mark solved'}
                  >
                    {p.status === 'solved' && (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </button>
                </div>
                <span className="font-mono text-gray-500">#{p.leetcode_number}</span>
                <span className="truncate">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-200 hover:text-indigo-400 transition-colors">
                    {p.title}
                  </a>
                </span>
                <span>
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase border ${
                    p.difficulty === 'Easy' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                    p.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                    'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {p.difficulty}
                  </span>
                </span>
                <div className="flex flex-wrap gap-2 pr-2">
                  {p.pattern_name && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 truncate max-w-full">
                      {p.pattern_name}
                    </span>
                  )}
                  {p.companies && p.companies.length > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20 truncate max-w-full hidden sm:inline-block">
                      {p.companies[0]}
                    </span>
                  )}
                </div>
                <div className="flex justify-center">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.title); }} 
                    className="p-1.5 text-gray-600 hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-md" 
                    title="Delete problem"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Problem Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6">Add Problem</h2>
            <div className="space-y-4">
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
                  <div className="absolute left-6 right-6 mt-1 bg-neutral-800 border border-white/10 rounded-lg shadow-xl overflow-hidden z-20 max-h-60 overflow-y-auto">
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

              {addError && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{addError}</div>}

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
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors" onClick={() => { setShowAddModal(false); setPreview(null); setSearchQuery(''); setSearchResults([]); }}>
                Cancel
              </button>
              <button 
                className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleAddProblem} 
                disabled={!preview}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Connect LeetCode Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowImportModal(false)}>
          <div className="bg-neutral-900 border border-white/10 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#1c1c1c] p-6 border-b border-white/10 relative">
              <button 
                onClick={() => setShowImportModal(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFA116]/10 flex items-center justify-center border border-[#FFA116]/20">
                  <svg className="w-6 h-6 text-[#FFA116]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.105 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.939 5.939 0 0 0 1.271 1.541 5.995 5.995 0 0 0 .678.463 6.115 6.115 0 0 0 1.08.452 6.324 6.324 0 0 0 1.954.218 6.426 6.426 0 0 0 1.109-.134 6.55 6.55 0 0 0 1.97-.68 6.57 6.57 0 0 0 .445-.278 6.643 6.643 0 0 0 .848-.731l6.19-6.6a1.365 1.365 0 0 0 .408-.98 1.353 1.353 0 0 0-.411-.986l-2.092-2.228a1.354 1.354 0 0 0-.974-.423 1.366 1.366 0 0 0-.966.428l-5.694 6.07a1.27 1.27 0 0 1-.9.395 1.246 1.246 0 0 1-.892-.379l-1.636-1.742a1.26 1.26 0 0 1-.378-.893 1.278 1.278 0 0 1 .378-.9l6.305-6.721A1.368 1.368 0 0 0 13.483 0zm-2.866 12.815a1.362 1.362 0 0 0-.96.44l-2.24 2.39a1.351 1.351 0 0 0-.406.983c0 .359.135.703.385.962l2.366 2.516c.26.275.617.432.993.432.378 0 .736-.157.995-.432l2.253-2.396a1.354 1.354 0 0 0 .406-.983 1.34 1.34 0 0 0-.406-.968l-2.39-2.502a1.347 1.347 0 0 0-.996-.442z"></path>
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white leading-tight">Import from LeetCode</h2>
                  <p className="text-gray-400 text-sm">Sync your submissions directly from your browser</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <LeetCodeImport 
                onSuccess={() => fetchProblems()} 
                onCancel={() => setShowImportModal(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
