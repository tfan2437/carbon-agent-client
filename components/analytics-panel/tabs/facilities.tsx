'use client';

import { useMemo, useState } from 'react';
import { GHGGraphData, GHGNode } from '@/lib/types';
import { activitiesUnderFacility } from '@/lib/aggregations';
import { SortHeader } from './sort-header';

interface Props {
  graph: GHGGraphData;
  onJump: (node: GHGNode) => void;
}

type SortKey = 'name' | 'sources' | 'records' | 'tco2e';

export function FacilitiesTab({ graph, onJump }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('tco2e');
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const facs = graph.nodes.filter((n) => n.type === 'facility');
    const total = graph.meta.total_tco2e;
    return facs.map((f) => {
      if (f.type !== 'facility') return null!;
      const acts = activitiesUnderFacility(graph, f.facility_id);
      const sources = graph.nodes.filter(
        (n) => n.type === 'emission_source' && n.facility_id === f.facility_id,
      );
      return {
        node: f,
        name: f.name,
        sources: sources.length,
        records: acts.length,
        tco2e: f.emissions_tco2e,
        pct: total > 0 ? (f.emissions_tco2e / total) * 100 : 0,
      };
    });
  }, [graph]);

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
      setAsc(k === 'name'); // default: name asc, numbers desc
    }
  };

  return (
    <div className="px-2 py-3">
      <table className="w-full text-sm">
        <thead className="border-b border-white/5">
          <tr>
            <SortHeader active={sortKey === 'name'} asc={asc} onClick={() => toggle('name')}>場站</SortHeader>
            <SortHeader active={sortKey === 'sources'} asc={asc} onClick={() => toggle('sources')} align="right">排放源</SortHeader>
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
                <div className="truncate">{r.name}</div>
                <div className="text-[10px] text-gray-500">{(r.node as Extract<GHGNode, { type: 'facility' }>).facility_id}</div>
              </td>
              <td className="px-3 py-2.5 text-right text-gray-300 tabular-nums">{r.sources}</td>
              <td className="px-3 py-2.5 text-right text-gray-300 tabular-nums">{r.records}</td>
              <td className="px-3 py-2.5 text-right text-gray-200 tabular-nums">
                <div>{r.tco2e.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                <div className="text-[10px] text-gray-500">{r.pct.toFixed(1)}%</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
