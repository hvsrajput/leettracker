import { FileQuestion } from 'lucide-react';
import TopicTags from '@/shared/components/TopicTags';
import { StatusCheckbox } from '@/shared/components/StatusControls';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { DifficultyBadge } from '@/shared/ui/badge';

const MemberStatusControl = ({ problemId, memberStatus, targetStatus, isCurrentUser, onSetStatus }) => {
  const isActive = memberStatus?.status === targetStatus;

  if (isCurrentUser) {
    const nextStatus = isActive ? 'unsolved' : targetStatus;
    return (
      <StatusCheckbox
        active={isActive}
        kind={targetStatus}
        onClick={() => onSetStatus(problemId, nextStatus)}
        title={isActive ? `Mark ${targetStatus} off` : `Mark ${targetStatus}`}
      />
    );
  }

  return <StatusCheckbox active={isActive} kind={targetStatus} readOnly />;
};

const GroupProblemTable = ({
  group,
  userId,
  visibleProblems,
  filteredCount,
  hasMoreProblems,
  activePattern,
  expandedTopics,
  onToggleTopics,
  onSetStatus,
  onShowMore,
}) => {
  if (filteredCount === 0) {
    return (
      <Card className="p-12 flex flex-col items-center justify-center text-center">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-5">
          <FileQuestion className="w-7 h-7" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">
          {activePattern === 'all' ? 'No problems in this group' : `No "${activePattern}" problems`}
        </h3>
        <p className="text-muted-foreground">
          {activePattern === 'all' ? 'Add problems to start tracking progress together!' : 'Try selecting a different pattern.'}
        </p>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {visibleProblems.map((p) => {
          const myStatus = p.member_statuses?.find(ms => ms.user_id === userId)?.status || 'unsolved';
          return (
            <Card
              className={cn(
                'p-4 space-y-4',
                myStatus === 'solved' ? 'bg-emerald-500/[0.03]' : myStatus === 'attempted' ? 'bg-amber-500/[0.03]' : ''
              )}
              key={p.leetcode_number}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground mb-1">#{p.leetcode_number}</div>
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-100 hover:text-indigo-400 transition-colors block">
                    {p.title}
                  </a>
                </div>
                <DifficultyBadge difficulty={p.difficulty} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <TopicTags
                  topics={p.topics || []}
                  expanded={expandedTopics[p.id]}
                  onToggle={() => onToggleTopics(p.id)}
                  emptyLabel="No topics"
                />
              </div>

              <div className="space-y-2.5">
                {p.member_statuses?.map(ms => (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5" key={ms.user_id}>
                    <span className="text-sm font-medium text-gray-200 truncate">{ms.username}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground uppercase">A</span>
                      <MemberStatusControl problemId={p.id} memberStatus={ms} targetStatus="attempted" isCurrentUser={ms.user_id === userId} onSetStatus={onSetStatus} />
                      <span className="ml-2 text-[10px] text-muted-foreground uppercase">S</span>
                      <MemberStatusControl problemId={p.id} memberStatus={ms} targetStatus="solved" isCurrentUser={ms.user_id === userId} onSetStatus={onSetStatus} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block overflow-x-auto scrollbar-thin">
        <div className="min-w-max">
          <div className="flex p-4 border-b border-white/[0.08] text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-white/[0.03]">
            <span className="w-16 flex-shrink-0">#</span>
            <span className="w-64 flex-shrink-0">Problem</span>
            <span className="w-32 flex-shrink-0">Difficulty</span>
            <span className="min-w-[140px] flex-1 pr-6">Topics</span>
            <div className="flex flex-none justify-end gap-6 pl-6">
              {group.members?.map(m => (
                <div className="w-24 flex-shrink-0 text-center" key={m.id} title={m.username}>
                  <div className="truncate">{m.username.substring(0, 5)}</div>
                  <div className="mt-1 flex justify-center gap-3 text-[10px] text-muted-foreground/70">
                    <span className="w-6 text-center">A</span>
                    <span className="w-6 text-center">S</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {visibleProblems.map((p) => {
              const myStatus = p.member_statuses?.find(ms => ms.user_id === userId)?.status || 'unsolved';
              return (
                <div
                  className={cn(
                    'flex p-4 items-center transition-colors hover:bg-white/[0.04]',
                    myStatus === 'solved' ? 'bg-emerald-500/[0.02]' : myStatus === 'attempted' ? 'bg-amber-500/[0.02]' : ''
                  )}
                  key={p.leetcode_number}
                >
                  <span className="w-16 flex-shrink-0 font-mono text-muted-foreground text-sm">#{p.leetcode_number}</span>
                  <span className="w-64 flex-shrink-0 truncate pr-4">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-200 hover:text-indigo-400 transition-colors">
                      {p.title}
                    </a>
                  </span>
                  <span className="w-32 flex-shrink-0">
                    <DifficultyBadge difficulty={p.difficulty} />
                  </span>
                  <div className="min-w-[140px] flex-1 flex flex-wrap items-center gap-2 pr-6">
                    <TopicTags
                      topics={p.topics || []}
                      expanded={expandedTopics[p.id]}
                      onToggle={() => onToggleTopics(p.id)}
                      emptyLabel="No topics"
                    />
                  </div>
                  <div className="flex flex-none justify-end gap-6 pl-6">
                    {p.member_statuses?.map(ms => (
                      <div className="w-24 flex-shrink-0 flex justify-center gap-3" key={ms.user_id}>
                        <MemberStatusControl problemId={p.id} memberStatus={ms} targetStatus="attempted" isCurrentUser={ms.user_id === userId} onSetStatus={onSetStatus} />
                        <MemberStatusControl problemId={p.id} memberStatus={ms} targetStatus="solved" isCurrentUser={ms.user_id === userId} onSetStatus={onSetStatus} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {hasMoreProblems && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button variant="outline" onClick={onShowMore}>
            Show more
          </Button>
          <span className="text-xs text-muted-foreground">
            Showing {visibleProblems.length} of {filteredCount}
          </span>
        </div>
      )}
    </>
  );
};

export default GroupProblemTable;
