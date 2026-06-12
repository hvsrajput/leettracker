import { useNavigate } from 'react-router-dom';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';
import { useAuth } from '@/features/auth/hooks/useAuth';
import DashboardSkeleton from '@/features/dashboard/components/DashboardSkeleton';
import DashboardHeader from '@/features/dashboard/components/DashboardHeader';
import DashboardEmpty from '@/features/dashboard/components/DashboardEmpty';
import StatStrip from '@/features/dashboard/components/StatStrip';
import OverviewSection from '@/features/dashboard/components/OverviewSection';
import ActivitySection from '@/features/dashboard/components/ActivitySection';
import PatternFocus from '@/features/dashboard/components/PatternFocus';
import RecentlySolved from '@/features/dashboard/components/RecentlySolved';
import GroupsList from '@/features/dashboard/components/GroupsList';
import TopicMastery from '@/features/dashboard/components/TopicMastery';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const dashboard = useDashboard();

  if (dashboard.loading) {
    return <DashboardSkeleton />;
  }

  if (!dashboard.stats) {
    return <div className="flex items-center justify-center min-h-[50vh] text-rose-400">Failed to load dashboard</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24 md:pb-12 space-y-12">
      <DashboardHeader
        username={user?.username}
        isEmpty={dashboard.isEmpty}
        totalSolved={dashboard.totalSolved}
        totalProblems={dashboard.totalProblems}
      />

      {dashboard.isEmpty ? (
        <DashboardEmpty onGoToProblems={() => navigate('/problems')} />
      ) : (
        <>
          <StatStrip
            totalSolved={dashboard.totalSolved}
            totalAttempted={dashboard.totalAttempted}
            remaining={dashboard.remaining}
            totalPercent={dashboard.totalPercent}
            streak={dashboard.streak}
          />

          <OverviewSection
            totalSolved={dashboard.totalSolved}
            totalProblems={dashboard.totalProblems}
            totalPercent={dashboard.totalPercent}
            difficultyStats={dashboard.difficultyStats}
          />

          <ActivitySection
            heatmapData={dashboard.heatmapData}
            heatmapLoading={dashboard.heatmapLoading}
            selectedYear={dashboard.selectedYear}
            onSelectYear={dashboard.setSelectedYear}
          />

          <PatternFocus patternHeatmap={dashboard.patternHeatmap} />

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
            <RecentlySolved recentSolved={dashboard.stats.recentSolved} />
            <GroupsList
              groupStats={dashboard.stats.groupStats}
              onOpenGroup={(id) => navigate(`/groups/${id}`)}
            />
          </section>

          <TopicMastery
            allPatterns={dashboard.allPatterns}
            visiblePatterns={dashboard.visiblePatterns}
            showAllPatterns={dashboard.showAllPatterns}
            onToggleShowAll={() => dashboard.setShowAllPatterns(v => !v)}
          />
        </>
      )}
    </div>
  );
};

export default Dashboard;
