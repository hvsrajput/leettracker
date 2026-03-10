import { useState, useEffect } from 'react';
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
  const [lcNumber, setLcNumber] = useState('');
  const [error, setError] = useState('');

  const fetchGroup = () => {
    api.get(`/groups/${id}`)
      .then(res => setGroup(res.data))
      .catch(() => navigate('/groups'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchGroup(); }, [id]);

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

  const handleAddProblem = async () => {
    if (!lcNumber) return;
    setError('');
    try {
      // First ensure the problem exists in the DB
      let problemRes;
      try {
        problemRes = await api.post('/problems', { leetcode_number: parseInt(lcNumber) });
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
      setLcNumber('');
      setShowAddProblem(false);
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

      {/* Group Problem Table */}
      {group.problems?.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📝</span>
          <h3>No problems in this group</h3>
          <p>Add problems by their LeetCode number!</p>
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
          {group.problems.map((p, i) => (
            <div className="group-problem-row" key={p.id} style={{ animationDelay: `${i * 0.03}s` }}>
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
        <div className="modal-overlay" onClick={() => { setShowAddProblem(false); setError(''); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Add Problem to Group</h2>
            {error && <div className="auth-error">{error}</div>}
            <div className="form-group">
              <label>LeetCode Problem Number</label>
              <input
                type="number"
                value={lcNumber}
                onChange={e => setLcNumber(e.target.value)}
                placeholder="e.g. 1, 42, 200..."
                onKeyDown={e => e.key === 'Enter' && handleAddProblem()}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => { setShowAddProblem(false); setError(''); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddProblem}>Add Problem</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
