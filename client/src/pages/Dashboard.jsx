import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Heatmap from '../components/Heatmap';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState({});
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [heatmapGroup, setHeatmapGroup] = useState('me'); // 'me' or groupId

  // New states for Smart Pattern Heatmap & Company Preparation
  const [patternHeatmap, setPatternHeatmap] = useState(null);
  const [companyProgress, setCompanyProgress] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard'),
      api.get('/dashboard/pattern-heatmap/me'),
      api.get('/dashboard/company-progress/me')
    ])
    .then(([dashRes, patternRes, companyRes]) => {
      setStats(dashRes.data);
      setPatternHeatmap(patternRes.data);
      setCompanyProgress(companyRes.data);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setHeatmapLoading(true);
    api.get(`/dashboard/heatmap?groupId=${heatmapGroup}`)
      .then(res => setHeatmapData(res.data))
      .catch(console.error)
      .finally(() => setHeatmapLoading(false));
  }, [heatmapGroup]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh] text-gray-400">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="flex items-center justify-center min-h-[50vh] text-red-400">Failed to load dashboard</div>;
  }

  const totalPercent = stats.totalProblems > 0 
    ? Math.round((stats.totalSolved / stats.totalProblems) * 100) 
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-gray-400 mt-2">Your coding progress at a glance</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-black/30">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" className="stroke-white/10" strokeWidth="6"/>
              <circle cx="50" cy="50" r="42" fill="none" className="stroke-[#238636]" strokeWidth="6"
                strokeDasharray={`${totalPercent * 2.64} 264`}
                strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }}/>
            </svg>
            <div className="absolute text-xl font-bold text-white">{totalPercent}%</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{stats.totalSolved}</div>
            <div className="text-sm text-gray-400">of {stats.totalProblems} solved</div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:scale-[1.02] hover:bg-white/10 shadow-lg shadow-black/30">
          <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center ring-1 ring-yellow-500/30">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{stats.totalAttempted || 0}</div>
            <div className="text-sm text-gray-400">Attempted</div>
          </div>
        </div>

        {stats.difficultyStats && stats.difficultyStats.map(d => (
          <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 flex flex-col items-center justify-center gap-4 transition-all duration-300 hover:scale-[1.02] hover:bg-white/10 shadow-lg shadow-black/30 w-full" key={d.difficulty}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ring-1 ${d.difficulty === 'Easy' ? 'bg-blue-500/20 ring-blue-500/30' : d.difficulty === 'Medium' ? 'bg-yellow-500/20 ring-yellow-500/30' : 'bg-red-500/20 ring-red-500/30'}`}>
              <div className={`w-3 h-3 rounded-full ${d.difficulty === 'Easy' ? 'bg-blue-500' : d.difficulty === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
            </div>
            <div className="text-center w-full">
              <div className="text-2xl font-bold text-white">{d.solved}/{d.total}</div>
              <div className="text-sm text-gray-400">{d.difficulty}</div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full mt-3 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ 
                  width: `${d.total > 0 ? (d.solved / d.total) * 100 : 0}%`,
                  backgroundColor: d.difficulty === 'Easy' ? '#3b82f6' : d.difficulty === 'Medium' ? '#eab308' : '#ef4444'
                }}/>
              </div>
            </div>
          </div>
        ))}
      </div>

      {heatmapLoading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 flex items-center justify-center text-gray-400 min-h-[300px]">Loading activity...</div>
      ) : (
        <Heatmap data={heatmapData} />
      )}

      {/* Smart Pattern Insights */}
      {patternHeatmap && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Smart Pattern Insights</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {patternHeatmap.strongest && (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-black/30 border-t-2 border-t-green-500">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-green-500 bg-green-500/10 p-1.5 rounded-lg flex-shrink-0">
                    <svg className="w-5 h-5 block" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Strongest Pattern</span>
                </div>
                <div className="text-xl font-bold text-white truncate" title={patternHeatmap.strongest.pattern}>{patternHeatmap.strongest.pattern}</div>
                <div className="text-green-500 font-medium mt-1">{patternHeatmap.strongest.percent}% completion</div>
              </div>
            )}
            
            {patternHeatmap.weakest && (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-black/30 border-t-2 border-t-yellow-500">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-yellow-500 bg-yellow-500/10 p-1.5 rounded-lg flex-shrink-0">
                    <svg className="w-5 h-5 block" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Weakest Pattern</span>
                </div>
                <div className="text-xl font-bold text-white truncate" title={patternHeatmap.weakest.pattern}>{patternHeatmap.weakest.pattern}</div>
                <div className="text-yellow-500 font-medium mt-1">{patternHeatmap.weakest.percent}% completion</div>
              </div>
            )}

            {patternHeatmap.neglected && (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-black/30 border-t-2 border-t-gray-500">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-gray-400 bg-gray-500/10 p-1.5 rounded-lg flex-shrink-0">
                    <svg className="w-5 h-5 block" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                  </span>
                  <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">Neglected Pattern</span>
                </div>
                <div className="text-xl font-bold text-white truncate" title={patternHeatmap.neglected.pattern}>{patternHeatmap.neglected.pattern}</div>
                <div className="text-gray-500 font-medium mt-1">{patternHeatmap.neglected.percent}% completion</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {patternHeatmap.allPatterns.map(p => (
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5 transition-all duration-300 hover:scale-[1.02] hover:bg-white/10 shadow-md shadow-black/20" key={p.pattern}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-white truncate mr-2" title={p.pattern}>{p.pattern}</span>
                  <span className="text-sm font-medium text-gray-400 flex-shrink-0">{p.solved}/{p.total}</span>
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ 
                    width: `${p.total > 0 ? (p.solved / p.total) * 100 : 0}%`,
                    backgroundColor: p.percent >= 80 ? '#22c55e' : p.percent >= 50 ? '#3b82f6' : '#f97316'
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Company Preparation */}
      {companyProgress && companyProgress.length > 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-white">Company Preparation</h2>
            <p className="text-xs text-gray-500 mt-1 italic">Company tagging is based on community-reported data and may not be fully accurate.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {companyProgress.slice(0, 10).map(c => (
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-5 transition-all duration-300 hover:scale-[1.02] hover:bg-white/10 shadow-md shadow-black/20" key={c.company}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-white truncate mr-2" title={c.company}>{c.company}</span>
                  <span className="font-bold text-indigo-400">{c.percent}%</span>
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  {c.solved} / {c.total} solved
                </div>
                <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ 
                    width: `${c.percent}%`,
                    backgroundColor: c.percent >= 80 ? '#22c55e' : c.percent >= 40 ? '#3b82f6' : '#a855f7'
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group Progress */}
      {stats.groupStats && stats.groupStats.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-white">Group Progress</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.groupStats.map(g => (
              <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 transition-all duration-300 hover:scale-[1.02] hover:bg-white/10 shadow-lg shadow-black/30 cursor-pointer" key={g.id} onClick={() => navigate(`/groups/${g.id}`)}>
                <h3 className="text-lg font-bold text-white mb-4">{g.name}</h3>
                <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-4">
                  <div className="flex flex-col">
                    <span className="text-lg font-bold text-white">{g.solved_problems}</span>
                    <span className="text-xs text-gray-500">Solved by you</span>
                  </div>
                  <div className="flex flex-col border-l border-white/10 pl-4">
                    <span className="text-lg font-bold text-white">{g.total_problems}</span>
                    <span className="text-xs text-gray-500">Total problems</span>
                  </div>
                  <div className="flex flex-col border-l border-white/10 pl-4">
                    <span className="text-lg font-bold text-white">{g.member_count}</span>
                    <span className="text-xs text-gray-500">Members</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {stats.recentSolved && stats.recentSolved.length > 0 && (
        <div className="space-y-6 pb-12">
          <h2 className="text-xl font-bold text-white">Recently Solved</h2>
          <div className="space-y-2">
            {stats.recentSolved.map((p, i) => (
              <div className="rounded-xl border border-white/5 bg-white-[0.02] backdrop-blur-sm p-4 flex items-center gap-4 transition-all duration-300 hover:bg-white/10 hover:translate-x-1" key={i}>
                <span className="text-green-500 bg-green-500/10 p-1.5 rounded-lg flex-shrink-0">
                  <svg className="w-5 h-5 block" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </span>
                <span className="text-gray-500 font-mono text-sm w-12 flex-shrink-0">#{p.leetcode_number}</span>
                <span className="font-semibold text-gray-200 flex-1 truncate">{p.title}</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border ${
                  p.difficulty === 'Easy' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                  p.difficulty === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                  'bg-red-500/10 text-red-400 border-red-500/20'
                }`}>
                  {p.difficulty}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
