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
          <span className="empty-icon">👥</span>
          <h3>No groups yet</h3>
          <p>Create a group or get invited to one!</p>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map(g => (
            <Link to={`/groups/${g.id}`} className="group-card card" key={g.id}>
              <div className="group-card-header">
                <h3>{g.name}</h3>
                <span className="group-creator">by {g.creator_name}</span>
              </div>
              <div className="group-card-stats">
                <div className="group-card-stat">
                  <span className="gcs-icon">👥</span>
                  <span className="gcs-val">{g.member_count}</span>
                  <span className="gcs-label">Members</span>
                </div>
                <div className="group-card-stat">
                  <span className="gcs-icon">📝</span>
                  <span className="gcs-val">{g.problem_count}</span>
                  <span className="gcs-label">Problems</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Create Group</h2>
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
