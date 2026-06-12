import { getGreeting } from '@/features/dashboard/utils/heatmap';

const DashboardHeader = ({ username, isEmpty, totalSolved, totalProblems }) => {
  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <header className="animate-fade-in">
      <p className="text-sm text-muted-foreground">{todayLabel}</p>
      <h1 className="mt-1 text-3xl sm:text-4xl font-bold text-white tracking-tight">
        {getGreeting()}{username ? `, ${username}` : ''}
      </h1>
      <p className="text-muted-foreground mt-2">
        {isEmpty
          ? 'Start tracking problems to see your progress here.'
          : `You've solved ${totalSolved} of ${totalProblems} tracked problems.`}
      </p>
    </header>
  );
};

export default DashboardHeader;
