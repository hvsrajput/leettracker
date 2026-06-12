import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCheck,
  Clock,
  Target,
  Flame,
  Users,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  LayoutDashboard,
} from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Heatmap from '../components/Heatmap';
import { Card, CardContent } from '../components/ui/card';
import { Badge, DifficultyBadge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import { cn } from '../lib/utils';

function hasVisibleHeatmapActivity(data, year) {
  const entries = Object.entries(data || {}).filter(([, count]) => count > 0);
  if (entries.length === 0) {
    return false;
  }

  const currentYear = new Date().getFullYear();
  if (year !== currentYear) {
    return entries.some(([date]) => date.startsWith(`${year}-`));
  }

  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 364);

  return entries.some(([date]) => {
    const dateObj = new Date(`${date}T00:00:00`);
    return dateObj >= startDate && dateObj <= endDate;
  });
}

function getBestHeatmapYear(data) {
  const currentYear = new Date().getFullYear();
  if (hasVisibleHeatmapActivity(data, currentYear)) {
    return currentYear;
  }

  const years = Object.entries(data || {})
    .filter(([, count]) => count > 0)
    .map(([date]) => Number(date.slice(0, 4)))
    .filter(Number.isFinite);

  return years.length > 0 ? Math.max(...years) : currentYear;
}

