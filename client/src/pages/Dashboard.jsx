import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import Heatmap from '../components/Heatmap';
import './Dashboard.css';

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
    return <div className="page-loading">Loading dashboard...</div>;
  }

  if (!stats) {
    return <div className="page-loading">Failed to load dashboard</div>;
  }

  const totalPercent = stats.totalProblems > 0 
    ? Math.round((stats.totalSolved / stats.totalProblems) * 100) 
    : 0;

  return (
    <div className="dashboard container animate-fade-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="page-desc">Your coding progress at a glance</p>
      </div>

      {/* Stats Overview */}
      <div className="stats-grid">
        <div className="stat-card stat-total">
          <div className="stat-ring-container">
            <svg className="stat-ring" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-color)" strokeWidth="6"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--accent-green)" strokeWidth="6"
                strokeDasharray={`${totalPercent * 2.64} 264`}
                strokeLinecap="round" transform="rotate(-90 50 50)"
                style={{ transition: 'stroke-dasharray 1s ease' }}/>
            </svg>
            <div className="stat-ring-value">{totalPercent}%</div>
          </div>
          <div className="stat-info">
            <span className="stat-number">{stats.totalSolved}</span>
            <span className="stat-label">of {stats.totalProblems} solved</span>
          </div>
        </div>

        {stats.difficultyStats && stats.difficultyStats.map(d => (
          <div className={`stat-card stat-${d.difficulty.toLowerCase()} transition-transform duration-300 hover:scale-[1.02] hover:ring-1 hover:ring-green-500/30`} key={d.difficulty}>
            <div className="stat-icon flex items-center justify-center">
              <div className={`w-3 h-3 rounded-full ${d.difficulty === 'Easy' ? 'bg-green-500' : d.difficulty === 'Medium' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
            </div>
            <div className="stat-info">
              <span className="stat-number">{d.solved}/{d.total}</span>
              <span className="stat-label">{d.difficulty}</span>
            </div>
            <div className="stat-bar">
              <div className="stat-bar-fill" style={{ 
                width: `${d.total > 0 ? (d.solved / d.total) * 100 : 0}%`,
                background: d.difficulty === 'Easy' ? 'var(--accent-blue)' : d.difficulty === 'Medium' ? 'var(--accent-orange)' : 'var(--accent-red)'
              }}/>
            </div>
          </div>
        ))}
      </div>

      {/* Heatmap Section */}
      <div className="dashboard-section heatmap-section">
        <div className="section-header-row">
          <h2 className="section-title">Activity Graph</h2>
          <div className="heatmap-controls">
            <select 
              value={heatmapGroup} 
              onChange={e => setHeatmapGroup(e.target.value)}
              className="heatmap-select"
            >
              <option value="me">You</option>
              {stats.groupStats && stats.groupStats.map(g => (
                <option key={g.id} value={g.id}>Group: {g.name}</option>
              ))}
            </select>
          </div>
        </div>
        {heatmapLoading ? (
          <div className="heatmap-container heatmap-loading">Loading activity...</div>
        ) : (
          <Heatmap data={heatmapData} />
        )}
      </div>

      {/* Smart Pattern Insights */}
      {patternHeatmap && (
        <div className="dashboard-section">
          <h2 className="section-title">Smart Pattern Insights</h2>
          
          <div className="insights-grid">
            {patternHeatmap.strongest && (
              <div className="insight-card strongest">
                <div className="insight-header">
                  <span className="insight-icon">🔥</span>
                  <span className="insight-label">Strongest Pattern</span>
                </div>
                <div className="insight-value">{patternHeatmap.strongest.pattern}</div>
                <div className="insight-percent text-green-500">{patternHeatmap.strongest.percent}% completion</div>
              </div>
            )}
            
            {patternHeatmap.weakest && (
              <div className="insight-card weakest">
                <div className="insight-header">
                  <span className="insight-icon">⚠️</span>
                  <span className="insight-label">Weakest Pattern</span>
                </div>
                <div className="insight-value">{patternHeatmap.weakest.pattern}</div>
                <div className="insight-percent text-yellow-500">{patternHeatmap.weakest.percent}% completion</div>
              </div>
            )}

            {patternHeatmap.neglected && (
              <div className="insight-card neglected">
                <div className="insight-header">
                  <span className="insight-icon">🕸️</span>
                  <span className="insight-label">Neglected Pattern</span>
                </div>
                <div className="insight-value">{patternHeatmap.neglected.pattern}</div>
                <div className="insight-percent text-gray-500">{patternHeatmap.neglected.percent}% completion</div>
              </div>
            )}
          </div>

          <div className="pattern-grid mt-6">
            {patternHeatmap.allPatterns.map(p => (
              <div className="pattern-card transition-transform duration-300 hover:scale-[1.02] hover:ring-1 hover:ring-green-500/30" key={p.pattern}>
                <div className="pattern-header">
                  <span className="pattern-name">{p.pattern}</span>
                  <span className="pattern-count">{p.solved}/{p.total}</span>
                </div>
                <div className="pattern-bar">
                  <div className="pattern-bar-fill" style={{ 
                    width: `${p.total > 0 ? (p.solved / p.total) * 100 : 0}%`,
                    background: p.percent >= 80 ? 'var(--accent-green)' : p.percent >= 50 ? 'var(--accent-blue)' : 'var(--accent-orange)'
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Company Preparation */}
      {companyProgress && companyProgress.length > 0 && (
        <div className="dashboard-section">
          <h2 className="section-title">Company Preparation</h2>
          <div className="company-grid">
            {companyProgress.slice(0, 10).map(c => (
              <div className="company-card transition-transform duration-300 hover:scale-[1.02] hover:ring-1 hover:ring-green-500/30" key={c.company}>
                <div className="company-header">
                  <span className="company-name">{c.company}</span>
                  <span className="company-percent font-bold">{c.percent}%</span>
                </div>
                <div className="company-stats text-sm text-gray-400 mb-2">
                  {c.solved} / {c.total} solved
                </div>
                <div className="company-bar w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="company-bar-fill h-full" style={{ 
                    width: `${c.percent}%`,
                    background: c.percent >= 80 ? 'var(--accent-green)' : c.percent >= 40 ? 'var(--accent-blue)' : 'var(--accent-purple)'
                  }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group Progress */}
      {stats.groupStats && stats.groupStats.length > 0 && (
        <div className="dashboard-section">
          <h2 className="section-title">Group Progress</h2>
          <div className="group-stats-grid">
            {stats.groupStats.map(g => (
              <div className="group-stat-card card transition-transform duration-300 hover:scale-[1.02] hover:ring-1 hover:ring-green-500/30" key={g.id} onClick={() => navigate(`/groups/${g.id}`)} style={{ cursor: 'pointer' }}>
                <h3>{g.name}</h3>
                <div className="group-stat-details">
                  <div className="gstat">
                    <span className="gstat-val">{g.solved_problems}</span>
                    <span className="gstat-label">Solved by you</span>
                  </div>
                  <div className="gstat">
                    <span className="gstat-val">{g.total_problems}</span>
                    <span className="gstat-label">Total problems</span>
                  </div>
                  <div className="gstat">
                    <span className="gstat-val">{g.member_count}</span>
                    <span className="gstat-label">Members</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {stats.recentSolved && stats.recentSolved.length > 0 && (
        <div className="dashboard-section">
          <h2 className="section-title">Recently Solved</h2>
          <div className="recent-list">
            {stats.recentSolved.map((p, i) => (
              <div className="recent-item transition-all duration-300 hover:scale-[1.01] hover:bg-gray-800/50 cursor-pointer" key={i}>
                <span className="recent-check text-green-500">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </span>
                <span className="recent-num">#{p.leetcode_number}</span>
                <span className="recent-title">{p.title}</span>
                <span className={`badge badge-${p.difficulty.toLowerCase()}`}>{p.difficulty}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
