import { useMemo } from 'react';
import './Heatmap.css';


// 1 year of data
const WEEKS_TO_SHOW = 52;
const DAYS_IN_WEEK = 7;

export default function Heatmap({ data }) {
  // data is an object: { 'YYYY-MM-DD': 2, 'YYYY-MM-DD': 5 }

  const calendarData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Normalize today to the end of the current week (Saturday)
    // so we get full weeks in the grid
    const endOffset = 6 - today.getDay();
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + endOffset);

    const dates = [];
    const numDays = WEEKS_TO_SHOW * DAYS_IN_WEEK;
    
    // Generate dates working backwards
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setDate(endDate.getDate() - i);
      
      const dateStr = d.toISOString().split('T')[0];
      const count = data[dateStr] || 0;
      
      // Don't show future dates
      const isFuture = d > today;

      dates.push({
        date: dateStr,
        count: isFuture ? -1 : count,
        dayOfWeek: d.getDay(),
        month: d.toLocaleString('default', { month: 'short' })
      });
    }

    return dates;
  }, [data]);

  const totalContributions = useMemo(() => {
    return calendarData.reduce((sum, d) => sum + (d.count > 0 ? d.count : 0), 0);
  }, [calendarData]);

  // Extract month labels (only place a label when the month changes)
  const monthLabels = useMemo(() => {
    const labels = [];
    let lastMonth = null;
    
    calendarData.forEach((day, i) => {
      // Only check the first day of each column (Sunday)
      if (day.dayOfWeek === 0) {
        if (day.month !== lastMonth) {
          labels.push({ x: Math.floor(i / 7), label: day.month });
          lastMonth = day.month;
        }
      }
    });
    return labels;
  }, [calendarData]);

  const getColorClass = (count) => {
    if (count === -1) return 'color-empty future'; // Future
    if (count === 0) return 'color-empty';
    if (count >= 4) return 'color-scale-4';
    if (count >= 3) return 'color-scale-3';
    if (count >= 2) return 'color-scale-2';
    return 'color-scale-1'; // 1 solve
  };

  return (
    <div className="heatmap-container">
      <div className="heatmap-title-row">
        <span className="heatmap-contribution-count">
          {totalContributions} {totalContributions === 1 ? 'question' : 'questions'} solved in the last year
        </span>
      </div>

      <div className="heatmap-header">
        <div className="heatmap-months">
          {monthLabels.map((lbl, i) => (
            <span key={i} style={{ left: `${lbl.x * 13}px` }}>
              {lbl.label}
            </span>
          ))}
        </div>
      </div>
      
      <div className="heatmap-body">
        <div className="heatmap-days-legend">
          <span>Mon</span>
          <span>Wed</span>
          <span>Fri</span>
        </div>
        
        <div className="heatmap-grid">
          {calendarData.map((day, i) => (
            <div 
              key={i} 
              className={`heatmap-cell ${getColorClass(day.count)}`}
              title={day.count === -1 ? '' : `${day.count} ${day.count === 1 ? 'question' : 'questions'} solved that day`}
            />
          ))}
        </div>
      </div>

      <div className="heatmap-footer">
        Less
        <div className="heatmap-legend">
          <div className="heatmap-cell color-empty" />
          <div className="heatmap-cell color-scale-1" />
          <div className="heatmap-cell color-scale-2" />
          <div className="heatmap-cell color-scale-3" />
          <div className="heatmap-cell color-scale-4" />
        </div>
        More
      </div>
    </div>
  );
}
