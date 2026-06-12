import { cn } from '@/shared/lib/utils';

const MembersBar = ({ members, currentUserId }) => (
  <div className="flex flex-wrap gap-3">
    {members?.map(m => (
      <div className="flex items-center gap-2 bg-white/[0.03] border border-white/10 px-3 py-1.5 rounded-full" key={m.id}>
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border',
          m.id === currentUserId
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
            : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
        )}>
          {m.username.charAt(0).toUpperCase()}
        </div>
        <span className="text-sm font-medium text-gray-300">{m.username}</span>
        {m.id === currentUserId && <span className="text-[10px] text-muted-foreground">you</span>}
      </div>
    ))}
  </div>
);

export default MembersBar;
