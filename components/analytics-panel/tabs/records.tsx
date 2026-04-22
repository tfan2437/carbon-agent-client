'use client';

import { useMemo, useState } from 'react';
import { ActivityDataNode, GHGGraphData } from '@/lib/types';
import { activitiesUnderSource } from '@/lib/aggregations';
import { SortHeader } from './sort-header';

interface Props {
  graph: GHGGraphData;
  emissionSourceId: string;
  onSelectActivity: (id: string | null) => void;
}

type SortKey = 'period' | 'value' | 'tco2e' | 'status';

const STATUS_BADGE: Record<string, string> = {
  success: 'bg-emerald-500/15 text-emerald-300',
  partial: 'bg-amber-500/15 text-amber-300',
  failed: 'bg-rose-500/15 text-rose-300',
  duplicate: 'bg-gray-500/15 text-gray-300',
};

export function RecordsTab({ graph, emissionSourceId, onSelectActivity }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('period');
  const [asc, setAsc] = useState(true);

  const acts = useMemo(
    () => activitiesUnderSource(graph, emissionSourceId),
    [graph, emissionSourceId],
  );

  const sorted = useMemo(() => {
    const copy = [...acts];
    copy.sort((a, b) => {
      const sign = asc ? 1 : -1;
      switch (sortKey) {
        case 'period':
          return sign * a.period_start.localeCompare(b.period_start);
        case 'value':
          return sign * (a.activity_value - b.activity_value);
        case 'tco2e':
          return sign * (a.emissions_tco2e - b.emissions_tco2e);
        case 'status':
          return sign * a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
    return copy;
  }, [acts, sortKey, asc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setAsc((v) => !v);
    else {
      setSortKey(k);
      setAsc(k === 'period');
    }
  };

  if (acts.length === 0) {
    return <div className="px-5 py-8 text-center text-sm text-gray-500">無活動紀錄</div>;
  }

  return (
    <div className="px-2 py-3">
      <table className="w-full text-sm">
        <thead className="border-b border-white/5 sticky top-0 bg-[#0F1218]">
          <tr>
            <SortHeader active={sortKey === 'period'} asc={asc} onClick={() => toggle('period')}>期間</SortHeader>
            <SortHeader active={sortKey === 'value'} asc={asc} onClick={() => toggle('value')} align="right">活動量</SortHeader>
            <SortHeader active={sortKey === 'tco2e'} asc={asc} onClick={() => toggle('tco2e')} align="right">tCO₂e</SortHeader>
            <SortHeader active={sortKey === 'status'} asc={asc} onClick={() => toggle('status')} align="right">狀態</SortHeader>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a: ActivityDataNode) => (
            <tr
              key={a.id}
              onClick={() => onSelectActivity(a.id)}
              className="cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
            >
              <td className="px-3 py-2 text-gray-200 text-xs">
                <div>{a.period_label}</div>
                <div className="text-[10px] text-gray-500 font-mono truncate max-w-[180px]">{a.source_file}</div>
              </td>
              <td className="px-3 py-2 text-right text-gray-300 tabular-nums text-xs whitespace-nowrap">
                {a.activity_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                <div className="text-[10px] text-gray-500">{a.activity_unit}</div>
              </td>
              <td className="px-3 py-2 text-right text-gray-200 tabular-nums text-xs">
                {a.emissions_tco2e.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </td>
              <td className="px-3 py-2 text-right">
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_BADGE[a.status] ?? 'bg-white/10 text-gray-300'}`}>
                  {a.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-3 py-2 text-[10px] text-gray-500">
        共 {sorted.length} 筆 · 點選可下鑽至明細
      </div>
    </div>
  );
}
