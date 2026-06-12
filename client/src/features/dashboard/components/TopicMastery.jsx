import { Card } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import { Button } from '@/shared/ui/button';
import SectionLabel from '@/features/dashboard/components/SectionLabel';

const TopicMastery = ({ allPatterns, visiblePatterns, showAllPatterns, onToggleShowAll }) => {
  if (allPatterns.length === 0) {
    return null;
  }

  return (
    <section>
      <SectionLabel hint={`${allPatterns.length} topics`}>Topic mastery</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {visiblePatterns.map((p, idx) => {
          const barColor = p.percent >= 80 ? 'bg-emerald-500' : p.percent >= 50 ? 'bg-indigo-400' : 'bg-amber-500';
          return (
            <Card
              key={p.pattern}
              className="p-4 sm:p-5 animate-rise"
              style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="font-medium text-sm text-gray-200 truncate" title={p.pattern}>{p.pattern}</span>
                <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{p.solved}/{p.total}</span>
              </div>
              <Progress className="h-1.5" value={p.percent} indicatorClassName={barColor} />
            </Card>
          );
        })}
      </div>
      {allPatterns.length > 8 && (
        <div className="flex justify-center mt-6">
          <Button variant="outline" onClick={onToggleShowAll}>
            {showAllPatterns ? 'Show less' : `Show all ${allPatterns.length} topics`}
          </Button>
        </div>
      )}
    </section>
  );
};

export default TopicMastery;
