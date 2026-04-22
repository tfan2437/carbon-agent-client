'use client';

import { useMemo, useState } from 'react';
import { EMISSION_TYPE_LABELS, GHGGraphData, GHGNode } from '@/lib/types';
import { SortHeader } from './sort-header';

interface Props {
  graph: GHGGraphData;
  facilityId: string;
  onJump: (node: GHGNode) => void;
}

type SortKey = 'name' | 'records' | 'tco2e';

const TYPE_GLYPH = {
  mobile_combustion: '🚌',
  fugitive: '❄',
  purchased_electricity: '⚡',
  process: '🏭',
};

export function SourcesTab({ graph, facilityId, onJump }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('tco2e');
  const [asc, setAsc] = useState(false);

  const facility = graph.nodes.find(
    (n) => n.type === 'facility' && n.facility_id === facilityId,
  );
  const facilityTotal =
    facility && facility.type === 'facility' ? facility.emissions_tco2e : 0;

  const rows = useMemo(() => {
    return graph.nodes
      .filter((n) => n.type === 'emission_source' && n.facility_id === facilityId)
      .map((s) => {
        const es = s as Extract<GHGNode, { type: 'emission_source' }>;
        return {
          node: es,
          name: es.name,
          short_name: es.short_name,
          material_name: es.material_name,
          emission_type: es.emission_type,
          scope: es.scope,
          records: es.record_count,
          tco2e: es.emissions_tco2e,
          pct: facilityTotal > 0 ? (es.emissions_tco2e / facilityTotal) * 100 : 0,
        };
      });
  }, [graph, facilityId, facilityTotal]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = sortKey === 'name' ? a.name : (a as Record<string, unknown>)[sortKey] as number;
      const bv = sortKey === 'name' ? b.name : (b as Record<string, unknown>)[sortKey] as number;
      const sign = asc ? 1 : -1;
      if (typeof av === 'string') return sign * av.localeCompare(bv as string);
      return sign * ((av as number) - (bv as number));
    });
    return copy;
  }, [rows, sortKey, asc]);

  const toggle = (k: SortKey) => {
    if (k === sortKey) setAsc((v) => !v);
    else {
      setSortKey(k);
      setAsc(k === 'name');
    }
  };

  return (
    <div className="px-2 py-3">
      <table className="w-full text-sm">
        <thead className="border-b border-white/5">
          <tr>
            <SortHeader active={sortKey === 'name'} asc={asc} onClick={() => toggle('name')}>排放源</SortHeader>
            <SortHeader active={sortKey === 'records'} asc={asc} onClick={() => toggle('records')} align="right">紀錄</SortHeader>
            <SortHeader active={sortKey === 'tco2e'} asc={asc} onClick={() => toggle('tco2e')} align="right">tCO₂e</SortHeader>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={r.node.id}
              onClick={() => onJump(r.node)}
              className="cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
            >
              <td className="px-3 py-2.5 text-gray-200">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base flex-shrink-0">{TYPE_GLYPH[r.emission_type]}</span>
                  <span className="truncate">{r.short_name}</span>
                  <span className="text-gray-500 text-xs truncate">· {r.material_name}</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  {EMISSION_TYPE_LABELS[r.emission_type].zh}
                  {r.scope && <span className={`ml-2 ${r.scope === 1 ? 'text-amber-400' : 'text-blue-400'}`}>Scope {r.scope}</span>}
                </div>
              </td>
              <td className="px-3 py-2.5 text-right text-gray-300 tabular-nums">{r.records}</td>
              <td className="px-3 py-2.5 text-right text-gray-200 tabular-nums">
                <div>{r.tco2e.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                <div className="text-[10px] text-gray-500">{r.pct.toFixed(1)}%</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
