import { LayoutDashboard } from 'lucide-react';
import { Card } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';

const DashboardEmpty = ({ onGoToProblems }) => {
  return (
    <Card className="p-12 flex flex-col items-center text-center animate-rise">
      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5">
        <LayoutDashboard className="h-7 w-7" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">No data yet</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">Add problems or import your LeetCode history to build your dashboard.</p>
      <Button onClick={onGoToProblems}>Go to Problems</Button>
    </Card>
  );
};

export default DashboardEmpty;
