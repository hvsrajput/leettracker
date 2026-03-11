import { useMemo, useState } from 'react';
import './Heatmap.css';

const WEEKS_TO_SHOW = 52;
const DAYS_IN_WEEK = 7;

export default function Heatmap({ data }) {
  const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });

  // Generate the full historical grid data
  const { calendarData, monthLabels, totalContributions } = useMemo(() => {
    // We want the grid to end on the Saturday of the current week.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
    const daysToEndOfWeek = 6 - dayOfWeek;
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + daysToEndOfWeek);

    const numDays = WEEKS_TO_SHOW * DAYS_IN_WEEK;
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - numDays + 1);

    const dataPoints = [];
    const months = [];
    let lastMonth = -1;
    let total = 0;

    // Generate days left to right, top to bottom (column by column)
    // CSS Grid uses grid-auto-flow: column
    for (let i = 0; i < numDays; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      
      const dateStr = d.toISOString().split('T')[0];
      const count = data[dateStr] || 0;
      const isFuture = d > today;
      
      if (!isFuture && count > 0) total += count;

      dataPoints.push({
        date: dateStr,
        displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        count: isFuture ? -1 : count,
        dayOfWeek: d.getDay()
      });

      // Track months for labels (placed on the first week the month appears)
      // i % 7 === 0 means it's Sunday (top of a column)
      if (i % 7 === 0) {
        const month = d.getMonth();
        if (month !== lastMonth) {
          months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), weekIndex: Math.floor(i / 7) });
          lastMonth = month;
        }
      }
    }

    return { calendarData: dataPoints, monthLabels: months, totalContributions: total };
  }, [data]);

  const getColorClass = (count) => {
    if (count === -1) return 'color-empty future';
    if (count === 0) return 'color-empty';
    if (count >= 10) return 'color-scale-4'; // High activity
    if (count >= 5) return 'color-scale-3'; 
    if (count >= 2) return 'color-scale-2'; 
    return 'color-scale-1'; // 1 solve
  };

  const handleMouseEnter = (e, day) => {
    if (day.count === -1) return;
    const rect = e.target.getBoundingClientRect();
    const countText = day.count === 0 ? 'No submissions' : `${day.count} submission${day.count > 1 ? 's' : ''}`;
    
    setTooltip({
      show: true,
      text: `${countText} on ${day.displayDate}`,
      x: rect.left + rect.width / 2,
      y: rect.top - 8 // Hover strictly above the cell
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, text: '', x: 0, y: 0 });
  };

  return (
    <div className="gh-heatmap-container">
      <div className="gh-heatmap-header">
        <h3 className="gh-heatmap-title">
          {totalContributions} submission{totalContributions !== 1 ? 's' : ''} in the last year
        </h3>
      </div>

      <div className="gh-heatmap-body">
        <div className="gh-heatmap-months">
          {monthLabels.map((m, i) => (
            <span key={i} style={{ left: `calc(${m.weekIndex} * 14px + 14px)` }}>
              {m.label}
            </span>
          ))}
        </div>

        <div className="gh-heatmap-grid-wrapper">
          <div className="gh-heatmap-days-legend">
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
          </div>

          <div className="gh-heatmap-grid">
            {calendarData.map((day, i) => (
              <div 
                key={i} 
                className={`gh-cell ${getColorClass(day.count)}`}
                onMouseEnter={(e) => handleMouseEnter(e, day)}
                onMouseLeave={handleMouseLeave}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="gh-heatmap-footer">
        Less
        <div className="gh-legend-colors">
          <div className="gh-cell color-empty" />
          <div className="gh-cell color-scale-1" />
          <div className="gh-cell color-scale-2" />
          <div className="gh-cell color-scale-3" />
          <div className="gh-cell color-scale-4" />
        </div>
        More
      </div>

      {/* GitHub-style Tooltip */}
      {tooltip.show && (
        <div 
          className="gh-tooltip"
          style={{ 
            left: `${tooltip.x}px`, 
            top: `${tooltip.y}px` 
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
