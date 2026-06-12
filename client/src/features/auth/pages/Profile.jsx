import { useState, useEffect } from 'react';
import { User, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { toast } from '../components/ui/use-toast';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [leetcodeUsername, setLeetcodeUsername] = useState(user?.leetcodeUsername || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user?.leetcodeUsername) {
      setLeetcodeUsername(user.leetcodeUsername);
    }
  }, [user]);

  const saveLeetCodeUsername = async (nextUsername) => {
    const normalizedUsername = nextUsername.trim();
    const res = await api.put('/auth/me/leetcode-username', { leetcodeUsername: normalizedUsername });

    if (updateUser) {
      updateUser({ ...user, leetcodeUsername: res.data.leetcodeUsername });
    }

    setLeetcodeUsername(normalizedUsername);
    return normalizedUsername;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveLeetCodeUsername(leetcodeUsername);
      toast({ title: 'Settings saved', description: 'Your LeetCode username has been updated.', variant: 'success' });
    } catch (err) {
      toast({ title: 'Failed to save settings', description: err.response?.data?.error || '', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center gap-2 min-h-[50vh] text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 pb-24 md:pb-12 space-y-8 animate-fade-in">
      <header>
        <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Profile & Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account and integrations</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Account Details */}
        <Card className="h-max animate-rise">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <User className="h-4.5 w-4.5" size={18} />
              </span>
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/[0.06]">
              <span className="text-muted-foreground text-sm font-medium">Username</span>
              <span className="text-white font-medium">{user.username}</span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/[0.06]">
              <span className="text-muted-foreground text-sm font-medium">Email</span>
              <span className="text-white font-medium">{user.email}</span>
            </div>
          </CardContent>
        </Card>

        {/* LeetCode Integration */}
        <Card className="animate-rise" style={{ animationDelay: '80ms' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFA116]/10 border border-[#FFA116]/20">
                <svg className="w-4.5 h-4.5 text-[#FFA116]" width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.105 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.939 5.939 0 0 0 1.271 1.541 5.995 5.995 0 0 0 .678.463 6.115 6.115 0 0 0 1.08.452 6.324 6.324 0 0 0 1.954.218 6.426 6.426 0 0 0 1.109-.134 6.55 6.55 0 0 0 1.97-.68 6.57 6.57 0 0 0 .445-.278 6.643 6.643 0 0 0 .848-.731l6.19-6.6a1.365 1.365 0 0 0 .408-.98 1.353 1.353 0 0 0-.411-.986l-2.092-2.228a1.354 1.354 0 0 0-.974-.423 1.366 1.366 0 0 0-.966.428l-5.694 6.07a1.27 1.27 0 0 1-.9.395 1.246 1.246 0 0 1-.892-.379l-1.636-1.742a1.26 1.26 0 0 1-.378-.893 1.278 1.278 0 0 1 .378-.9l6.305-6.721A1.368 1.368 0 0 0 13.483 0zm-2.866 12.815a1.362 1.362 0 0 0-.96.44l-2.24 2.39a1.351 1.351 0 0 0-.406.983c0 .359.135.703.385.962l2.366 2.516c.26.275.617.432.993.432.378 0 .736-.157.995-.432l2.253-2.396a1.354 1.354 0 0 0 .406-.983 1.34 1.34 0 0 0-.406-.968l-2.39-2.502a1.347 1.347 0 0 0-.996-.442z"></path>
                </svg>
              </span>
              LeetCode Configuration
            </CardTitle>
            <CardDescription className="pt-1">
              Save your public LeetCode username here. Syncing is available from the Problems page import flow.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lc-username">Public Username</Label>
                <Input
                  id="lc-username"
                  type="text"
                  placeholder="e.g. harshvardhan123"
                  value={leetcodeUsername}
                  onChange={(e) => setLeetcodeUsername(e.target.value)}
                  className="focus-visible:ring-[#FFA116]/40 focus-visible:border-[#FFA116]/60"
                />
              </div>

              <Button type="submit" variant="secondary" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving...' : 'Update Username'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
