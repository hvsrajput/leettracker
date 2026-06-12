import { createProblem } from '@/features/problems/services/problemsApi';
import { addProblemToGroup } from '@/features/groups/services/groupsApi';
import { useAddProblemFlow } from '@/shared/hooks/useAddProblemFlow';
import { toast } from '@/shared/ui/use-toast';

// Ensures a problem exists in the DB, then attaches it to the group. Reuses the
// problem-search/preview/bulk machinery from useAddProblemFlow; only the commit
// step differs from the personal "add to my list" flow.
const ensureProblem = async (payload) => {
  try {
    const res = await createProblem(payload);
    return res.data;
  } catch (err) {
    if (err.response?.data?.problem) {
      return err.response.data.problem;
    }
    throw err;
  }
};

export const useGroupAddProblem = ({ groupId, upsertGroupProblem, refetch }) => {
  const commitSingle = async (preview) => {
    try {
      const problem = await ensureProblem({
        leetcode_number: preview.number,
        title: preview.title,
        difficulty: preview.difficulty,
        pattern_name: preview.topics?.[0] || null,
      });
      const addRes = await addProblemToGroup(groupId, problem.id);
      upsertGroupProblem(addRes.data, problem.status || 'unsolved');
      toast({ title: 'Problem added to group', description: `#${preview.number} ${preview.title}`, variant: 'success' });
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to add problem');
    }
  };

  const commitBulkItem = async (number) => {
    try {
      const problem = await ensureProblem({ leetcode_number: number, require_dataset: true });
      try {
        const addRes = await addProblemToGroup(groupId, problem.id);
        upsertGroupProblem(addRes.data, problem.status || 'unsolved');
        return { status: 'added', number, title: addRes.data.title || problem.title, message: 'Added' };
      } catch (err) {
        const responseError = err.response?.data?.error || '';
        if (err.response?.status === 400 && responseError.includes('already in group')) {
          return { status: 'skipped', number, title: problem.title, message: 'Already in group' };
        }
        throw err;
      }
    } catch (err) {
      return { status: 'failed', number, message: err.response?.data?.error || 'Failed to add problem' };
    }
  };

  return useAddProblemFlow({
    commitSingle,
    commitBulkItem,
    onBulkComplete: refetch,
  });
};
