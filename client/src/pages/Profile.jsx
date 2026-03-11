import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import './Profile.css';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [leetcodeUsername, setLeetcodeUsername] = useState(user?.leetcodeUsername || '');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  
  useEffect(() => {
    if (user?.leetcodeUsername) {
      setLeetcodeUsername(user.leetcodeUsername);
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.put('/auth/me/leetcode-username', { leetcodeUsername });
      if (updateUser) {
         updateUser({ ...user, leetcodeUsername: res.data.leetcodeUsername });
      }
      setMessage({ type: 'success', text: 'Settings saved successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await api.post('/leetcode/sync');
      const { solved, attempted } = res.data;
      let msg = `Sync successful! ${solved} solved`;
      if (attempted) msg += `, ${attempted} attempted`;
      msg += ' problems imported.';
      setMessage({ type: 'success', text: msg });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to sync from LeetCode. Ensure your username is correct.' });
    } finally {
      setSyncing(false);
    }
  };

  if (!user) return <div className="page-loading">Loading...</div>;

  return (
    <div className="profile-container container animate-fade-in">
      <div className="page-header">
        <h1>Profile & Settings</h1>
        <p className="page-desc">Manage your account and integrations</p>
      </div>

      <div className="profile-grid">
        <div className="profile-card">
          <h2>Account Details</h2>
          <div className="detail-row">
            <span className="detail-label">Username</span>
            <span className="detail-value">{user.username}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Email</span>
            <span className="detail-value">{user.email}</span>
          </div>
        </div>

        <div className="profile-card leetcode-integration">
          <h2>LeetCode Integration</h2>
          <p className="integration-desc">
            Connect your LeetCode account to automatically sync your completed problems. 
            We use the public GraphQL API.
          </p>

          <form onSubmit={handleSave} className="leetcode-form">
            <div className="form-group">
              <label>LeetCode Username</label>
              <input
                type="text"
                placeholder="e.g. harshvardhan123"
                value={leetcodeUsername}
                onChange={(e) => setLeetcodeUsername(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>

          {user?.leetcodeUsername && (
            <div className="sync-section">
              <div className="divider"></div>
              <h3>Manual Sync</h3>
              <p className="sync-desc">Fetch your latest solved and attempted submissions from LeetCode.</p>
              <button onClick={handleSync} className="btn-success" disabled={syncing}>
                {syncing ? 'Syncing...' : 'Sync from LeetCode'}
              </button>
            </div>
          )}

          {message && (
            <div className={`status-message ${message.type}`}>
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
