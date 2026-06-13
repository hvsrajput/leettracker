import { useHeatmap } from '@/features/dashboard/hooks/useHeatmap';

const Heatmap = ({ data = {}, year = new Date().getFullYear() }) => {
  const {
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
  } = useHeatmap({ data, year });

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
                    onMouseEnter={(e) => showTooltip(e, cell)}
                    onMouseLeave={hideTooltip}
                    className={`rounded-[3px] transition-colors duration-150 hover:ring-2 hover:ring-emerald-300/40 cursor-pointer ${getColorClass(cell.count)}`}
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
};

export default Heatmap;
