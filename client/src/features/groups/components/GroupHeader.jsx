import { ArrowLeft, Plus, UserPlus, ListPlus, Trash2 } from 'lucide-react';
import { Button } from '@/shared/ui/button';

const GroupHeader = ({
  group,
  isGroupCreator,
  onBack,
  onAddMember,
  onAddFromProblemset,
  onAddProblem,
  onDeleteGroup,
}) => (
  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
    <div>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-2" onClick={onBack}>
        <ArrowLeft className="w-4 h-4" />
        Back to Groups
      </Button>
      <h1 className="text-3xl font-bold text-white tracking-tight">{group.name}</h1>
      <p className="text-muted-foreground mt-2">
        {group.members?.length} members · {group.problems?.length} problems · Created by {group.creator_name}
      </p>
    </div>
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={onAddMember}>
        <UserPlus className="w-4 h-4" />
        Add Member
      </Button>
      <Button variant="outline" onClick={onAddFromProblemset}>
        <ListPlus className="w-4 h-4" />
        Add From My Problems
      </Button>
      <Button onClick={onAddProblem}>
        <Plus className="w-4 h-4" />
        Add Problem
      </Button>
      {isGroupCreator && (
        <Button variant="destructive" onClick={onDeleteGroup}>
          <Trash2 className="w-4 h-4" />
          Delete Group
        </Button>
      )}
    </div>
  </div>
);

export default GroupHeader;
