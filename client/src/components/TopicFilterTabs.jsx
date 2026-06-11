import { useState } from 'react';

const COLLAPSED_LIMIT = 8;

// Collapsible row of topic filter buttons (All, Arrays, Backtracking, ...).
// Collapses to the first few topics with a "+N more" toggle so a long topic
// list doesn't dominate the top of the page.
export default function TopicFilterTabs({ patterns = [], activePattern, onSelect, accent = 'emerald' }) {
  const [expanded, setExpanded] = useState(false);

  const activeCls = accent === 'indigo'
    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  const idleCls = 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-300';

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
      className={`rounded-xl px-4 py-2 border transition-all ${isActive ? activeCls : idleCls}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {tab('All', 'all', activePattern === 'all')}
      {visible.map(p => tab(p, p, activePattern === p))}
      {canCollapse && !expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className={`rounded-xl px-4 py-2 border transition-all ${idleCls}`}
        >
          +{hiddenCount} more
        </button>
      )}
      {canCollapse && expanded && (
        <button
          onClick={() => setExpanded(false)}
          className={`rounded-xl px-4 py-2 border transition-all ${idleCls}`}
        >
          Show less
        </button>
      )}
    </div>
  );
}
