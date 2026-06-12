import { useState, useEffect, useMemo } from 'react';
import { getDashboard, getHeatmap } from '@/features/dashboard/services/dashboardApi';
import {
  DIFFICULTY_ORDER,
  hasVisibleHeatmapActivity,
  getBestHeatmapYear,
  computeStreak,
} from '@/features/dashboard/utils/heatmap';

// Owns the dashboard's data: the stats payload, the heatmap activity, the
// loading flags, the selected year, and everything derived from them. The page
// that consumes this hook only renders — it holds no logic of its own.
export const useDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState({});
  const [heatmapLoading, setHeatmapLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [patternHeatmap, setPatternHeatmap] = useState(null);
  const [showAllPatterns, setShowAllPatterns] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const applyHeatmapData = (nextHeatmapData) => {
      if (!isMounted) {
        return;
      }

      setHeatmapData(nextHeatmapData);
      setSelectedYear((prevYear) => (
        hasVisibleHeatmapActivity(nextHeatmapData, prevYear)
          ? prevYear
          : getBestHeatmapYear(nextHeatmapData)
      ));
    };

    const loadFallbackHeatmap = async () => {
      try {
        const heatmapRes = await getHeatmap();
        applyHeatmapData(heatmapRes.data || {});
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) {
          setHeatmapLoading(false);
        }
      }
    };

    getDashboard()
      .then((dashRes) => {
        if (!isMounted) {
          return;
        }

        const nextStats = dashRes.data || {};
        const initialHeatmapData = nextStats.heatmapData || {};

        setStats(nextStats);
        setPatternHeatmap(nextStats.patternHeatmap || null);

        if (Object.keys(initialHeatmapData).length > 0) {
          applyHeatmapData(initialHeatmapData);
          setHeatmapLoading(false);
        } else {
          loadFallbackHeatmap();
        }
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) {
          setHeatmapLoading(false);
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const streak = useMemo(() => computeStreak(heatmapData), [heatmapData]);

  const difficultyStats = useMemo(() => {
    return [...(stats?.difficultyStats || [])].sort(
      (a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 9) - (DIFFICULTY_ORDER[b.difficulty] ?? 9)
    );
  }, [stats]);

  const totalSolved = stats?.totalSolved || 0;
  const totalAttempted = stats?.totalAttempted || 0;
  const totalProblems = stats?.totalProblems || 0;
  const remaining = Math.max(totalProblems - totalSolved, 0);
  const totalPercent = totalProblems > 0 ? Math.round((totalSolved / totalProblems) * 100) : 0;
  const isEmpty = totalProblems === 0;

  const allPatterns = patternHeatmap?.allPatterns || [];
  const visiblePatterns = showAllPatterns ? allPatterns : allPatterns.slice(0, 8);

  return {
    // data
    loading,
    stats,
    heatmapData,
    heatmapLoading,
    patternHeatmap,
    difficultyStats,
    streak,
    // derived totals
    totalSolved,
    totalAttempted,
    totalProblems,
    remaining,
    totalPercent,
    isEmpty,
    // year selector
    selectedYear,
    setSelectedYear,
    // pattern list
    allPatterns,
    visiblePatterns,
    showAllPatterns,
    setShowAllPatterns,
  };
};
