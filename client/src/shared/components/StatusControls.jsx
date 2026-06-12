import { Check, ChevronDown, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../ui/select';

export function createEmptyBulkProgress(total = 0) {
  return {
    total,
    completed: 0,
    added: 0,
    skipped: 0,
    failed: 0,
  };
}

export function parseBulkProblemNumbers(input) {
  const tokens = input.split(/[,\s;]+/).map(token => token.trim()).filter(Boolean);
  const seen = new Set();
  const numbers = [];
  const duplicates = [];
  const invalidTokens = [];

  tokens.forEach(token => {
    if (!/^\d+$/.test(token)) {
      invalidTokens.push(token);
      return;
    }

    const number = Number(token);
    if (!Number.isSafeInteger(number) || number <= 0) {
      invalidTokens.push(token);
      return;
    }

    if (seen.has(number)) {
      duplicates.push(number);
      return;
    }

    seen.add(number);
    numbers.push(number);
  });

  return { tokens, numbers, duplicates, invalidTokens };
}

export function StatusCheckbox({ active, kind, onClick, title, readOnly = false }) {
  const activeClasses = kind === 'solved'
    ? 'bg-emerald-500 border-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.35)]'
    : 'bg-amber-500/20 border-amber-500/50 text-amber-300';

  if (readOnly) {
    return (
      <div
        className={cn(
          'w-6 h-6 rounded-md flex items-center justify-center border transition-all',
          active ? activeClasses : 'bg-transparent border-white/5 text-white/10'
        )}
      >
        {active ? <Check className="w-4 h-4" strokeWidth={3} /> : <div className="w-1.5 h-px bg-white/20" />}
      </div>
    );
  }

  return (
    <button
      className={cn(
        'w-6 h-6 rounded-md flex items-center justify-center border transition-all',
        active ? activeClasses : 'bg-white/5 border-white/15 text-transparent hover:border-white/40'
      )}
      onClick={onClick}
      title={title}
    >
      {active && <Check className="w-4 h-4" strokeWidth={3} />}
    </button>
  );
}

export function FilterRow(props) {
  const { label, value, onChange, onClear, placeholder, options } = props;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full group">
      <div className="flex items-center gap-2 w-32 flex-shrink-0 text-muted-foreground">
        <props.Icon className="w-4 h-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="hidden sm:flex items-center rounded-lg border border-input bg-black/40 px-3 py-1.5 text-sm text-muted-foreground w-20 flex-shrink-0 justify-between">
        is <ChevronDown className="w-3 h-3 opacity-50" />
      </div>
      <div className="flex-1">
        <Select value={value || 'any'} onValueChange={(v) => onChange(v === 'any' ? '' : v)}>
          <SelectTrigger>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{placeholder}</SelectItem>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="opacity-0 group-hover:opacity-100 h-8 w-8 hidden sm:inline-flex"
        onClick={onClear}
        title="Clear filter"
      >
        <RotateCcw className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}

export function BulkResultsPanel({ bulkProgress, bulkResults, isBulkAdding, bulkCompletionPercent, accent = 'emerald', skippedLabel = 'Tracked' }) {
  if (bulkProgress.total === 0 && bulkResults.length === 0) return null;

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3.5 space-y-3">
      {bulkProgress.total > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-white flex items-center gap-2">
              {isBulkAdding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isBulkAdding ? 'Adding problems...' : 'Bulk add complete'}
            </span>
            <span className="text-muted-foreground tabular-nums">{bulkProgress.completed} / {bulkProgress.total}</span>
          </div>
          <Progress
            value={bulkCompletionPercent}
            indicatorClassName={accent === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500'}
          />
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-2 text-emerald-400 font-medium">
              {bulkProgress.added} added
            </div>
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-2 text-amber-400 font-medium">
              {bulkProgress.skipped} skipped
            </div>
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-2 py-2 text-rose-400 font-medium">
              {bulkProgress.failed} failed
            </div>
          </div>
        </div>
      )}

      {bulkResults.length > 0 && (
        <div className="max-h-32 overflow-y-auto scrollbar-thin divide-y divide-white/5 rounded-lg border border-white/10 bg-black/30">
          {bulkResults.map((result, index) => {
            const isGood = result.status === 'added';
            const isWarning = result.status === 'skipped' || result.status === 'duplicate';
            const badgeVariant = isGood ? 'success' : isWarning ? 'warning' : 'destructive';
            const statusLabel = result.status === 'added'
              ? 'Added'
              : result.status === 'skipped'
                ? skippedLabel
                : result.status === 'duplicate'
                  ? 'Duplicate'
                  : result.status === 'invalid'
                    ? 'Invalid'
                    : 'Failed';
            const label = result.number ? `#${result.number}` : result.token;

            return (
              <div key={`${result.status}-${label}-${index}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-mono text-muted-foreground w-14 flex-shrink-0 truncate text-xs">{label}</span>
                <span className="text-gray-300 flex-1 min-w-0 truncate">{result.title || result.message}</span>
                <Badge variant={badgeVariant}>{statusLabel}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function BulkParseStats({ parseResult }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5">
        <div className="text-base font-bold text-white tabular-nums">{parseResult.numbers.length}</div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Unique</div>
      </div>
      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5">
        <div className="text-base font-bold text-amber-400 tabular-nums">{parseResult.duplicates.length}</div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Duplicates</div>
      </div>
      <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5">
        <div className="text-base font-bold text-rose-400 tabular-nums">{parseResult.invalidTokens.length}</div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Invalid</div>
      </div>
    </div>
  );
}

export function AddModeToggle({ addMode, setAddMode, isBulkAdding, onSwitch }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/40 border border-white/10 p-1">
      {['single', 'bulk'].map((mode) => (
        <button
          key={mode}
          type="button"
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-medium transition-all capitalize',
            addMode === mode
              ? 'bg-emerald-600 text-white shadow'
              : 'text-muted-foreground hover:text-white hover:bg-white/5',
            isBulkAdding && 'cursor-not-allowed opacity-60'
          )}
          onClick={() => {
            if (isBulkAdding) return;
            setAddMode(mode);
            if (onSwitch) onSwitch(mode);
          }}
          disabled={isBulkAdding}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
