import { Users, ChevronDown, Check, Minus } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

const GroupPicker = ({
  userGroups,
  groupsLoading,
  selectedGroupIds,
  selectedCount,
  showGroupConfig,
  setShowGroupConfig,
  toggleGroup,
  toggleAllGroups,
}) => {
  const allSelected = selectedGroupIds.length === userGroups.length && userGroups.length > 0;
  const someSelected = selectedGroupIds.length > 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        onClick={() => setShowGroupConfig(!showGroupConfig)}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
            <Users className="w-4.5 h-4.5 text-indigo-400" size={18} />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">Auto-add to Groups</div>
            <div className="text-xs text-muted-foreground">
              {groupsLoading
                ? 'Loading groups...'
                : selectedCount > 0
                  ? `${selectedCount} group${selectedCount > 1 ? 's' : ''} selected`
                  : 'No groups selected — problems go to your tracker only'}
            </div>
          </div>
        </div>
        <ChevronDown className={cn('w-5 h-5 text-muted-foreground transition-transform duration-200', showGroupConfig && 'rotate-180')} />
      </button>

      {showGroupConfig && (
        <div className="border-t border-white/10 p-4 animate-fade-in">
          {groupsLoading ? (
            <div className="text-center text-muted-foreground text-sm py-4">Loading your groups...</div>
          ) : userGroups.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-muted-foreground text-sm mb-2">You haven't joined any groups yet.</p>
              <a href="/groups" className="text-indigo-400 text-sm font-medium hover:text-indigo-300 transition-colors">
                Browse Groups &rarr;
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={toggleAllGroups}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
              >
                <div className={cn(
                  'w-5 h-5 rounded-md flex items-center justify-center border transition-all flex-shrink-0',
                  allSelected ? 'bg-indigo-500 border-indigo-500' : someSelected ? 'bg-indigo-500/30 border-indigo-500/50' : 'border-white/20'
                )}>
                  {someSelected && (
                    allSelected
                      ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                      : <Minus className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  )}
                </div>
                <span className="text-sm font-medium text-gray-300">
                  {allSelected ? 'Deselect All' : 'Select All'}
                </span>
              </button>

              <div className="h-px bg-white/5" />

              {userGroups.map(group => {
                const isSelected = selectedGroupIds.includes(group.id);
                return (
                  <button
                    key={group.id}
                    onClick={() => toggleGroup(group.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left border',
                      isSelected ? 'bg-indigo-500/10 border-indigo-500/20' : 'hover:bg-white/5 border-transparent'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center border transition-all flex-shrink-0',
                      isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-white/20'
                    )}>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white truncate">{group.name}</div>
                      <div className="text-xs text-muted-foreground">{group.member_count} member{group.member_count !== 1 ? 's' : ''} · {group.problem_count} problem{group.problem_count !== 1 ? 's' : ''}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupPicker;
