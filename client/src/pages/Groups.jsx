import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { CARD, Button } from '../components/ui/primitives';

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24 md:pb-12 space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Groups</h1>
          <p className="text-gray-400 mt-2">Collaborate and track progress together</p>
        </div>
        <Button variant="primary" className="px-5 py-2.5" onClick={() => setShowCreate(true)}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Create Group
        </Button>
      </header>

      {groups.length === 0 ? (
        <div className={`${CARD} p-16 flex flex-col items-center justify-center text-center animate-rise`}>
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No groups yet</h3>
          <p className="text-gray-400 mb-6 max-w-sm">Create a group and invite others to track coding progress together.</p>
          <Button variant="primary" className="px-6 py-2.5" onClick={() => setShowCreate(true)}>
            Create New Group
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {groups.map((g, idx) => {
            const total = g.problem_count || 0;
            const solved = g.solved_count || 0;
            const percent = total > 0 ? Math.round((solved / total) * 100) : 0;
            return (
              <button
                type="button"
                className={`${CARD} text-left p-6 transition-all duration-300 hover:bg-white/[0.05] hover:-translate-y-0.5 group animate-rise`}
                style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}
                key={g.id}
                onClick={() => navigate(`/groups/${g.id}`)}
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors truncate">{g.name}</h3>
                    <span className="text-sm text-gray-500 flex items-center gap-1.5 mt-1.5">
                      <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-gray-200">
                        {g.creator_name.charAt(0).toUpperCase()}
                      </span>
                      by <span className="font-medium text-gray-400">{g.creator_name}</span>
                    </span>
                  </div>
                  <span className="p-2 rounded-lg bg-white/5 text-gray-500 group-hover:bg-emerald-500/15 group-hover:text-emerald-400 transition-colors flex-shrink-0">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </span>
                </div>

                {/* Completion bar */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">{percent}%</span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-white/[0.07] pt-4">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1.5 text-gray-500 text-xs uppercase tracking-wider font-semibold mb-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                      </svg>
                      Members
                    </span>
                    <span className="text-2xl font-bold text-white tabular-nums">{g.member_count}</span>
                  </div>
                  <div className="flex flex-col border-l border-white/[0.07] pl-4">
                    <span className="flex items-center gap-1.5 text-gray-500 text-xs uppercase tracking-wider font-semibold mb-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                      Problems
                    </span>
                    <span className="text-2xl font-bold text-white tabular-nums">{g.problem_count}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    {g.solved_count || 0} solved
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-amber-500/10 text-amber-300 border-amber-500/20">
                    {g.attempted_count || 0} attempted
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-white/5 text-gray-400 border-white/10">
                    {g.unsolved_count || 0} unsolved
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => setShowCreate(false)}>
          <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-rise" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-white mb-6">Create New Group</h2>
            {error && <div className="p-3 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>}

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="e.g. Blind 75 Squad"
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all placeholder-gray-600"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="primary" className="px-6" onClick={handleCreate} disabled={!groupName.trim()}>Create</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
