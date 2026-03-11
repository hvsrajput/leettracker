import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import './Groups.css';

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/groups')
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

  if (loading) return <div className="page-loading">Loading groups...</div>;

  return (
    <div className="groups-page container animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Groups</h1>
          <p className="page-desc">Collaborate and track progress together</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Create Group
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
          </span>
          <h3>No groups yet</h3>
          <p>Create a group or get invited to one!</p>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map(g => (
            <div className="group-card transition-transform duration-300 hover:scale-[1.02] hover:ring-1 hover:ring-green-500/30 cursor-pointer" key={g.id} onClick={() => navigate(`/groups/${g.id}`)}>
              <div className="group-card-header">
                <h3>{g.name}</h3>
                <span className="group-creator">by {g.creator_name}</span>
              </div>
              <div className="group-card-stats">
                <div className="group-card-stat">
                  <span className="gcs-icon text-gray-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                    </svg>
                  </span>
                  <span className="gcs-val">{g.member_count}</span>
                  <span className="gcs-label">Members</span>
                </div>
                <div className="group-card-stat">
                  <span className="gcs-icon text-gray-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                    </svg>
                  </span>
                  <span className="gcs-val">{g.problem_count}</span>
                  <span className="gcs-label">Problems</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay backdrop-blur-sm transition-all duration-300" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content shadow-2xl shadow-green-900/20" onClick={e => e.stopPropagation()}>
            <h2>Create New Group</h2>
            {error && <div className="auth-error">{error}</div>}
            <div className="form-group">
              <label>Group Name</label>
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="e.g. Blind 75 Squad"
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
