'use client';

// Lightweight inline 12-bar chart. Recharts is not used here on purpose —
// the panel is fixed-width (480px) and we want zero new dependencies for
// the core layout. Optional stacking by named series.

import { useMemo } from 'react';

const MONTH_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export interface MonthlyChartProps {
  /** Single series — rendered as solid bars. */
  data?: number[];
  /** Stacked series — keys are series labels, values are 12-element arrays.
   *  Order = stacking order from bottom to top. */
  stacked?: { label: string; color: string; data: number[] }[];
  /** Y-axis unit label, e.g. "tCO₂e". */
  unit?: string;
  /** Tooltip labels per month, used as the title row. Defaults to "1月..12月". */
  monthLabels?: string[];
  /** Height in pixels. Default 160. */
  height?: number;
}

export function MonthlyChart({
  data,
  stacked,
  unit = 'tCO₂e',
  monthLabels = MONTH_LABELS,
  height = 160,
}: MonthlyChartProps) {
  const monthly = useMemo(() => {
    if (stacked) {
      return Array.from({ length: 12 }, (_, i) =>
        stacked.reduce((s, ser) => s + Number(ser.data[i] ?? 0), 0),
      );
    }
    return data ?? Array(12).fill(0);
  }, [data, stacked]);

  const max = useMemo(() => Math.max(0.0001, ...monthly), [monthly]);

  return (
    <div className="flex flex-col">
      <div
        className="flex items-end gap-1 px-1"
        style={{ height }}
      >
        {Array.from({ length: 12 }, (_, i) => {
          const v = monthly[i] ?? 0;
          const totalH = (v / max) * (height - 24);
          const tooltip = `${monthLabels[i]}月 · ${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${unit}`;
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end" title={tooltip}>
              <div
                className="w-full rounded-t-sm overflow-hidden flex flex-col-reverse"
                style={{ height: Math.max(totalH, v > 0 ? 1 : 0) }}
              >
                {stacked
                  ? stacked.map((ser) => {
                      const sv = Number(ser.data[i] ?? 0);
                      const sh = (sv / max) * (height - 24);
                      if (sh <= 0) return null;
                      return (
                        <div
                          key={ser.label}
                          style={{ height: sh, backgroundColor: ser.color }}
                        />
                      );
                    })
                  : <div style={{ height: '100%', backgroundColor: '#3B82F6' }} />}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">{monthLabels[i]}</div>
            </div>
          );
        })}
      </div>
      {stacked && (
        <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-gray-400">
          {stacked.map((s) => (
            <span key={s.label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
