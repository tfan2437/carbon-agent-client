'use client';

import { useMemo } from 'react';
import {
  ActivityDataNode,
  EMISSION_TYPE_LABELS,
  GHGGraphData,
  GHGNode,
} from '@/lib/types';
import { activitiesUnderFacility, activitiesUnderSource } from '@/lib/aggregations';

interface Props {
  node: GHGNode;
  graph: GHGGraphData;
  activity: ActivityDataNode | null;
}

export function OverviewTab({ node, graph, activity }: Props) {
  if (activity) return <ActivityOverview activity={activity} graph={graph} />;
  switch (node.type) {
    case 'company':
      return <CompanyOverview node={node} graph={graph} />;
    case 'facility':
      return <FacilityOverview node={node} graph={graph} />;
    case 'emission_source':
      return <EmissionSourceOverview node={node} graph={graph} />;
    case 'source_document':
      return <DocumentOverview node={node} graph={graph} />;
    default:
      return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-baseline gap-3 py-1.5">
      <span className="text-xs text-gray-500 whitespace-nowrap">{label}</span>
      <span className="text-sm text-gray-200 text-right tabular-nums">{value}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-4 border-b border-white/5">
      <h3 className="text-[11px] uppercase tracking-wider text-gray-500 mb-2">{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function Big({ value, unit, sub }: { value: string; unit?: string; sub?: string }) {
  return (
    <div>
      <div className="text-3xl font-light text-white leading-tight tabular-nums">
        {value}
        {unit && <span className="text-base text-gray-400 ml-1.5">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

const fmt = (n: number, dp = 2) =>
  n.toLocaleString(undefined, { maximumFractionDigits: dp });

// ─── Company ────────────────────────────────────────────────────────

function CompanyOverview({ node, graph }: { node: Extract<GHGNode, { type: 'company' }>; graph: GHGGraphData }) {
  const meta = graph.meta;
  return (
    <>
      <Card title="總排放">
        <Big
          value={fmt(node.emissions_tco2e, 2)}
          unit="tCO₂e"
          sub={`${meta.years_covered.length} 個年度涵蓋 (主年度 ${meta.primary_year ?? '—'})`}
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ScopeRow label="Scope 1 直接排放" value={node.scope_1_tco2e} total={node.emissions_tco2e} color="amber" />
          <ScopeRow label="Scope 2 間接排放" value={node.scope_2_tco2e} total={node.emissions_tco2e} color="blue" />
        </div>
      </Card>

      <Card title="資料涵蓋">
        <Field label="場站數" value={meta.facility_count} />
        <Field label="排放源" value={meta.emission_source_count} />
        <Field label="活動紀錄" value={meta.record_count} />
        <Field label="原始檔案" value={meta.source_document_count} />
      </Card>

      <Card title="來源類型分布">
        {Object.entries(meta.source_type_counts).map(([k, v]) => (
          <Field key={k} label={k} value={`${v} 筆`} />
        ))}
      </Card>
    </>
  );
}

function ScopeRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: 'amber' | 'blue';
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  const ring = color === 'amber' ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-blue-500/15 border-blue-500/30 text-blue-300';
  return (
    <div className={`rounded-lg border ${ring} px-3 py-2`}>
      <div className="text-[10px] opacity-80">{label}</div>
      <div className="text-lg font-medium tabular-nums">{fmt(value, 2)}</div>
      <div className="text-[10px] opacity-70">{pct.toFixed(1)}% · tCO₂e</div>
    </div>
  );
}

// ─── Facility ───────────────────────────────────────────────────────

function FacilityOverview({ node, graph }: { node: Extract<GHGNode, { type: 'facility' }>; graph: GHGGraphData }) {
  const totalCompany = graph.meta.total_tco2e;
  const childActivities = useMemo(
    () => activitiesUnderFacility(graph, node.facility_id),
    [graph, node.facility_id],
  );
  const childSourceCount = useMemo(
    () => graph.nodes.filter((n) => n.type === 'emission_source' && n.facility_id === node.facility_id).length,
    [graph, node.facility_id],
  );
  const pct = totalCompany > 0 ? (node.emissions_tco2e / totalCompany) * 100 : 0;
  return (
    <>
      <Card title="場站排放">
        <Big value={fmt(node.emissions_tco2e, 2)} unit="tCO₂e" sub={`${pct.toFixed(1)}% 公司總排放`} />
      </Card>
      <Card title="場站資料">
        <Field label="場站代號" value={node.facility_id} />
        <Field label="排放源數" value={childSourceCount} />
        <Field label="活動紀錄" value={childActivities.length} />
      </Card>
    </>
  );
}

// ─── Emission Source ────────────────────────────────────────────────

function EmissionSourceOverview({
  node,
  graph,
}: {
  node: Extract<GHGNode, { type: 'emission_source' }>;
  graph: GHGGraphData;
}) {
  const total = graph.meta.total_tco2e;
  const pct = total > 0 ? (node.emissions_tco2e / total) * 100 : 0;
  return (
    <>
      <Card title="排放源排放">
        <Big value={fmt(node.emissions_tco2e, 4)} unit="tCO₂e" sub={`${pct.toFixed(2)}% 公司總排放`} />
      </Card>
      <Card title="分類">
        <Field label="來源代碼" value={`${node.source_code} · ${node.short_name}`} />
        <Field label="原料代碼" value={`${node.material_code} · ${node.material_name}`} />
        <Field label="所屬場站" value={node.facility_id} />
        <Field label="排放類別" value={EMISSION_TYPE_LABELS[node.emission_type].zh} />
        <Field
          label="範疇分類"
          value={node.scope_category === 'direct' ? '直接 (Scope 1)' : '間接 (Scope 2)'}
        />
        <Field label="是否生質燃料" value={node.is_biofuel ? '是' : '否'} />
        <Field label="活動紀錄數" value={node.record_count} />
      </Card>
    </>
  );
}

// ─── Source Document ────────────────────────────────────────────────

function DocumentOverview({
  node,
  graph,
}: {
  node: Extract<GHGNode, { type: 'source_document' }>;
  graph: GHGGraphData;
}) {
  void graph;
  return (
    <Card title="原始檔案">
      <Field label="檔名" value={<span className="font-mono text-[11px]">{node.source_file}</span>} />
      <Field label="類型" value={node.source_type} />
      <Field label="處理紀錄數" value={node.record_count} />
      <Field label="狀態" value={node.status} />
      {node.file_hash && (
        <Field
          label="檔案雜湊"
          value={<span className="font-mono text-[10px]">{node.file_hash.slice(0, 12)}…</span>}
        />
      )}
    </Card>
  );
}

// ─── Activity ────────────────────────────────────────────────────────

function ActivityOverview({ activity, graph }: { activity: ActivityDataNode; graph: GHGGraphData }) {
  const total = graph.meta.total_tco2e;
  const pct = total > 0 ? (activity.emissions_tco2e / total) * 100 : 0;
  // Sibling activities (cross-year electricity bills): same document_id
  const siblings = useMemo(
    () =>
      graph.nodes.filter(
        (n) =>
          n.type === 'activity_data' &&
          n.document_id === activity.document_id &&
          n.id !== activity.id,
      ),
    [graph, activity],
  );
  void activitiesUnderSource;
  return (
    <>
      <Card title="活動排放">
        <Big
          value={fmt(activity.emissions_tco2e, 4)}
          unit="tCO₂e"
          sub={`${pct.toFixed(3)}% 公司總排放 · ${activity.emissions_kgco2e.toLocaleString()} kgCO₂e`}
        />
      </Card>
      <Card title="活動數值">
        <Field label="期間" value={activity.period_label} />
        <Field
          label="活動量"
          value={`${activity.activity_value.toLocaleString()} ${activity.activity_unit}`}
        />
      </Card>
      <Card title="排放係數">
        <Field
          label="係數"
          value={`${activity.emission_factor.value} ${activity.emission_factor.unit}`}
        />
        <Field label="出處" value={<span className="text-[11px]">{activity.emission_factor.source}</span>} />
        <Field label="係數年度" value={activity.emission_factor.year} />
      </Card>
      {siblings.length > 0 && (
        <Card title="跨年度">
          <div className="text-xs text-gray-400 mb-2">
            此筆紀錄因計費期間跨越年度,已切分為 {siblings.length + 1} 筆 entry。
          </div>
          {siblings.map((s) => (
            <div key={s.id} className="text-xs text-gray-300">
              · {(s as ActivityDataNode).period_label}: {fmt((s as ActivityDataNode).emissions_tco2e, 4)} tCO₂e
            </div>
          ))}
        </Card>
      )}
      {activity.warnings && activity.warnings.length > 0 && (
        <Card title="警告">
          <ul className="text-xs text-amber-400 space-y-1">
            {activity.warnings.map((w, i) => (
              <li key={i}>· {w}</li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
