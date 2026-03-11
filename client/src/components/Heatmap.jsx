import { useMemo, useState } from 'react';

const WEEKS_TO_SHOW = 52;
const DAYS_IN_WEEK = 7;

export default function Heatmap({ data }) {
  const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { calendarData, monthLabels, totalContributions } = useMemo(() => {
    // If selectedYear is current year, today is the actual date.
    // If a past year, today is Dec 31st of that year.
    const currentYear = new Date().getFullYear();
    const today = selectedYear === currentYear ? new Date() : new Date(selectedYear, 11, 31);
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
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

      if (i % 7 === 0) {
        const month = d.getMonth();
        if (month !== lastMonth) {
          months.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), weekIndex: Math.floor(i / 7) });
          lastMonth = month;
        }
      }
    }

    return { calendarData: dataPoints, monthLabels: months, totalContributions: total };
  }, [data, selectedYear]);

  const getColorClass = (count) => {
    if (count === -1) return 'bg-white/5 border border-white/5'; 
    if (count === 0) return 'bg-white/5 border border-white/10';
    if (count >= 10) return 'bg-[#39d353]';
    if (count >= 5) return 'bg-[#26a641]'; 
    if (count >= 2) return 'bg-[#006d32]'; 
    return 'bg-[#0e4429]';
  };

  const handleMouseEnter = (e, day) => {
    if (day.count === -1) return;
    const rect = e.target.getBoundingClientRect();
    const countText = day.count === 0 ? 'No submissions' : `${day.count} submission${day.count > 1 ? 's' : ''}`;
    
    setTooltip({
      show: true,
      text: `${countText} on ${day.displayDate}`,
      x: rect.left + rect.width / 2,
      y: rect.top - 8
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, text: '', x: 0, y: 0 });
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 shadow-lg shadow-black/30 w-full animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
            Activity Graph
          </h2>
          <p className="text-gray-400 text-sm mt-1">{totalContributions} submission{totalContributions !== 1 ? 's' : ''} in {selectedYear}</p>
        </div>
        
        <select 
          value={selectedYear} 
          onChange={e => setSelectedYear(parseInt(e.target.value))}
          className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-200 outline-none focus:border-indigo-500 hover:border-white/20 transition-all cursor-pointer backdrop-blur-md"
        >
          {Array.from({ length: 5 }).map((_, i) => {
            const year = new Date().getFullYear() - i;
            return <option key={year} value={year}>{year}</option>;
          })}
        </select>
      </div>

      <div className="flex justify-center mt-6 overflow-x-auto pb-4 custom-scrollbar">
        <div className="relative min-w-max">
          {/* Months Header */}
          <div className="flex relative h-6 text-xs font-medium text-gray-500">
            {monthLabels.map((m, i) => (
              <span 
                key={i} 
                className="absolute"
                style={{ left: `calc(${m.weekIndex} * 26px)` }} // 20px cell + 6px gap
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            {/* Days Legend */}
            <div className="grid grid-rows-7 gap-[6px] text-[10px] font-medium text-gray-500 pr-2 pt-[2px]">
              <span className="row-start-1 h-5 flex items-center pr-2">Mon</span>
              <span className="row-start-2 h-5 flex items-center pr-2">Tue</span>
              <span className="row-start-3 h-5 flex items-center pr-2">Wed</span>
              <span className="row-start-4 h-5 flex items-center pr-2">Thu</span>
              <span className="row-start-5 h-5 flex items-center pr-2">Fri</span>
              <span className="row-start-6 h-5 flex items-center pr-2">Sat</span>
              <span className="row-start-7 h-5 flex items-center pr-2">Sun</span>
            </div>

            {/* Heatmap Grid */}
            <div className="grid grid-rows-7 grid-flow-col gap-[6px]">
              {calendarData.map((day, i) => (
                <div 
                  key={i} 
                  className={`w-5 h-5 rounded-[4px] transition-all duration-200 ${getColorClass(day.count)} ${day.count !== -1 ? 'hover:ring-2 ring-white/30 cursor-crosshair hover:scale-[1.15]' : ''}`}
                  onMouseEnter={(e) => handleMouseEnter(e, day)}
                  onMouseLeave={handleMouseLeave}
                />
              ))}
            </div>
          </div>

          {/* Legend Footer */}
          <div className="flex items-center justify-end gap-2 mt-5 text-xs font-medium text-gray-500">
            <span>Less</span>
            <div className="w-3 h-3 rounded-[3px] bg-white/5 border border-white/10" />
            <div className="w-3 h-3 rounded-[3px] bg-[#0e4429]" />
            <div className="w-3 h-3 rounded-[3px] bg-[#006d32]" />
            <div className="w-3 h-3 rounded-[3px] bg-[#26a641]" />
            <div className="w-3 h-3 rounded-[3px] bg-[#39d353]" />
            <span>More</span>
          </div>

          {/* Tooltip Overlay */}
          {tooltip.show && (
            <div 
              className="fixed z-50 bg-neutral-900 text-gray-100 text-xs py-2 px-3 rounded-lg shadow-xl shadow-black/50 border border-white/10 backdrop-blur-md pointer-events-none transform -translate-x-1/2 -translate-y-[calc(100%+8px)] font-medium whitespace-nowrap"
              style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}
            >
              {tooltip.text}
              <div className="absolute left-1/2 bottom-0 transform -translate-x-1/2 translate-y-[4.5px] rotate-45 w-2 h-2 bg-neutral-900 border-r border-b border-white/10"></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
