import { useEffect, useRef, useState, useMemo } from "react";

export default function Heatmap({ data = {}, year = new Date().getFullYear() }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });

  // Config based on requirements
  const YEAR_SELECTOR_WIDTH = 120; // Slightly adjusted for tight fit
  const H_PADDING = 48; // p-6 on both sides
  const GAP_PX = 5;
  const MIN_CELL = 8;
  const MAX_CELL = 18;
  const WEEKS = 53;

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(entries => {
      for (let entry of entries) {
        setContainerWidth(Math.floor(entry.contentRect.width));
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { cellSizePx } = useMemo(() => {
    const available = Math.max(0, containerWidth - YEAR_SELECTOR_WIDTH - H_PADDING);
    const totalGaps = (WEEKS - 1) * GAP_PX;
    const raw = Math.floor((available - totalGaps) / WEEKS);
    const clamped = Math.max(MIN_CELL, Math.min(MAX_CELL, raw || MIN_CELL));
    return { cellSizePx: clamped };
  }, [containerWidth]);

  const dates = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let endDate;
    if (year === currentYear) {
      endDate = new Date();
      endDate.setHours(0, 0, 0, 0);
    } else {
      endDate = new Date(year, 11, 31);
    }
    
    // Aligned to 365 days ending at endDate
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 364);
    
    const arr = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      arr.push(new Date(d));
    }
    return arr;
  }, [year]);

  const dayCells = useMemo(() => {
    if (!dates.length) return [];
    const start = dates[0];
    const cells = [];
    for (let i = 0; i < dates.length; i++) {
      const d = dates[i];
      const dateStr = d.toISOString().slice(0, 10);
      const dayOfWeek = (d.getDay() + 6) % 7; // Mon=0
      const week = Math.floor((i + ((start.getDay() + 6) % 7)) / 7);
      
      cells.push({
        date: dateStr,
        displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        week,
        row: dayOfWeek,
        count: data[dateStr] || 0,
      });
    }
    return cells;
  }, [dates, data]);

  const maxWeek = useMemo(() => {
    if (!dayCells.length) return WEEKS;
    return Math.max(...dayCells.map(c => c.week)) + 1;
  }, [dayCells]);

  const getColorClass = (count) => {
    if (count === 0) return 'bg-neutral-800 border border-white/5';
    if (count >= 3) return 'bg-green-500';
    if (count >= 2) return 'bg-green-600'; 
    return 'bg-green-700'; 
  };

  const handleMouseEnter = (e, cell) => {
    const rect = e.target.getBoundingClientRect();
    const countText = cell.count === 0 ? 'No submissions' : `${cell.count} submission${cell.count > 1 ? 's' : ''}`;
    
    setTooltip({
      show: true,
      text: `${countText} on ${cell.displayDate}`,
      x: rect.left + rect.width / 2,
      y: rect.top - 8
    });
  };

  const totalContributions = useMemo(() => {
    return dayCells.reduce((sum, cell) => sum + cell.count, 0);
  }, [dayCells]);

  return (
    <div className="w-full" ref={containerRef}>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
            Activity Graph
          </h2>
          <p className="text-gray-400 text-sm mt-1">{totalContributions} submission{totalContributions !== 1 ? 's' : ''} in {year}</p>
        </div>
      </div>

      <div className="w-full flex justify-center overflow-hidden">
        <div 
          className="grid grid-flow-col"
          style={{ 
            gridTemplateColumns: `repeat(${maxWeek}, ${cellSizePx}px)`,
            gridTemplateRows: `repeat(7, ${cellSizePx}px)`,
            gap: `${GAP_PX}px`
          }}
        >
          {Array.from({ length: maxWeek }).map((_, col) =>
            Array.from({ length: 7 }).map((__, row) => {
              const cell = dayCells.find(c => c.week === col && c.row === row);
              if (!cell) return <div key={`${col}-${row}`} style={{ width: cellSizePx, height: cellSizePx }} />;
              
              return (
                <div
                  key={`${col}-${row}`}
                  onMouseEnter={(e) => handleMouseEnter(e, cell)}
                  onMouseLeave={() => setTooltip({ show: false, text: '', x: 0, y: 0 })}
                  className={`rounded-sm transition-transform hover:scale-110 cursor-pointer ${getColorClass(cell.count)}`}
                  style={{ width: `${cellSizePx}px`, height: `${cellSizePx}px` }}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-4 text-[10px] font-medium text-gray-500">
        <span>Less</span>
        <div className="w-[10px] h-[10px] rounded-sm bg-neutral-800" />
        <div className="w-[10px] h-[10px] rounded-sm bg-green-700" />
        <div className="w-[10px] h-[10px] rounded-sm bg-green-600" />
        <div className="w-[10px] h-[10px] rounded-sm bg-green-500" />
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
  );
}
