import { Tag, Minus } from 'lucide-react';
import { Badge } from './ui/badge';

// Compact, collapsible topic tags. Collapsed by default to a single count pill
// so the topics never dominate a problem row; expands inline on click.
export default function TopicTags({ topics = [], expanded, onToggle, emptyLabel }) {
  if (!topics.length) {
    return emptyLabel ? <span className="text-xs text-muted-foreground">{emptyLabel}</span> : null;
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
        title="Show topics"
      >
        <Tag className="w-3 h-3" />
        {topics.length} {topics.length === 1 ? 'topic' : 'topics'}
      </button>
    );
  }

  return (
    <>
      {topics.map(topic => (
        <Badge variant="topic" key={topic}>{topic}</Badge>
      ))}
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 transition-colors"
      >
        <Minus className="w-3 h-3" />
        Hide
      </button>
    </>
  );
}
