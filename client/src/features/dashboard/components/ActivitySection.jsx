import { Card } from '@/shared/ui/card';
import { cn } from '@/shared/lib/utils';
import SectionLabel from '@/features/dashboard/components/SectionLabel';
import Heatmap from '@/features/dashboard/components/Heatmap';

const ActivitySection = ({ heatmapData, heatmapLoading, selectedYear, onSelectYear }) => {
  return (
    <section>
      <SectionLabel hint="Daily solves">Activity</SectionLabel>
      <Card className="p-4 sm:p-6 min-h-[280px] animate-rise">
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          {Array.from({ length: 5 }).map((_, i) => {
            const year = new Date().getFullYear() - i;
            const isActive = selectedYear === year;
            return (
              <button
                key={year}
                onClick={() => onSelectYear(year)}
                className={cn(
                  'text-xs font-medium transition-all duration-200 px-3 py-1.5 rounded-lg border',
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                    : 'text-muted-foreground border-transparent hover:text-gray-300 hover:bg-white/5'
                )}
              >
                {year}
              </button>
            );
          })}
        </div>

        {heatmapLoading ? (
          <div className="flex items-center justify-center text-muted-foreground h-full py-20">Loading activity...</div>
        ) : (
          <Heatmap data={heatmapData} year={selectedYear} />
        )}
      </Card>
    </section>
  );
};

export default ActivitySection;
