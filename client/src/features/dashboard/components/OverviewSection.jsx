import { Card } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import { cn } from '@/shared/lib/utils';
import SectionLabel from '@/features/dashboard/components/SectionLabel';
import { DIFFICULTY_COLOR } from '@/features/dashboard/utils/heatmap';

const RING_CIRCUMFERENCE = 2 * Math.PI * 42;

const OverviewSection = ({ totalSolved, totalProblems, totalPercent, difficultyStats }) => {
  return (
    <section>
      <SectionLabel hint={`${totalSolved}/${totalProblems} solved`}>Overview</SectionLabel>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Completion donut */}
        <Card className="p-6 sm:p-8 flex flex-col items-center justify-center animate-rise">
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" className="stroke-white/[0.06]" strokeWidth="7" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                className="stroke-emerald-500"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${(totalPercent / 100) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.22,1,0.36,1)' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-bold text-white tabular-nums">{totalPercent}%</span>
              <span className="text-xs text-muted-foreground mt-0.5">complete</span>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-6 text-center">
            <div>
              <div className="text-lg font-bold text-emerald-400 tabular-nums">{totalSolved}</div>
              <div className="text-xs text-muted-foreground">Solved</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div>
              <div className="text-lg font-bold text-gray-300 tabular-nums">{totalProblems}</div>
              <div className="text-xs text-muted-foreground">Tracked</div>
            </div>
          </div>
        </Card>

        {/* Difficulty breakdown */}
        <Card className="p-6 sm:p-8 lg:col-span-2 animate-rise" style={{ animationDelay: '80ms' }}>
          <h3 className="text-sm font-medium text-gray-300 mb-6">By difficulty</h3>
          {difficultyStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No difficulty data.</p>
          ) : (
            <div className="space-y-6">
              {difficultyStats.map((d) => {
                const colors = DIFFICULTY_COLOR[d.difficulty] || DIFFICULTY_COLOR.Medium;
                const percent = d.total > 0 ? Math.round((d.solved / d.total) * 100) : 0;
                return (
                  <div key={d.difficulty}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <span className={cn('w-2 h-2 rounded-full', colors.dot)} />
                        {d.difficulty}
                      </span>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        <span className={cn('font-semibold', colors.text)}>{d.solved}</span>
                        {' / '}{d.total}
                        <span className="ml-2 text-muted-foreground/70">{percent}%</span>
                      </span>
                    </div>
                    <Progress value={percent} indicatorClassName={colors.bar} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
};

export default OverviewSection;
