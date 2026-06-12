import { Plus, Download } from 'lucide-react';
import { useProblems } from '@/features/problems/hooks/useProblems';
import { useAddProblem } from '@/features/problems/hooks/useAddProblem';
import TopicFilterTabs from '@/shared/components/TopicFilterTabs';
import { Button } from '@/shared/ui/button';
import ProblemFilters from '@/features/problems/components/ProblemFilters';
import ProblemList from '@/features/problems/components/ProblemList';
import AddProblemDialog from '@/shared/components/AddProblemDialog';
import DeleteProblemDialog from '@/features/problems/components/DeleteProblemDialog';
import ImportProblemsDialog from '@/features/problems/components/ImportProblemsDialog';

const Problems = () => {
  const problems = useProblems();
  const add = useAddProblem({
    onProblemAdded: problems.addProblemToList,
    refetch: problems.fetchProblems,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24 md:pb-12 space-y-8">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Problems</h1>
          <p className="text-muted-foreground mt-2">
            <span className="text-emerald-400 font-medium">{problems.solvedCount} solved</span>
            <span className="text-muted-foreground/50"> · </span>
            <span className="text-amber-400 font-medium">{problems.attemptedCount} attempted</span>
            <span className="text-muted-foreground/50"> · </span>
            {problems.problems.length} total
            {problems.activePattern !== 'all' && ` in ${problems.activePattern}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => problems.setShowImportModal(true)}>
            <Download className="h-4 w-4 text-[#FFA116]" />
            Import from LeetCode
          </Button>
          <Button onClick={add.openAddModal}>
            <Plus className="h-4 w-4" />
            Add Problem
          </Button>
        </div>
      </header>

      <TopicFilterTabs
        patterns={problems.dynamicPatterns}
        activePattern={problems.activePattern}
        onSelect={problems.setActivePattern}
        accent="emerald"
      />

      <ProblemFilters
        showAdvancedFilters={problems.showAdvancedFilters}
        setShowAdvancedFilters={problems.setShowAdvancedFilters}
        sortBy={problems.sortBy}
        setSortBy={problems.setSortBy}
        solvedFilter={problems.solvedFilter}
        setSolvedFilter={problems.setSolvedFilter}
        difficultyFilter={problems.difficultyFilter}
        setDifficultyFilter={problems.setDifficultyFilter}
        activePattern={problems.activePattern}
        setActivePattern={problems.setActivePattern}
        dynamicPatterns={problems.dynamicPatterns}
        resetFilters={problems.resetFilters}
      />

      <ProblemList
        loading={problems.loading}
        totalCount={problems.problems.length}
        visibleProblems={problems.visibleProblems}
        hasMoreProblems={problems.hasMoreProblems}
        expandedTopics={problems.expandedTopics}
        onToggleTopics={problems.toggleExpandedTopics}
        onSetStatus={problems.handleSetStatus}
        onRequestDelete={problems.setDeleteTarget}
        onShowMore={problems.showMore}
        onAddProblem={add.openAddModal}
      />

      <AddProblemDialog {...add} />

      <DeleteProblemDialog
        deleteTarget={problems.deleteTarget}
        onCancel={() => problems.setDeleteTarget(null)}
        onConfirm={problems.handleConfirmDelete}
      />

      <ImportProblemsDialog
        open={problems.showImportModal}
        onOpenChange={problems.setShowImportModal}
        onSuccess={problems.fetchProblems}
        onCancel={() => problems.setShowImportModal(false)}
      />
    </div>
  );
};

export default Problems;
