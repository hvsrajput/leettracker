import { TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import { cn } from '@/shared/lib/utils';
import SectionLabel from '@/features/dashboard/components/SectionLabel';

const PatternFocus = ({ patternHeatmap }) => {
  if (!patternHeatmap || !(patternHeatmap.strongest || patternHeatmap.weakest || patternHeatmap.neglected)) {
    return null;
  }

  const entries = [
    {
      data: patternHeatmap.strongest,
      label: 'Strongest',
      accent: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      bar: 'bg-emerald-500',
      Icon: TrendingUp,
    },
    {
      data: patternHeatmap.weakest,
      label: 'Needs work',
      accent: 'text-amber-400',
      bg: 'bg-amber-500/10',
      bar: 'bg-amber-500',
      Icon: AlertTriangle,
    },
    {
      data: patternHeatmap.neglected,
      label: 'Neglected',
      accent: 'text-gray-400',
      bg: 'bg-gray-500/10',
      bar: 'bg-gray-500',
      Icon: Clock,
    },
  ].filter((entry) => entry.data);

  return (
    <section>
      <SectionLabel hint="Where to focus next">Pattern focus</SectionLabel>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {entries.map((entry, idx) => (
          <Card
            key={entry.label}
            className="p-6 animate-rise"
            style={{ animationDelay: `${idx * 70}ms` }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className={cn('p-1.5 rounded-lg', entry.bg, entry.accent)}>
                <entry.Icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{entry.label}</span>
            </div>
            <div className="text-lg font-bold text-white truncate" title={entry.data.pattern}>{entry.data.pattern}</div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-muted-foreground tabular-nums">{entry.data.solved}/{entry.data.total}</span>
              <span className={cn('font-semibold tabular-nums', entry.accent)}>{entry.data.percent}%</span>
            </div>
            <Progress className="mt-2 h-1.5" value={entry.data.percent} indicatorClassName={entry.bar} />
          </Card>
        ))}
      </div>
    </section>
  );
};

export default PatternFocus;
