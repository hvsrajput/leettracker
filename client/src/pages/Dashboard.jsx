import { useState, useEffect } from 'react';
import api from '../api';
import Heatmap from '../components/Heatmap';
import './Dashboard.css';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState({});
  const [heatmapLoading, setHeatmapLoading] = useState(true);
  const [heatmapGroup, setHeatmapGroup] = useState('me'); // 'me' or groupId

  useEffect(() => {
    api.get('/dashboard')
      .then(res => setStats(res.data))
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
          <div className={`stat-card stat-${d.difficulty.toLowerCase()}`} key={d.difficulty}>
            <div className="stat-icon">
              {d.difficulty === 'Easy' ? '🟢' : d.difficulty === 'Medium' ? '🟡' : '🔴'}
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

      {/* Pattern Progress */}
      <div className="dashboard-section">
        <h2 className="section-title">Pattern Progress</h2>
        <div className="pattern-grid">
          {stats.patternStats && stats.patternStats.map(p => (
            <div className="pattern-card" key={p.name}>
              <div className="pattern-header">
                <span className="pattern-name">{p.name}</span>
                <span className="pattern-count">{p.solved}/{p.total}</span>
              </div>
              <div className="pattern-bar">
                <div className="pattern-bar-fill" style={{ 
                  width: `${p.total > 0 ? (p.solved / p.total) * 100 : 0}%` 
                }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Group Progress */}
      {stats.groupStats && stats.groupStats.length > 0 && (
        <div className="dashboard-section">
          <h2 className="section-title">Group Progress</h2>
          <div className="group-stats-grid">
            {stats.groupStats.map(g => (
              <div className="group-stat-card card" key={g.id}>
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
              <div className="recent-item" key={i}>
                <span className="recent-check">✅</span>
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
