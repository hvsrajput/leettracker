import { createProblem } from '@/features/problems/services/problemsApi';
import { useAddProblemFlow } from '@/shared/hooks/useAddProblemFlow';
import { toast } from '@/shared/ui/use-toast';

// Adds problems to the user's own list. Owns only the "commit" strategy; the
// search/preview/bulk orchestration lives in the shared useAddProblemFlow.
export const useAddProblem = ({ onProblemAdded, refetch }) => {
  const commitSingle = async (preview) => {
    try {
      const res = await createProblem({
        leetcode_number: preview.number,
        title: preview.title,
        difficulty: preview.difficulty,
        pattern_name: preview.topics?.[0] || null,
      });
      onProblemAdded(res.data);
      toast({ title: 'Problem added', description: `#${preview.number} ${preview.title}`, variant: 'success' });
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to add problem');
    }
  };

  const commitBulkItem = async (number) => {
    try {
      const res = await createProblem({ leetcode_number: number, require_dataset: true });
      onProblemAdded(res.data);
      return { status: 'added', number, title: res.data.title, message: 'Added' };
    } catch (err) {
      const responseData = err.response?.data || {};
      const alreadyTracked = responseData.error === 'Problem already in your list' && responseData.problem;

      if (alreadyTracked) {
        onProblemAdded(responseData.problem);
        return { status: 'skipped', number, title: responseData.problem.title, message: 'Already tracked' };
      }
      return { status: 'failed', number, message: responseData.error || 'Failed to add problem' };
    }
  };

  return useAddProblemFlow({
    commitSingle,
    commitBulkItem,
    onBulkComplete: refetch,
  });
};
