import { useGroupDetail } from '@/features/groups/hooks/useGroupDetail';
import { useGroupAddProblem } from '@/features/groups/hooks/useGroupAddProblem';
import AddProblemDialog from '@/shared/components/AddProblemDialog';
import AddFromProblemsetModal from '@/features/groups/components/AddFromProblemsetModal';
import GroupDetailSkeleton from '@/features/groups/components/GroupDetailSkeleton';
import GroupHeader from '@/features/groups/components/GroupHeader';
import MembersBar from '@/features/groups/components/MembersBar';
import GroupFilters from '@/features/groups/components/GroupFilters';
import GroupProblemTable from '@/features/groups/components/GroupProblemTable';
import AddMemberDialog from '@/features/groups/components/AddMemberDialog';
import DeleteGroupDialog from '@/features/groups/components/DeleteGroupDialog';

const GroupDetail = () => {
  const detail = useGroupDetail();
  const add = useGroupAddProblem({
    groupId: detail.groupId,
    upsertGroupProblem: detail.upsertGroupProblem,
    refetch: detail.fetchGroup,
  });

  if (detail.loading) {
    return <GroupDetailSkeleton />;
  }
  if (!detail.group) return null;

  const { group } = detail;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-8 space-y-8 animate-fade-in">
      <GroupHeader
        group={group}
        isGroupCreator={detail.isGroupCreator}
        onBack={() => detail.navigate('/groups')}
        onAddMember={detail.openAddMember}
        onAddFromProblemset={() => detail.setShowAddFromProblemset(true)}
        onAddProblem={add.openAddModal}
        onDeleteGroup={detail.openDeleteGroup}
      />

      <MembersBar members={group.members} currentUserId={detail.userId} />

      <GroupFilters
        patterns={detail.patterns}
        activePattern={detail.activePattern}
        setActivePattern={detail.setActivePattern}
        showAdvancedFilters={detail.showAdvancedFilters}
        setShowAdvancedFilters={detail.setShowAdvancedFilters}
        sortBy={detail.sortBy}
        setSortBy={detail.setSortBy}
        solvedFilter={detail.solvedFilter}
        setSolvedFilter={detail.setSolvedFilter}
        groupStatusFilter={detail.groupStatusFilter}
        setGroupStatusFilter={detail.setGroupStatusFilter}
        difficultyFilter={detail.difficultyFilter}
        setDifficultyFilter={detail.setDifficultyFilter}
        resetFilters={detail.resetFilters}
      />

      <GroupProblemTable
        group={group}
        userId={detail.userId}
        visibleProblems={detail.visibleProblems}
        filteredCount={detail.filteredProblems.length}
        hasMoreProblems={detail.hasMoreProblems}
        activePattern={detail.activePattern}
        expandedTopics={detail.expandedTopics}
        onToggleTopics={detail.toggleExpandedTopics}
        onSetStatus={detail.handleSetStatus}
        onShowMore={detail.showMore}
      />

      <AddMemberDialog
        open={detail.showAddMember}
        onClose={detail.closeAddMember}
        username={detail.username}
        setUsername={detail.setUsername}
        error={detail.memberError}
        onAdd={detail.handleAddMember}
      />

      <AddFromProblemsetModal
        isOpen={detail.showAddFromProblemset}
        onClose={() => detail.setShowAddFromProblemset(false)}
        onAddProblem={detail.handleAddFromProblemset}
        onAddProblems={detail.handleAddMultipleFromProblemset}
        existingProblems={group.problems || []}
      />

      <AddProblemDialog
        {...add}
        accent="indigo"
        title="Add Problem to Group"
        description="Everyone in the group will be able to track it."
        submitLabel="Add Problem"
        skippedLabel="In group"
      />

      <DeleteGroupDialog
        open={detail.showDeleteGroup}
        onClose={detail.closeDeleteGroup}
        group={group}
        confirmName={detail.deleteConfirmName}
        setConfirmName={detail.setDeleteConfirmName}
        error={detail.deleteError}
        isDeleting={detail.isDeletingGroup}
        onDelete={detail.handleDeleteGroup}
      />
    </div>
  );
};

export default GroupDetail;
