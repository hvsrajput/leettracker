import {
  ArrowLeft,
  Plus,
  UserPlus,
  ListPlus,
  Trash2,
  Link2,
  Pencil,
  ChevronDown,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/shared/ui/dropdown-menu';

const GroupHeader = ({
  group,
  isGroupCreator,
  onBack,
  onInvite,
  onAddMember,
  onAddFromProblemset,
  onAddProblem,
  onRenameGroup,
  onDeleteGroup,
}) => (
  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
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

    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={onInvite}>
        <Link2 className="w-4 h-4" />
        Invite
      </Button>

      {/* Add problems — single or from your problemset */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Add
            <ChevronDown className="w-4 h-4 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onAddProblem} className="cursor-pointer">
            <Plus />
            Add a problem
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAddFromProblemset} className="cursor-pointer">
            <ListPlus />
            Add from my problems
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Manage — members + creator-only settings */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Group options">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={onAddMember} className="cursor-pointer">
            <UserPlus />
            Add member
          </DropdownMenuItem>
          {isGroupCreator && (
            <>
              <DropdownMenuItem onClick={onRenameGroup} className="cursor-pointer">
                <Pencil />
                Rename group
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDeleteGroup}
                className="cursor-pointer text-rose-400 focus:bg-rose-500/10 focus:text-rose-300"
              >
                <Trash2 />
                Delete group
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
);

export default GroupHeader;
