import { Users, BookOpen, ChevronRight } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { Badge } from '@/shared/ui/badge';
import { Progress } from '@/shared/ui/progress';

const GroupCard = ({ group, index = 0, onOpen }) => {
  const total = group.problem_count || 0;
  const solved = group.solved_count || 0;
  const percent = total > 0 ? Math.round((solved / total) * 100) : 0;

  return (
    <Card
      role="button"
      tabIndex={0}
      className="text-left p-6 cursor-pointer transition-all duration-300 hover:bg-white/[0.04] hover:-translate-y-0.5 hover:border-emerald-500/20 group animate-rise"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
    >
      <div className="flex justify-between items-start mb-5">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors truncate">{group.name}</h3>
          <span className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1.5">
            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-gray-200 font-semibold">
              {group.creator_name.charAt(0).toUpperCase()}
            </span>
            by <span className="font-medium text-gray-400">{group.creator_name}</span>
          </span>
        </div>
        <span className="p-2 rounded-lg bg-white/5 text-muted-foreground group-hover:bg-emerald-500/15 group-hover:text-emerald-400 transition-colors flex-shrink-0">
          <ChevronRight className="w-5 h-5" />
        </span>
      </div>

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
          <span className="text-2xl font-bold text-white tabular-nums">{group.member_count}</span>
        </div>
        <div className="flex flex-col border-l border-white/[0.07] pl-4">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs uppercase tracking-wider font-semibold mb-1">
            <BookOpen className="w-3.5 h-3.5" />
            Problems
          </span>
          <span className="text-2xl font-bold text-white tabular-nums">{group.problem_count}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.07] pt-4">
        <Badge variant="success">{group.solved_count || 0} solved</Badge>
        <Badge variant="warning">{group.attempted_count || 0} attempted</Badge>
        <Badge variant="secondary">{group.unsolved_count || 0} unsolved</Badge>
      </div>
    </Card>
  );
};

export default GroupCard;
