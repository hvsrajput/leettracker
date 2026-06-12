import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, BookOpen, ChevronRight } from 'lucide-react';
import api from '../api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { toast } from '../components/ui/use-toast';

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
      toast({ title: 'Group created', description: groupName.trim(), variant: 'success' });
      setGroupName('');
      setShowCreate(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <div className="space-y-3">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24 md:pb-12 space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Groups</h1>
          <p className="text-muted-foreground mt-2">Collaborate and track progress together</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Create Group
        </Button>
      </header>

      {groups.length === 0 ? (
        <Card className="p-16 flex flex-col items-center justify-center text-center animate-rise">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No groups yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">Create a group and invite others to track coding progress together.</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            Create New Group
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {groups.map((g, idx) => {
            const total = g.problem_count || 0;
            const solved = g.solved_count || 0;
            const percent = total > 0 ? Math.round((solved / total) * 100) : 0;
            return (
              <Card
                role="button"
                tabIndex={0}
                className="text-left p-6 cursor-pointer transition-all duration-300 hover:bg-white/[0.04] hover:-translate-y-0.5 hover:border-emerald-500/20 group animate-rise"
                style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}
                key={g.id}
                onClick={() => navigate(`/groups/${g.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/groups/${g.id}`)}
              >
                <div className="flex justify-between items-start mb-5">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors truncate">{g.name}</h3>
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1.5">
                      <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-gray-200 font-semibold">
                        {g.creator_name.charAt(0).toUpperCase()}
                      </span>
                      by <span className="font-medium text-gray-400">{g.creator_name}</span>
                    </span>
                  </div>
                  <span className="p-2 rounded-lg bg-white/5 text-muted-foreground group-hover:bg-emerald-500/15 group-hover:text-emerald-400 transition-colors flex-shrink-0">
                    <ChevronRight className="w-5 h-5" />
                  </span>
                </div>

                {/* Completion bar */}
                <div className="flex items-center gap-3 mb-5">
                  <Progress className="flex-1" value={percent} />
                  <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{percent}%</span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-white/[0.07] pt-4">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">
                      <Users className="w-3.5 h-3.5" />
                      Members
                    </span>
                    <span className="text-2xl font-bold text-white tabular-nums">{g.member_count}</span>
                  </div>
                  <div className="flex flex-col border-l border-white/[0.07] pl-4">
                    <span className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">
                      <BookOpen className="w-3.5 h-3.5" />
                      Problems
                    </span>
                    <span className="text-2xl font-bold text-white tabular-nums">{g.problem_count}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
                  <Badge variant="success">{g.solved_count || 0} solved</Badge>
                  <Badge variant="warning">{g.attempted_count || 0} attempted</Badge>
                  <Badge variant="secondary">{g.unsolved_count || 0} unsolved</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); setError(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create New Group</DialogTitle>
            <DialogDescription>Invite friends and track problems together.</DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{error}</div>
          )}

          <div className="space-y-2">
            <Label htmlFor="group-name">Group Name</Label>
            <Input
              id="group-name"
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="e.g. Blind 75 Squad"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowCreate(false); setError(''); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!groupName.trim()}>
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
