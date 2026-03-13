import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import AddFromProblemsetModal from '../components/groups/AddFromProblemsetModal';
import { COMPANY_OPTIONS, getProblemTopics } from '../utils/problemFilters';

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddProblem, setShowAddProblem] = useState(false);
  const [showAddFromProblemset, setShowAddFromProblemset] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  
  // Advanced filters
  const [activePattern, setActivePattern] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [solvedFilter, setSolvedFilter] = useState('');
  const [groupStatusFilter, setGroupStatusFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

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

  const patterns = useMemo(() => {
    return getProblemTopics(group?.problems || []);
  }, [group]);

  // Filter problems by active pattern and other filters
  const filteredProblems = useMemo(() => {
    if (!group?.problems) return [];
    
    return group.problems.filter(p => {
      // Pattern filter
      const matchPattern = activePattern === 'all' || 
                           (p.topics?.includes(activePattern) || p.pattern_name === activePattern);
      if (!matchPattern) return false;
      
      // Difficulty filter
      if (difficultyFilter && p.difficulty !== difficultyFilter) return false;
      
      // Company filter
      if (companyFilter && (!p.companies || !p.companies.includes(companyFilter))) return false;
      
      // Personal Status Filter (match behavior of Problems page)
      if (solvedFilter) {
        const myStatus = p.member_statuses?.find(ms => ms.user_id === user?.id)?.status || 'unsolved';
        if (solvedFilter === 'true' && myStatus !== 'solved') return false;
        if (solvedFilter === 'false' && myStatus !== 'unsolved') return false;
        if (solvedFilter === 'attempted' && myStatus !== 'attempted') return false;
      }

      // Group Status Filter (any member solved vs none)
      if (groupStatusFilter) {
        const anySolved = p.member_statuses?.some(ms => ms.solved);
        if (groupStatusFilter === 'true' && !anySolved) return false;
        if (groupStatusFilter === 'false' && anySolved) return false;
      }
      
      return true;
    });
  }, [group, user, activePattern, difficultyFilter, solvedFilter, groupStatusFilter, companyFilter]);

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

  const handleAddFromProblemset = async (problem) => {
    try {
      await api.post(`/groups/${id}/problems`, { problem_id: problem.id });
      fetchGroup();
      // We don't close the modal so they can keep adding
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.error.includes('already in group')) {
        alert('Problem already exists in this group');
      } else {
        alert(err.response?.data?.error || 'Failed to add problem');
      }
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

  if (loading) return <div className="flex items-center justify-center min-h-[50vh] text-gray-400">Loading group...</div>;
  if (!group) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <button 
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4" 
            onClick={() => navigate('/groups')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to Groups
          </button>
          <h1 className="text-3xl font-bold text-white tracking-tight">{group.name}</h1>
          <p className="text-gray-400 mt-2">
            {group.members?.length} members · {group.problems?.length} problems · Created by {group.creator_name}
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-medium text-sm text-gray-200" 
            onClick={() => setShowAddMember(true)}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
            Add Member
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-medium text-sm text-gray-200" 
            onClick={() => setShowAddFromProblemset(true)}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
            Add From My Problems
          </button>
          <button 
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 transition-all font-medium text-sm text-white shadow-lg shadow-indigo-900/20" 
            onClick={() => setShowAddProblem(true)}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Problem
          </button>
        </div>
      </div>

      {/* Members Bar */}
      <div className="flex flex-wrap gap-3">
        {group.members?.map(m => (
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full" key={m.id}>
            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold border border-indigo-500/30">
              {m.username.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-300">{m.username}</span>
          </div>
        ))}
      </div>

      {/* Dynamic Pattern Tabs */}
      <div className="flex flex-wrap gap-3 mb-4 mt-6">
        <button 
          onClick={() => setActivePattern('all')}
          className={`transition-all ${activePattern === 'all' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl px-4 py-2' : 'bg-white/5 border border-white/10 rounded-xl px-4 py-2 hover:bg-white/10 text-gray-300'}`}
        >
          All
        </button>
        {patterns.map(p => (
           <button 
             key={p}
             onClick={() => setActivePattern(p)}
             className={`transition-all ${activePattern === p ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl px-4 py-2' : 'bg-white/5 border border-white/10 rounded-xl px-4 py-2 hover:bg-white/10 text-gray-300'}`}
           >
             {p}
           </button>
        ))}
      </div>

      <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="mb-6 mt-4 flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
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
            {/* Personal Status Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full group">
              <div className="flex items-center gap-2 w-32 flex-shrink-0 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span className="text-sm">My Status</span>
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
            {/* Group Status Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full group">
              <div className="flex items-center gap-2 w-32 flex-shrink-0 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                </svg>
                <span className="text-sm">Group Status</span>
              </div>
              <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 w-24 flex-shrink-0">
                <span>is</span>
                <svg className="w-3 h-3 ml-auto opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
              <select 
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-indigo-500 appearance-none bg-no-repeat bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2220%22%20height%3D%2220%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20d%3D%22M7%2010l5%205%205-5H7z%22%20fill%3D%22%23ffffff40%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_8px_center] pr-10"
                value={groupStatusFilter} 
                onChange={e => setGroupStatusFilter(e.target.value)}
              >
                <option value="">Any Group Status</option>
                <option value="true">Solved by Anyone</option>
                <option value="false">Unsolved by All</option>
              </select>
              <button className="p-1.5 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100" onClick={() => setGroupStatusFilter('')}>
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
                <span className="text-sm">Topic</span>
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
                {patterns.map(p => <option key={p} value={p}>{p}</option>)}
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
              onClick={() => { setDifficultyFilter(''); setSolvedFilter(''); setGroupStatusFilter(''); setCompanyFilter(''); setActivePattern('all'); }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Group Problem Table */}
      {filteredProblems.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-12 flex flex-col items-center justify-center text-center">
          <svg className="w-16 h-16 text-gray-600 mb-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <h3 className="text-xl font-semibold text-white mb-2">{activePattern === 'all' ? 'No problems in this group' : `No "${activePattern}" problems`}</h3>
          <p className="text-gray-400">{activePattern === 'all' ? 'Add problems to start tracking progress together!' : 'Try selecting a different pattern.'}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md overflow-x-auto">
          <div className="min-w-max">
            {/* Table Header */}
            <div className="flex p-4 border-b border-white/10 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-white/5">
              <span className="w-16 flex-shrink-0">#</span>
              <span className="w-64 flex-shrink-0">Problem</span>
              <span className="w-32 flex-shrink-0">Difficulty</span>
              <div className="flex-1 flex justify-between px-4 gap-8">
                {group.members?.map(m => (
                  <span className="w-16 text-center truncate" key={m.id} title={m.username}>
                    {m.username.substring(0, 5)}
                  </span>
                ))}
              </div>
            </div>
            {/* Table Body */}
            <div className="divide-y divide-white/5">
              {filteredProblems.map((p, i) => (
                <div 
                  className={`flex p-4 items-center transition-all duration-200 hover:bg-white/5 ${p.solved ? 'bg-green-500/[0.02]' : ''}`}
                  key={p.leetcode_number}
                >
                  <span className="w-16 flex-shrink-0 font-mono text-gray-500 text-sm">#{p.leetcode_number}</span>
                  <span className="w-64 flex-shrink-0 truncate pr-4">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-200 hover:text-indigo-400 transition-colors title-link">
                      {p.title}
                    </a>
                  </span>
                  <span className="w-32 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase border inline-block ${
                      p.difficulty === 'Easy' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                      p.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                      {p.difficulty}
                    </span>
                  </span>
                  <div className="flex-1 flex justify-between px-4 gap-8">
                    {p.member_statuses?.map(ms => (
                      <span className="w-16 flex justify-center" key={ms.user_id}>
                        {ms.user_id === user?.id ? (
                          <button 
                            className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                              ms.solved 
                                ? 'bg-green-500 border border-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.3)]' 
                                : 'bg-white/5 border border-white/20 text-transparent hover:border-white/40'
                            }`}
                            onClick={() => handleToggle(p.id)}
                            title={ms.solved ? 'Mark unsolved' : 'Mark solved'}
                          >
                            {ms.solved && (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            )}
                          </button>
                        ) : (
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
                            ms.solved 
                              ? 'bg-green-500/10 border-green-500/30 text-green-500' 
                              : 'bg-transparent border-white/5 text-white/10'
                          }`}>
                            {ms.solved ? (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                              </svg>
                            ) : (
                              <div className="w-1.5 h-px bg-white/20"></div>
                            )}
                          </div>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowAddMember(false); setError(''); }}>
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6">Add Member</h2>
            {error && <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter LeetTracker username..."
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-gray-600"
                onKeyDown={e => e.key === 'Enter' && handleAddMember()}
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors" onClick={() => { setShowAddMember(false); setError(''); }}>Cancel</button>
              <button className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-gray-200 transition-colors" onClick={handleAddMember} disabled={!username.trim()}>Add</button>
            </div>
          </div>
        </div>
      )}

      <AddFromProblemsetModal
        isOpen={showAddFromProblemset}
        onClose={() => setShowAddFromProblemset(false)}
        onAddProblem={handleAddFromProblemset}
        existingProblems={group.problems || []}
      />

      {/* Add Problem Modal */}
      {showAddProblem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={resetProblemModal}>
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6">Add Problem to Group</h2>
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
                  {isSearching && <span className="absolute right-3 top-2.5 text-indigo-400">...</span>}
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

              {error && <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

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
              <button className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors" onClick={resetProblemModal}>
                Cancel
              </button>
              <button 
                className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" 
                onClick={handleAddProblem} 
                disabled={!preview}
              >
                Add Problem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
