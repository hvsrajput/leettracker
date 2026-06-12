import { CheckCheck, ExternalLink } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { DifficultyBadge } from '@/shared/ui/badge';
import SectionLabel from '@/features/dashboard/components/SectionLabel';
import { getLeetCodeUrl, timeAgo } from '@/features/dashboard/utils/heatmap';

const RecentlySolved = ({ recentSolved }) => {
  return (
    <div>
      <SectionLabel>Recently solved</SectionLabel>
      {recentSolved && recentSolved.length > 0 ? (
        <Card className="divide-y divide-white/[0.05] overflow-hidden animate-rise">
          {recentSolved.slice(0, 8).map((p) => (
            <a
              key={p.leetcode_number}
              href={getLeetCodeUrl(p)}
              target="_blank"
              rel="noopener noreferrer"
              title={`Open ${p.title} on LeetCode`}
              className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.04]"
            >
              <CheckCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
              <span className="text-muted-foreground/70 font-mono text-xs w-10 flex-shrink-0">#{p.leetcode_number}</span>
              <span className="font-medium text-gray-200 flex-1 min-w-0 truncate group-hover:text-white transition-colors">{p.title}</span>
              {p.solved_at && <span className="text-xs text-muted-foreground/70 flex-shrink-0 hidden sm:block">{timeAgo(p.solved_at)}</span>}
              <DifficultyBadge difficulty={p.difficulty} />
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hidden sm:block" />
            </a>
          ))}
        </Card>
      ) : (
        <Card className="p-8 text-center text-sm text-muted-foreground animate-rise">
          No solved problems yet.
        </Card>
      )}
    </div>
  );
};

export default RecentlySolved;
