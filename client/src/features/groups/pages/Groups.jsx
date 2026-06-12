import { useNavigate } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { useGroups } from '@/features/groups/hooks/useGroups';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import GroupsSkeleton from '@/features/groups/components/GroupsSkeleton';
import GroupCard from '@/features/groups/components/GroupCard';
import CreateGroupDialog from '@/features/groups/components/CreateGroupDialog';

const Groups = () => {
  const navigate = useNavigate();
  const groups = useGroups();

  if (groups.loading) {
    return <GroupsSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24 md:pb-12 space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Groups</h1>
          <p className="text-muted-foreground mt-2">Collaborate and track progress together</p>
        </div>
        <Button onClick={groups.openCreate}>
          <Plus className="h-4 w-4" />
          Create Group
        </Button>
      </header>

      {groups.groups.length === 0 ? (
        <Card className="p-16 flex flex-col items-center justify-center text-center animate-rise">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No groups yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">Create a group and invite others to track coding progress together.</p>
          <Button onClick={groups.openCreate}>
            <Plus className="h-4 w-4" />
            Create New Group
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {groups.groups.map((g, idx) => (
            <GroupCard key={g.id} group={g} index={idx} onOpen={() => navigate(`/groups/${g.id}`)} />
          ))}
        </div>
      )}

      <CreateGroupDialog
        open={groups.showCreate}
        onClose={groups.closeCreate}
        groupName={groups.groupName}
        setGroupName={groups.setGroupName}
        error={groups.error}
        onCreate={groups.handleCreate}
      />
    </div>
  );
};

export default Groups;
