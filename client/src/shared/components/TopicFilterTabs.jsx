import { useState } from 'react';
import { cn } from '../lib/utils';

const COLLAPSED_LIMIT = 8;

// Collapsible row of topic filter buttons (All, Arrays, Backtracking, ...).
// Collapses to the first few topics with a "+N more" toggle so a long topic
// list doesn't dominate the top of the page.
export default function TopicFilterTabs({ patterns = [], activePattern, onSelect, accent = 'emerald' }) {
  const [expanded, setExpanded] = useState(false);

  const activeCls = accent === 'indigo'
    ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/40'
    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40';
  const idleCls = 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07] hover:border-white/20 text-gray-400 hover:text-gray-200';

  const canCollapse = patterns.length > COLLAPSED_LIMIT;

  // When collapsed, keep the active topic visible even if it sits past the cut.
  let visible = patterns;
  if (!expanded && canCollapse) {
    visible = patterns.slice(0, COLLAPSED_LIMIT);
    if (activePattern !== 'all' && !visible.includes(activePattern)) {
      visible = [...patterns.slice(0, COLLAPSED_LIMIT - 1), activePattern];
    }
  }
  const hiddenCount = patterns.length - visible.length;

  const tab = (label, value, isActive) => (
    <button
      key={value}
      onClick={() => onSelect(value)}
      className={cn(
        'rounded-full px-4 py-1.5 text-sm font-medium border transition-all',
        isActive ? activeCls : idleCls
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {tab('All', 'all', activePattern === 'all')}
      {visible.map(p => tab(p, p, activePattern === p))}
      {canCollapse && !expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className={cn('rounded-full px-4 py-1.5 text-sm font-medium border transition-all', idleCls)}
        >
          +{hiddenCount} more
        </button>
      )}
      {canCollapse && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className={cn('rounded-full px-4 py-1.5 text-sm font-medium border transition-all', idleCls)}
        >
          Show less
        </button>
      )}
    </div>
  );
}
