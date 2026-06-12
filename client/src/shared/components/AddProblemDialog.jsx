import { Plus, Search, Loader2 } from 'lucide-react';
import {
  BulkResultsPanel,
  BulkParseStats,
  AddModeToggle,
} from '@/shared/components/StatusControls';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { Label } from '@/shared/ui/label';
import { Badge, DifficultyBadge } from '@/shared/ui/badge';
import { Card } from '@/shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';

// Presentational "Add Problem" dialog shared by the Problems page and a group.
// Receives the entire useAddProblemFlow return as props plus a few labels;
// all single/bulk behaviour lives in the hook.
const AddProblemDialog = ({
  // useAddProblemFlow return
  showAddModal,
  closeAddModal,
  addMode,
  switchAddMode,
  searchQuery,
  searchResults,
  isSearching,
  preview,
  addError,
  handleSearch,
  handleSelectProblem,
  handleAddProblem,
  bulkInput,
  updateBulkInput,
  bulkError,
  isBulkAdding,
  bulkProgress,
  bulkResults,
  bulkParseResult,
  bulkCompletionPercent,
  handleBulkAddProblems,
  // presentation
  accent = 'emerald',
  title = 'Add Problem',
  description = 'Track a new LeetCode problem in your list.',
  submitLabel = 'Save',
  skippedLabel = 'Tracked',
}) => (
  <Dialog open={showAddModal} onOpenChange={(open) => { if (!open) closeAddModal(); }}>
    <DialogContent className="max-w-lg p-0 gap-0">
      <DialogHeader className="px-6 py-5 border-b border-white/[0.08]">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <div className="px-6 py-5 space-y-4">
        <AddModeToggle
          addMode={addMode}
          setAddMode={switchAddMode}
          isBulkAdding={isBulkAdding}
        />

        {addMode === 'single' && (
          <>
            <div className="relative">
              <Label className="mb-2 block">Search Title or #</Label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  placeholder="e.g. Two Sum..."
                  className="pl-10"
                  autoComplete="off"
                />
                {isSearching && (
                  <Loader2 className={cn(
                    'absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin',
                    accent === 'indigo' ? 'text-indigo-400' : 'text-emerald-400'
                  )} />
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-white/10 bg-popover shadow-2xl shadow-black/60 overflow-hidden z-20 max-h-60 overflow-y-auto scrollbar-thin">
                  {searchResults.map(res => (
                    <button
                      key={res.number}
                      type="button"
                      className="w-full flex items-center gap-3 p-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 text-left"
                      onClick={() => handleSelectProblem(res)}
                    >
                      <span className="text-muted-foreground font-mono text-xs w-10 flex-shrink-0">#{res.number}</span>
                      <span className="font-medium text-gray-200 flex-1 truncate text-sm">{res.title}</span>
                      <DifficultyBadge difficulty={res.difficulty} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {addError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{addError}</div>
            )}

            {preview && (
              <Card className="p-4 bg-white/[0.03]">
                <div className="font-medium text-white mb-2.5">
                  <span className="font-mono text-xs text-muted-foreground mr-2">#{preview.number}</span>
                  {preview.title}
                </div>
                <div className="flex flex-wrap gap-2">
                  <DifficultyBadge difficulty={preview.difficulty} />
                  {preview.topics && preview.topics.map(t => (
                    <Badge variant="topic" key={t}>{t}</Badge>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {addMode === 'bulk' && (
          <>
            <div>
              <Label className="mb-2 block">LeetCode Question Numbers</Label>
              <Textarea
                value={bulkInput}
                onChange={e => updateBulkInput(e.target.value)}
                disabled={isBulkAdding}
                rows={4}
                placeholder={`1, 2, 15\n49 53 121\n200; 206; 217`}
                className="resize-none font-mono"
              />
            </div>

            {bulkInput.trim() && <BulkParseStats parseResult={bulkParseResult} />}

            {bulkError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">{bulkError}</div>
            )}

            <BulkResultsPanel
              bulkProgress={bulkProgress}
              bulkResults={bulkResults}
              isBulkAdding={isBulkAdding}
              bulkCompletionPercent={bulkCompletionPercent}
              accent={accent}
              skippedLabel={skippedLabel}
            />
          </>
        )}
      </div>

      <DialogFooter className="px-6 py-4 border-t border-white/[0.08]">
        <Button variant="outline" onClick={closeAddModal} disabled={isBulkAdding}>
          {addMode === 'bulk' && bulkProgress.completed > 0 && !isBulkAdding ? 'Close' : 'Cancel'}
        </Button>
        {addMode === 'single' ? (
          <Button onClick={handleAddProblem} disabled={!preview}>
            <Plus className="h-4 w-4" />
            {submitLabel}
          </Button>
        ) : (
          <Button
            onClick={handleBulkAddProblems}
            disabled={isBulkAdding || bulkParseResult.numbers.length === 0}
            className="min-w-32"
          >
            {isBulkAdding && <Loader2 className="h-4 w-4 animate-spin" />}
            {isBulkAdding ? 'Adding...' : 'Add Problems'}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default AddProblemDialog;
