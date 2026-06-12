import { Users } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import SectionLabel from '@/features/dashboard/components/SectionLabel';

const GroupsList = ({ groupStats, onOpenGroup }) => {
  return (
    <div>
      <SectionLabel hint={groupStats?.length ? `${groupStats.length} groups` : undefined}>Groups</SectionLabel>
      {groupStats && groupStats.length > 0 ? (
        <div className="space-y-3">
          {groupStats.map((g, idx) => {
            const percent = g.total_problems > 0 ? Math.round((g.solved_problems / g.total_problems) * 100) : 0;
            return (
              <Card
                key={g.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpenGroup(g.id)}
                onKeyDown={(e) => e.key === 'Enter' && onOpenGroup(g.id)}
                className="w-full text-left p-5 cursor-pointer transition-colors hover:bg-white/[0.04] animate-rise"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="font-semibold text-white truncate">{g.name}</h3>
                  <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {g.member_count}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Progress className="flex-1" value={percent} />
                  <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{g.solved_problems}/{g.total_problems}</span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="p-8 text-center text-sm text-muted-foreground animate-rise">
          You're not in any groups yet.
        </Card>
      )}
    </div>
  );
};

export default GroupsList;
