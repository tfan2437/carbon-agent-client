'use client';

import { useMemo } from 'react';
import { GHGGraphData, GHGNode, SourceType } from '@/lib/types';
import {
  activitiesUnderFacility,
  activitiesUnderSource,
  rollupMonthly,
  rollupMonthlyBySourceType,
} from '@/lib/aggregations';
import { MonthlyChart } from './monthly-chart';

interface Props {
  graph: GHGGraphData;
  node: GHGNode;
}

const SOURCE_TYPE_COLOR: Record<SourceType, string> = {
  fuel: '#F59E0B',
  electricity: '#3B82F6',
  refrigerant: '#06B6D4',
  work_hours: '#A78BFA',
};

export function MonthlyTab({ graph, node }: Props) {
  const year = graph.meta.primary_year ?? 2025;

  const stacked = useMemo(() => {
    let acts;
    if (node.type === 'company') {
      acts = graph.nodes.filter((n) => n.type === 'activity_data');
    } else if (node.type === 'facility') {
      acts = activitiesUnderFacility(graph, node.facility_id);
    } else if (node.type === 'emission_source') {
      acts = activitiesUnderSource(graph, node.id);
    } else {
      return [];
    }
    const byType = rollupMonthlyBySourceType(
      acts.filter((n) => n.type === 'activity_data'),
      year,
    );
    return (Object.keys(byType) as SourceType[]).map((k) => ({
      label: k,
      color: SOURCE_TYPE_COLOR[k] ?? '#6B7280',
      data: byType[k],
    }));
  }, [graph, node, year]);

  const total = useMemo(() => {
    if (node.type === 'company') return graph.nodes
      .filter((n) => n.type === 'activity_data')
      .map((a) => (a.year === year ? a.emissions_tco2e : 0))
      .reduce((s, v) => s + v, 0);
    let acts;
    if (node.type === 'facility') acts = activitiesUnderFacility(graph, node.facility_id);
    else if (node.type === 'emission_source') acts = activitiesUnderSource(graph, node.id);
    else return 0;
    return rollupMonthly(acts, year).reduce((s, v) => s + v, 0);
  }, [graph, node, year]);

  return (
    <div className="px-5 py-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm text-gray-200">{year} 年度月度排放</h3>
        <div className="text-xs text-gray-500">
          合計 <span className="text-white tabular-nums">{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span> tCO₂e
        </div>
      </div>
      <MonthlyChart stacked={stacked} unit="tCO₂e" height={200} />
      <p className="text-[10px] text-gray-500 mt-3">
        冷媒紀錄按 12 個月平均分配;電費橫跨 12 月與 1 月時 entry 已切分至各年度。
      </p>
    </div>
  );
}
