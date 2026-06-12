import { Check, ChevronDown, SlidersHorizontal, RotateCcw, Users, Tag } from 'lucide-react';
import TopicFilterTabs from '@/shared/components/TopicFilterTabs';
import { FilterRow } from '@/shared/components/StatusControls';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Badge } from '@/shared/ui/badge';
import { Card } from '@/shared/ui/card';

const GroupFilters = ({
  patterns,
  activePattern,
  setActivePattern,
  showAdvancedFilters,
  setShowAdvancedFilters,
  sortBy,
  setSortBy,
  solvedFilter,
  setSolvedFilter,
  groupStatusFilter,
  setGroupStatusFilter,
  difficultyFilter,
  setDifficultyFilter,
  resetFilters,
}) => (
  <>
    <div className="mt-6">
      <TopicFilterTabs
        patterns={patterns}
        activePattern={activePattern}
        onSelect={setActivePattern}
        accent="indigo"
      />
    </div>

    <div className="mb-6 mt-4 flex flex-wrap items-center justify-between gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
        className="gap-2"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Advanced Filters
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showAdvancedFilters && 'rotate-180')} />
      </Button>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Sort</span>
        <div className="inline-flex rounded-lg bg-black/40 border border-white/10 p-0.5">
          <button
            onClick={() => setSortBy('number')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              sortBy === 'number' ? 'bg-indigo-500/20 text-indigo-400' : 'text-muted-foreground hover:text-white'
            )}
          >
            Number
          </button>
          <button
            onClick={() => setSortBy('recent')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              sortBy === 'recent' ? 'bg-indigo-500/20 text-indigo-400' : 'text-muted-foreground hover:text-white'
            )}
          >
            Recently solved
          </button>
        </div>
      </div>
    </div>

    {showAdvancedFilters && (
      <Card className="p-5 mb-6 animate-fade-in">
        <h3 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
          Match <Badge variant="secondary">All</Badge> of the following filters:
        </h3>

        <div className="space-y-3">
          <FilterRow
            label="My Status"
            Icon={Check}
            value={solvedFilter}
            onChange={setSolvedFilter}
            onClear={() => setSolvedFilter('')}
            placeholder="Any Status"
            options={[
              { value: 'true', label: 'Solved' },
              { value: 'attempted', label: 'Attempted' },
              { value: 'false', label: 'Unsolved' },
            ]}
          />
          <FilterRow
            label="Group Status"
            Icon={Users}
            value={groupStatusFilter}
            onChange={setGroupStatusFilter}
            onClear={() => setGroupStatusFilter('')}
            placeholder="Any Group Status"
            options={[
              { value: 'true', label: 'Solved by Anyone' },
              { value: 'false', label: 'Unsolved by All' },
            ]}
          />
          <FilterRow
            label="Difficulty"
            Icon={SlidersHorizontal}
            value={difficultyFilter}
            onChange={setDifficultyFilter}
            onClear={() => setDifficultyFilter('')}
            placeholder="Any Difficulty"
            options={[
              { value: 'Easy', label: 'Easy' },
              { value: 'Medium', label: 'Medium' },
              { value: 'Hard', label: 'Hard' },
            ]}
          />
          <FilterRow
            label="Topic"
            Icon={Tag}
            value={activePattern === 'all' ? '' : activePattern}
            onChange={(v) => setActivePattern(v || 'all')}
            onClear={() => setActivePattern('all')}
            placeholder="Any Topic"
            options={patterns.map(p => ({ value: p, label: p }))}
          />
        </div>

        <div className="mt-6 flex justify-end items-center border-t border-white/10 pt-4">
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
        </div>
      </Card>
    )}
  </>
);

export default GroupFilters;
