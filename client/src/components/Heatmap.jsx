import { useLayoutEffect, useRef, useState, useMemo } from "react";

export default function Heatmap({ data = {}, year = new Date().getFullYear() }) {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });

  const H_PADDING = 48; // p-6 on both sides
  const GAP_PX = 4;
  const MIN_CELL = 9;
  const MAX_CELL = 16;
  const WEEKS = 53;

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current;
    const measure = () => {
      const nextWidth = Math.floor(el.getBoundingClientRect().width || el.clientWidth || window.innerWidth || 0);
      if (nextWidth > 0) {
        setContainerWidth(nextWidth);
      }
    };

    measure();

    const rafId = window.requestAnimationFrame(measure);
    const timeoutId = window.setTimeout(measure, 80);
    window.addEventListener('resize', measure);

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(el);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, []);

  const { cellSizePx, gapPx } = useMemo(() => {
    const isCompactScreen = containerWidth > 0 && containerWidth < 640;
    const horizontalPadding = isCompactScreen ? 0 : H_PADDING;
    const gapPx = isCompactScreen ? 3 : GAP_PX;
    const minCell = isCompactScreen ? 6 : MIN_CELL;
    const maxCell = isCompactScreen ? 12 : MAX_CELL;
    const available = Math.max(0, containerWidth - horizontalPadding);
    const totalGaps = (WEEKS - 1) * gapPx;
    const raw = Math.floor((available - totalGaps) / WEEKS);
    const clamped = Math.max(minCell, Math.min(maxCell, raw || minCell));
    return { cellSizePx: clamped, gapPx };
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

  // Fast lookup for rendering, so we don't .find() per cell.
  const cellByKey = useMemo(() => {
    const map = new Map();
    dayCells.forEach(c => map.set(`${c.week}-${c.row}`, c));
    return map;
  }, [dayCells]);

  const maxWeek = useMemo(() => {
    if (!dayCells.length) return WEEKS;
    return Math.max(...dayCells.map(c => c.week)) + 1;
  }, [dayCells]);

  // Month labels placed above the column where each month begins.
  const monthLabels = useMemo(() => {
    const earliest = new Map();
    dayCells.forEach(c => {
      const cur = earliest.get(c.week);
      if (!cur || c.date < cur) earliest.set(c.week, c.date);
    });
    const labels = [];
    let lastMonth = -1;
    let lastLabeledWeek = -10;
    for (let w = 0; w < maxWeek; w++) {
      const d = earliest.get(w);
      if (!d) continue;
      const dateObj = new Date(`${d}T00:00:00`);
      const month = dateObj.getMonth();
      if (month !== lastMonth && w - lastLabeledWeek >= 2) {
        labels.push({ week: w, label: dateObj.toLocaleDateString('en-US', { month: 'short' }) });
        lastMonth = month;
        lastLabeledWeek = w;
      } else if (month !== lastMonth) {
        lastMonth = month;
      }
    }
    return labels;
  }, [dayCells, maxWeek]);

  const getColorClass = (count) => {
    if (count === 0) return 'bg-white/[0.04]';
    if (count >= 4) return 'bg-emerald-400';
    if (count === 3) return 'bg-emerald-500';
    if (count === 2) return 'bg-emerald-600';
    return 'bg-emerald-800';
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

  const gridColumns = `repeat(${maxWeek}, ${cellSizePx}px)`;

  return (
    <div className="w-full" ref={containerRef}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-400">
          <span className="font-semibold text-white tabular-nums">{totalContributions}</span> submission{totalContributions !== 1 ? 's' : ''} in {year}
        </p>
      </div>

      <div className="w-full overflow-x-auto pb-2">
        <div className="inline-block min-w-max">
          {/* Month labels */}
          <div
            className="grid mb-1.5 text-[10px] font-medium text-gray-500"
            style={{ gridTemplateColumns: gridColumns, gap: `${gapPx}px` }}
          >
            {monthLabels.map((m) => (
              <span key={`${m.week}-${m.label}`} style={{ gridColumnStart: m.week + 1 }} className="whitespace-nowrap">
                {m.label}
              </span>
            ))}
          </div>

          {/* Cells */}
          <div
            className="grid grid-flow-col"
            style={{
              gridTemplateColumns: gridColumns,
              gridTemplateRows: `repeat(7, ${cellSizePx}px)`,
              gap: `${gapPx}px`
            }}
          >
            {Array.from({ length: maxWeek }).map((_, col) =>
              Array.from({ length: 7 }).map((__, row) => {
                const cell = cellByKey.get(`${col}-${row}`);
                if (!cell) return <div key={`${col}-${row}`} style={{ width: cellSizePx, height: cellSizePx }} />;

                return (
                  <div
                    key={`${col}-${row}`}
                    onMouseEnter={(e) => handleMouseEnter(e, cell)}
                    onMouseLeave={() => setTooltip({ show: false, text: '', x: 0, y: 0 })}
                    className={`rounded-[3px] transition-all duration-150 hover:ring-2 hover:ring-emerald-300/40 cursor-pointer ${getColorClass(cell.count)}`}
                    style={{ width: `${cellSizePx}px`, height: `${cellSizePx}px` }}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-4 text-[10px] font-medium text-gray-500">
        <span>Less</span>
        <div className="w-[11px] h-[11px] rounded-[3px] bg-white/[0.04]" />
        <div className="w-[11px] h-[11px] rounded-[3px] bg-emerald-800" />
        <div className="w-[11px] h-[11px] rounded-[3px] bg-emerald-600" />
        <div className="w-[11px] h-[11px] rounded-[3px] bg-emerald-500" />
        <div className="w-[11px] h-[11px] rounded-[3px] bg-emerald-400" />
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