function getLeetCodeUrl(problem) {
  if (problem.url) {
    return problem.url;
  }

  const searchTerm = problem.leetcode_number || problem.title || '';
  return `https://leetcode.com/problemset/all/?search=${encodeURIComponent(searchTerm)}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86400000;
  const d = Math.floor(diff / day);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

// Current consecutive-day streak + total active days from the heatmap.
function computeStreak(heatmapData) {
  const days = new Set(
    Object.entries(heatmapData || {})
      .filter(([, count]) => count > 0)
      .map(([date]) => date)
  );
  if (days.size === 0) return { current: 0, activeDays: 0 };

  const key = (d) => d.toISOString().slice(0, 10);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // Allow the streak to count even if today has no solve yet.
  if (!days.has(key(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let current = 0;
  while (days.has(key(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { current, activeDays: days.size };
}

const DIFFICULTY_ORDER = { Easy: 0, Medium: 1, Hard: 2 };
const DIFFICULTY_COLOR = {
  Easy: { text: 'text-sky-400', bar: 'bg-sky-400', dot: 'bg-sky-400' },
  Medium: { text: 'text-amber-400', bar: 'bg-amber-400', dot: 'bg-amber-400' },
  Hard: { text: 'text-rose-400', bar: 'bg-rose-400', dot: 'bg-rose-400' },
};

function SectionLabel({ children, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{children}</h2>
      {hint && <span className="text-xs text-muted-foreground/70">{hint}</span>}
    </div>
  );
}

function StatCard(props) {
  const { label, value, sub, accentText, accentBg, delay = 0 } = props;
  return (
    <Card
      className="p-5 sm:p-6 animate-rise transition-colors hover:bg-white/[0.04]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <span className={cn('p-2 rounded-lg', accentBg, accentText)}>
          <props.Icon className="h-4.5 w-4.5" size={18} />
        </span>
      </div>
      <div className="mt-4 text-3xl font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-sm text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
      <div className="space-y-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
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
        const heatmapRes = await api.getCached('/dashboard/heatmap?groupId=me', {}, 30000);
        applyHeatmapData(heatmapRes.data || {});
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) {
          setHeatmapLoading(false);
        }
      }
    };

    api.getCached('/dashboard', {}, 15000)
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

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!stats) {
    return <div className="flex items-center justify-center min-h-[50vh] text-rose-400">Failed to load dashboard</div>;
  }

  const totalSolved = stats.totalSolved || 0;
  const totalAttempted = stats.totalAttempted || 0;
  const totalProblems = stats.totalProblems || 0;
  const remaining = Math.max(totalProblems - totalSolved, 0);
  const totalPercent = totalProblems > 0 ? Math.round((totalSolved / totalProblems) * 100) : 0;
  const ringCircumference = 2 * Math.PI * 42;

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  const allPatterns = patternHeatmap?.allPatterns || [];
  const visiblePatterns = showAllPatterns ? allPatterns : allPatterns.slice(0, 8);

  const isEmpty = totalProblems === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-24 md:pb-12 space-y-12">
      {/* Greeting */}
      <header className="animate-fade-in">
        <p className="text-sm text-muted-foreground">{todayLabel}</p>
        <h1 className="mt-1 text-3xl sm:text-4xl font-bold text-white tracking-tight">
          {getGreeting()}{user?.username ? `, ${user.username}` : ''}
        </h1>
        <p className="text-muted-foreground mt-2">
          {isEmpty
            ? 'Start tracking problems to see your progress here.'
            : `You've solved ${totalSolved} of ${totalProblems} tracked problems.`}
        </p>
      </header>

      {isEmpty ? (
        <Card className="p-12 flex flex-col items-center text-center animate-rise">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-5">
            <LayoutDashboard className="h-7 w-7" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No data yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">Add problems or import your LeetCode history to build your dashboard.</p>
          <Button onClick={() => navigate('/problems')}>Go to Problems</Button>
        </Card>
      ) : (
        <>
          {/* KPI strip */}
          <section>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <StatCard
                label="Solved"
                value={totalSolved}
                sub={`${totalPercent}% of tracked`}
                accentText="text-emerald-400"
                accentBg="bg-emerald-500/10"
                delay={0}
                Icon={CheckCheck}
              />
              <StatCard
                label="Attempted"
                value={totalAttempted}
                sub="in progress"
                accentText="text-amber-400"
                accentBg="bg-amber-500/10"
                delay={60}
                Icon={Clock}
              />
              <StatCard
                label="Remaining"
                value={remaining}
                sub="left to solve"
                accentText="text-indigo-400"
                accentBg="bg-indigo-500/10"
                delay={120}
                Icon={Target}
              />
              <StatCard
                label="Day streak"
                value={streak.current}
                sub={`${streak.activeDays} active days`}
                accentText="text-orange-400"
                accentBg="bg-orange-500/10"
                delay={180}
                Icon={Flame}
              />
            </div>
          </section>

          {/* Overview: completion + difficulty */}
          <section>
            <SectionLabel hint={`${totalSolved}/${totalProblems} solved`}>Overview</SectionLabel>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Completion donut */}
              <Card className="p-6 sm:p-8 flex flex-col items-center justify-center animate-rise">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" className="stroke-white/[0.06]" strokeWidth="7" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      className="stroke-emerald-500"
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${(totalPercent / 100) * ringCircumference} ${ringCircumference}`}
                      style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.22,1,0.36,1)' }}
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-bold text-white tabular-nums">{totalPercent}%</span>
                    <span className="text-xs text-muted-foreground mt-0.5">complete</span>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-6 text-center">
                  <div>
                    <div className="text-lg font-bold text-emerald-400 tabular-nums">{totalSolved}</div>
                    <div className="text-xs text-muted-foreground">Solved</div>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <div className="text-lg font-bold text-gray-300 tabular-nums">{totalProblems}</div>
                    <div className="text-xs text-muted-foreground">Tracked</div>
                  </div>
                </div>
              </Card>

              {/* Difficulty breakdown */}
              <Card className="p-6 sm:p-8 lg:col-span-2 animate-rise" style={{ animationDelay: '80ms' }}>
                <h3 className="text-sm font-medium text-gray-300 mb-6">By difficulty</h3>
                {difficultyStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No difficulty data.</p>
                ) : (
                  <div className="space-y-6">
                    {difficultyStats.map((d) => {
                      const colors = DIFFICULTY_COLOR[d.difficulty] || DIFFICULTY_COLOR.Medium;
                      const percent = d.total > 0 ? Math.round((d.solved / d.total) * 100) : 0;
                      return (
                        <div key={d.difficulty}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="flex items-center gap-2 text-sm font-medium text-gray-300">
                              <span className={cn('w-2 h-2 rounded-full', colors.dot)} />
                              {d.difficulty}
                            </span>
                            <span className="text-sm text-muted-foreground tabular-nums">
                              <span className={cn('font-semibold', colors.text)}>{d.solved}</span>
                              {' / '}{d.total}
                              <span className="ml-2 text-muted-foreground/70">{percent}%</span>
                            </span>
                          </div>
                          <Progress value={percent} indicatorClassName={colors.bar} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          </section>

          {/* Activity graph */}
          <section>
            <SectionLabel hint="Daily solves">Activity</SectionLabel>
            <Card className="p-4 sm:p-6 min-h-[280px] animate-rise">
              <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
                {Array.from({ length: 5 }).map((_, i) => {
                  const year = new Date().getFullYear() - i;
                  const isActive = selectedYear === year;
                  return (
                    <button
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      className={cn(
                        'text-xs font-medium transition-all duration-200 px-3 py-1.5 rounded-lg border',
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                          : 'text-muted-foreground border-transparent hover:text-gray-300 hover:bg-white/5'
                      )}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>

              {heatmapLoading ? (
                <div className="flex items-center justify-center text-muted-foreground h-full py-20">Loading activity...</div>
              ) : (
                <Heatmap data={heatmapData} year={selectedYear} />
              )}
            </Card>
          </section>

          {/* Pattern focus */}
          {patternHeatmap && (patternHeatmap.strongest || patternHeatmap.weakest || patternHeatmap.neglected) && (
            <section>
              <SectionLabel hint="Where to focus next">Pattern focus</SectionLabel>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                {[
                  {
                    data: patternHeatmap.strongest,
                    label: 'Strongest',
                    accent: 'text-emerald-400',
                    bg: 'bg-emerald-500/10',
                    bar: 'bg-emerald-500',
                    Icon: TrendingUp,
                  },
                  {
                    data: patternHeatmap.weakest,
                    label: 'Needs work',
                    accent: 'text-amber-400',
                    bg: 'bg-amber-500/10',
                    bar: 'bg-amber-500',
                    Icon: AlertTriangle,
                  },
                  {
                    data: patternHeatmap.neglected,
                    label: 'Neglected',
                    accent: 'text-gray-400',
                    bg: 'bg-gray-500/10',
                    bar: 'bg-gray-500',
                    Icon: Clock,
                  },
                ].filter((entry) => entry.data).map((entry, idx) => (
                  <Card
                    key={entry.label}
                    className="p-6 animate-rise"
                    style={{ animationDelay: `${idx * 70}ms` }}
                  >
                    <div className="flex items-center gap-2 mb-4">
                      <span className={cn('p-1.5 rounded-lg', entry.bg, entry.accent)}>
                        <entry.Icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{entry.label}</span>
                    </div>
                    <div className="text-lg font-bold text-white truncate" title={entry.data.pattern}>{entry.data.pattern}</div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground tabular-nums">{entry.data.solved}/{entry.data.total}</span>
                      <span className={cn('font-semibold tabular-nums', entry.accent)}>{entry.data.percent}%</span>
                    </div>
                    <Progress className="mt-2 h-1.5" value={entry.data.percent} indicatorClassName={entry.bar} />
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Recently solved + Groups */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
            {/* Recently solved */}
            <div>
              <SectionLabel>Recently solved</SectionLabel>
              {stats.recentSolved && stats.recentSolved.length > 0 ? (
                <Card className="divide-y divide-white/[0.05] overflow-hidden animate-rise">
                  {stats.recentSolved.slice(0, 8).map((p) => (
                    <a
                      key={p.leetcode_number}
                      href={getLeetCodeUrl(p)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Open ${p.title} on LeetCode`}
                      className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.04]"
                    >
                      <CheckCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <span className="text-muted-foreground/70 font-mono text-xs w-10 flex-shrink-0">#{p.leetcode_number}</span>
                      <span className="font-medium text-gray-200 flex-1 min-w-0 truncate group-hover:text-white transition-colors">{p.title}</span>
                      {p.solved_at && <span className="text-xs text-muted-foreground/70 flex-shrink-0 hidden sm:block">{timeAgo(p.solved_at)}</span>}
                      <DifficultyBadge difficulty={p.difficulty} />
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 hidden sm:block" />
                    </a>
                  ))}
                </Card>
              ) : (
                <Card className="p-8 text-center text-sm text-muted-foreground animate-rise">
                  No solved problems yet.
                </Card>
              )}
            </div>

            {/* Groups */}
            <div>
              <SectionLabel hint={stats.groupStats?.length ? `${stats.groupStats.length} groups` : undefined}>Groups</SectionLabel>
              {stats.groupStats && stats.groupStats.length > 0 ? (
                <div className="space-y-3">
                  {stats.groupStats.map((g, idx) => {
                    const percent = g.total_problems > 0 ? Math.round((g.solved_problems / g.total_problems) * 100) : 0;
                    return (
                      <Card
                        key={g.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => navigate(`/groups/${g.id}`)}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(`/groups/${g.id}`)}
                        className="w-full text-left p-5 cursor-pointer transition-colors hover:bg-white/[0.04] animate-rise"
                        style={{ animationDelay: `${idx * 60}ms` }}
                      >
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <h3 className="font-semibold text-white truncate">{g.name}</h3>
                          <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {g.member_count}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Progress className="flex-1" value={percent} />
                          <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{g.solved_problems}/{g.total_problems}</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="p-8 text-center text-sm text-muted-foreground animate-rise">
                  You're not in any groups yet.
                </Card>
              )}
            </div>
          </section>

          {/* Topic mastery */}
          {allPatterns.length > 0 && (
            <section>
              <SectionLabel hint={`${allPatterns.length} topics`}>Topic mastery</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {visiblePatterns.map((p, idx) => {
                  const barColor = p.percent >= 80 ? 'bg-emerald-500' : p.percent >= 50 ? 'bg-indigo-400' : 'bg-amber-500';
                  return (
                    <Card
                      key={p.pattern}
                      className="p-4 sm:p-5 animate-rise"
                      style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="font-medium text-sm text-gray-200 truncate" title={p.pattern}>{p.pattern}</span>
                        <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">{p.solved}/{p.total}</span>
                      </div>
                      <Progress className="h-1.5" value={p.percent} indicatorClassName={barColor} />
                    </Card>
                  );
                })}
              </div>
              {allPatterns.length > 8 && (
                <div className="flex justify-center mt-6">
                  <Button variant="outline" onClick={() => setShowAllPatterns(v => !v)}>
                    {showAllPatterns ? 'Show less' : `Show all ${allPatterns.length} topics`}
                  </Button>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
