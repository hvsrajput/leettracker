import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

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

  if (!user) return <div className="flex items-center justify-center min-h-[50vh] text-gray-400">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Profile & Settings</h1>
        <p className="text-gray-400 mt-2">Manage your account and integrations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Account Details Component */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 shadow-lg shadow-black/30 w-full h-max">
          <div className="flex items-center gap-3 mb-6">
            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
            </svg>
            <h2 className="text-xl font-bold text-white">Account Details</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5">
              <span className="text-gray-400 text-sm font-medium">Username</span>
              <span className="text-white font-medium">{user.username}</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5">
              <span className="text-gray-400 text-sm font-medium">Email</span>
              <span className="text-white font-medium">{user.email}</span>
            </div>
          </div>
        </div>

        {/* LeetCode Integration Component */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 shadow-lg shadow-black/30 w-full">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#FFA116]/10 flex items-center justify-center border border-[#FFA116]/20">
              <svg className="w-4 h-4 text-[#FFA116]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.105 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.939 5.939 0 0 0 1.271 1.541 5.995 5.995 0 0 0 .678.463 6.115 6.115 0 0 0 1.08.452 6.324 6.324 0 0 0 1.954.218 6.426 6.426 0 0 0 1.109-.134 6.55 6.55 0 0 0 1.97-.68 6.57 6.57 0 0 0 .445-.278 6.643 6.643 0 0 0 .848-.731l6.19-6.6a1.365 1.365 0 0 0 .408-.98 1.353 1.353 0 0 0-.411-.986l-2.092-2.228a1.354 1.354 0 0 0-.974-.423 1.366 1.366 0 0 0-.966.428l-5.694 6.07a1.27 1.27 0 0 1-.9.395 1.246 1.246 0 0 1-.892-.379l-1.636-1.742a1.26 1.26 0 0 1-.378-.893 1.278 1.278 0 0 1 .378-.9l6.305-6.721A1.368 1.368 0 0 0 13.483 0zm-2.866 12.815a1.362 1.362 0 0 0-.96.44l-2.24 2.39a1.351 1.351 0 0 0-.406.983c0 .359.135.703.385.962l2.366 2.516c.26.275.617.432.993.432.378 0 .736-.157.995-.432l2.253-2.396a1.354 1.354 0 0 0 .406-.983 1.34 1.34 0 0 0-.406-.968l-2.39-2.502a1.347 1.347 0 0 0-.996-.442z"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">LeetCode Configuration</h2>
          </div>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            Connect your LeetCode account to automatically sync your completed public problems via their GraphQL APIs.
          </p>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Public Username</label>
              <input
                type="text"
                placeholder="e.g. harshvardhan123"
                value={leetcodeUsername}
                onChange={(e) => setLeetcodeUsername(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:ring-1 focus:ring-[#FFA116] focus:border-[#FFA116] outline-none transition-all placeholder-gray-600"
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-white/10 text-white font-medium hover:bg-white/20 border border-white/10 transition-colors disabled:opacity-50" 
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Update Username'}
            </button>
          </form>

          {user?.leetcodeUsername && (
            <div className="mt-8 pt-6 border-t border-white/10">
              <h3 className="text-lg font-semibold text-white mb-2">Automated Data Sync Status</h3>
              <p className="text-sm text-gray-400 mb-4 leading-relaxed">Fetch your latest solved and attempted submissions instantly.</p>
              <button 
                onClick={handleSync} 
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#FFA116]/10 text-[#FFA116] font-medium hover:bg-[#FFA116]/20 border border-[#FFA116]/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2" 
                disabled={syncing}
              >
                {syncing && (
                  <svg className="animate-spin h-4 w-4 text-[currentColor]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {syncing ? 'Syncing...' : 'Quick Sync Public Data'}
              </button>
            </div>
          )}

          {message && (
            <div className={`mt-6 p-4 rounded-xl border flex items-start gap-3 text-sm ${
              message.type === 'success' 
                ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}>
              {message.type === 'success' ? (
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              )}
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
