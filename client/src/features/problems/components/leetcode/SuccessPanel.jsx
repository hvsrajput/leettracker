import { CheckCheck, Users } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

const SuccessPanel = ({ result, onRestart, onDone }) => (
  <div className="space-y-6 animate-fade-in">
    <div className="text-center">
      <div className="w-16 h-16 bg-emerald-500/15 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
        <CheckCheck className="w-8 h-8" />
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">Import Complete!</h3>
    </div>

    <div className={cn('grid gap-3', typeof result.attempted === 'number' ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2')}>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-emerald-400 tabular-nums">{result.solved}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{result.mode === 'recent-sync' ? 'Solved Imported' : 'Newly Imported'}</div>
      </div>
      {typeof result.attempted === 'number' && (
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-300 tabular-nums">{result.attempted || 0}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Attempted Imported</div>
        </div>
      )}
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-gray-300 tabular-nums">{result.alreadyExists}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{result.mode === 'recent-sync' ? 'Already Up To Date' : 'Already Existed'}</div>
      </div>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-rose-400 tabular-nums">{result.failed}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Failed</div>
      </div>
      <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-white tabular-nums">{result.total}</div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{result.mode === 'recent-sync' ? 'Recent Found' : 'Total Found'}</div>
      </div>
    </div>

    {(result.groupsUpdated > 0 || result.groupsFailed > 0) && (
      <div className={cn(
        'p-4 rounded-xl border flex items-center gap-3',
        result.groupsFailed > 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-indigo-500/10 border-indigo-500/20'
      )}>
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
          result.groupsFailed > 0 ? 'bg-amber-500/20' : 'bg-indigo-500/20'
        )}>
          <Users className={cn('w-5 h-5', result.groupsFailed > 0 ? 'text-amber-400' : 'text-indigo-400')} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">
            Problems added to {result.groupsUpdated} group{result.groupsUpdated !== 1 ? 's' : ''}
          </div>
          {result.groupsFailed > 0 && (
            <div className="text-xs text-amber-400 mt-0.5">
              {result.groupsFailed} group{result.groupsFailed !== 1 ? 's' : ''} failed (not a member or group removed)
            </div>
          )}
        </div>
      </div>
    )}

    {result.mode === 'recent-sync' && result.total === 0 && result.totalSolvedOnLeetCode > 0 && (
      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
        No recent public activity was available to import right now. Use Advanced Import once if you want your full LeetCode history.
      </div>
    )}

    {result.mode === 'recent-sync' && result.bestEffortAttempted && result.recentAttemptedFound > 0 && (
      <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 text-gray-300 text-sm">
        Attempted imports are best-effort and only come from your recent public submissions.
      </div>
    )}

    <div className="flex gap-3">
      <Button variant="outline" onClick={onRestart}>
        Import Again
      </Button>
      <Button className="flex-1 font-semibold" onClick={onDone}>
        Done
      </Button>
    </div>
  </div>
);

export default SuccessPanel;
