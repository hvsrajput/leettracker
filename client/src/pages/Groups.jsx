import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Groups() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.getCached('/groups', {}, 15000)
      .then(res => setGroups(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async () => {
    if (!groupName.trim()) return;
    setError('');
    try {
      const res = await api.post('/groups', { name: groupName.trim() });
      setGroups(prev => [{ ...res.data, creator_name: 'You' }, ...prev]);
      setGroupName('');
      setShowCreate(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh] text-gray-400">Loading groups...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Groups</h1>
          <p className="text-gray-400 mt-2">Collaborate and track progress together</p>
        </div>
        <button 
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 border border-green-500 transition-all font-medium text-sm text-white shadow-lg shadow-green-900/20" 
          onClick={() => setShowCreate(true)}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-16 flex flex-col items-center justify-center text-center">
          <svg className="w-16 h-16 text-gray-600 mb-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
          <h3 className="text-xl font-semibold text-white mb-2">No groups yet</h3>
          <p className="text-gray-400 mb-6">Create a group and invite others to track coding progress.</p>
          <button className="btn btn-primary bg-white text-black hover:bg-gray-200 px-6 py-2 rounded-lg font-medium transition-colors" onClick={() => setShowCreate(true)}>
            Create New Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map(g => (
            <div 
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 hover:bg-white/10 transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-lg shadow-black/30 group" 
              key={g.id} 
              onClick={() => navigate(`/groups/${g.id}`)}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">{g.name}</h3>
                  <span className="text-sm text-gray-400 flex items-center gap-1 mt-1.5">
                    <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-white">
                      {g.creator_name.charAt(0).toUpperCase()}
                    </span>
                    by <span className="font-medium text-gray-300">{g.creator_name}</span>
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-white/5 group-hover:bg-indigo-500/20 text-gray-400 group-hover:text-indigo-400 transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                    </svg>
                    <span className="text-xs uppercase tracking-wider font-semibold">Members</span>
                  </div>
                  <span className="text-2xl font-bold text-white">{g.member_count}</span>
                </div>
                <div className="flex flex-col border-l border-white/10 pl-4">
                  <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                    <span className="text-xs uppercase tracking-wider font-semibold">Problems</span>
                  </div>
                  <span className="text-2xl font-bold text-white">{g.problem_count}</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-green-500/10 text-green-400 border-green-500/20">
                  {g.solved_count || 0} solved
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-yellow-500/10 text-yellow-300 border-yellow-500/20">
                  {g.attempted_count || 0} attempted
                </span>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-white/5 text-gray-300 border-white/10">
                  {g.unsolved_count || 0} unsolved
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6">Create New Group</h2>
            {error && <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}
            
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="e.g. Blind 75 Squad"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-gray-600"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button 
                className="px-4 py-2 rounded-lg border border-white/10 text-gray-300 font-medium hover:bg-white/5 transition-colors" 
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button 
                className="px-6 py-2 rounded-lg bg-white text-black font-medium hover:bg-gray-200 transition-colors disabled:opacity-50" 
                onClick={handleCreate}
                disabled={!groupName.trim()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
