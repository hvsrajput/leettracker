import { useLayoutEffect, useRef, useState, useMemo, useCallback } from 'react';

// Layout constants for the contribution grid.
const H_PADDING = 48; // p-6 on both sides
const GAP_PX = 4;
const MIN_CELL = 9;
const MAX_CELL = 16;
const WEEKS = 53;

const getColorClass = (count) => {
  if (count === 0) return 'bg-white/[0.04]';
  if (count >= 4) return 'bg-emerald-400';
  if (count === 3) return 'bg-emerald-500';
  if (count === 2) return 'bg-emerald-600';
  return 'bg-emerald-800';
};

// Owns everything the Heatmap renders: responsive cell sizing (measured from the
// container), the 365-day grid derived from `data`/`year`, month labels, totals,
// and tooltip state. The Heatmap component only renders what this returns.
export const useHeatmap = ({ data = {}, year = new Date().getFullYear() }) => {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState({ show: false, text: '', x: 0, y: 0 });

  // Measure the container so cells scale to the available width.
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
    const gap = isCompactScreen ? 3 : GAP_PX;
    const minCell = isCompactScreen ? 6 : MIN_CELL;
    const maxCell = isCompactScreen ? 12 : MAX_CELL;
    const available = Math.max(0, containerWidth - horizontalPadding);
    const totalGaps = (WEEKS - 1) * gap;
    const raw = Math.floor((available - totalGaps) / WEEKS);
    const clamped = Math.max(minCell, Math.min(maxCell, raw || minCell));
    return { cellSizePx: clamped, gapPx: gap };
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

  const totalContributions = useMemo(() => {
    return dayCells.reduce((sum, cell) => sum + cell.count, 0);
  }, [dayCells]);

  const showTooltip = useCallback((e, cell) => {
    const rect = e.target.getBoundingClientRect();
    const countText = cell.count === 0 ? 'No submissions' : `${cell.count} submission${cell.count > 1 ? 's' : ''}`;

    setTooltip({
      show: true,
      text: `${countText} on ${cell.displayDate}`,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltip({ show: false, text: '', x: 0, y: 0 });
  }, []);

  const gridColumns = `repeat(${maxWeek}, ${cellSizePx}px)`;

  return {
    containerRef,
    cellSizePx,
    gapPx,
    maxWeek,
    monthLabels,
    cellByKey,
    totalContributions,
    gridColumns,
    getColorClass,
    tooltip,
    showTooltip,
    hideTooltip,
  };
};
