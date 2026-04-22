'use client';

import { useMemo } from 'react';
import { ActivityDataNode, GasEmission, GHGGraphData, GHGNode } from '@/lib/types';
import { activitiesUnderSource, sumGasBreakdown } from '@/lib/aggregations';

interface Props {
  graph: GHGGraphData;
  node: GHGNode | null;
  activity: ActivityDataNode | null;
}

const GAS_COLOR: Record<string, string> = {
  CO2: '#A3A3A3',
  CH4: '#10B981',
  N2O: '#F59E0B',
  HFCs: '#3B82F6',
  PFCs: '#8B5CF6',
  SF6: '#EC4899',
  NF3: '#F97316',
};

export function GasBreakdownTab({ graph, node, activity }: Props) {
  const gases = useMemo<GasEmission[]>(() => {
    if (activity) return activity.gas_breakdown ?? [];
    if (node?.type === 'emission_source') {
      const acts = activitiesUnderSource(graph, node.id);
      return sumGasBreakdown(acts);
    }
    return [];
  }, [graph, node, activity]);

  const total = useMemo(
    () => gases.reduce((s, g) => s + g.emission_tco2e, 0),
    [gases],
  );

  if (gases.length === 0) {
    return <div className="px-5 py-8 text-center text-sm text-gray-500">無氣體拆解資料</div>;
  }

  return (
    <div className="px-2 py-3">
      <table className="w-full text-sm">
        <thead className="border-b border-white/5">
          <tr>
            <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 text-left">氣體</th>
            <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 text-right">GWP</th>
            <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 text-right">排放 (kg)</th>
            <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 text-right">CO₂e (tonnes)</th>
            <th className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {gases.map((g) => {
            const pct = total > 0 ? (g.emission_tco2e / total) * 100 : 0;
            return (
              <tr key={g.gas} className="border-b border-white/5">
                <td className="px-3 py-2">
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium"
                    style={{
                      backgroundColor: `${GAS_COLOR[g.gas] ?? '#6B7280'}25`,
                      color: GAS_COLOR[g.gas] ?? '#9CA3AF',
                    }}
                  >
                    {g.gas}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-gray-300 tabular-nums text-xs">{g.gwp}</td>
                <td className="px-3 py-2 text-right text-gray-300 tabular-nums text-xs">
                  {g.emission_kg.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </td>
                <td className="px-3 py-2 text-right text-gray-200 tabular-nums text-xs">
                  {g.emission_tco2e.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </td>
                <td className="px-3 py-2 text-right text-gray-500 tabular-nums text-xs">
                  {pct.toFixed(1)}%
                </td>
              </tr>
            );
          })}
          <tr className="bg-white/5">
            <td className="px-3 py-2 text-xs text-gray-300 font-medium">總計</td>
            <td />
            <td />
            <td className="px-3 py-2 text-right text-white tabular-nums text-xs font-medium">
              {total.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </td>
            <td className="px-3 py-2 text-right text-gray-500 tabular-nums text-xs">100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
