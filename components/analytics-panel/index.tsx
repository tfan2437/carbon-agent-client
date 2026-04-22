'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityDataNode,
  EMISSION_TYPE_LABELS,
  GHGGraphData,
  GHGNode,
  NODE_TYPE_LABELS,
} from '@/lib/types';
import type { Theme } from '@/lib/themes';
import { PiiContext } from './pii-context';
import { PiiToggle } from './pii-toggle';
import { OverviewTab } from './tabs/overview';
import { FacilitiesTab } from './tabs/facilities';
import { SourcesTab } from './tabs/sources';
import { RecordsTab } from './tabs/records';
import { MonthlyTab } from './tabs/monthly';
import { GasBreakdownTab } from './tabs/gas-breakdown';
import { DetailTab } from './tabs/detail';
import { EvidenceTab } from './tabs/evidence';

interface Props {
  graph: GHGGraphData;
  selectedNode: GHGNode | null;
  selectedActivityId: string | null;
  piiUnlocked: boolean;
  theme: Theme;
  onSelectNode: (node: GHGNode) => void;
  onSelectActivity: (id: string | null) => void;
  onClose: () => void;
}

type TabKey =
  | 'overview'
  | 'facilities'
  | 'sources'
  | 'records'
  | 'monthly'
  | 'gas'
  | 'detail'
  | 'evidence';

const TAB_LABELS: Record<TabKey, string> = {
  overview: '概覽',
  facilities: '場站',
  sources: '排放源',
  records: '紀錄',
  monthly: '月度',
  gas: '氣體',
  detail: '明細',
  evidence: '原始檔案',
};

export default function AnalyticsPanel({
  graph,
  selectedNode,
  selectedActivityId,
  piiUnlocked,
  theme,
  onSelectNode,
  onSelectActivity,
  onClose,
}: Props) {
  // Derive default tab from current selection; user clicks override via tabState.
  // When the selection key changes, the override is discarded automatically.
  const selectionKey = `${selectedNode?.id ?? ''}|${selectedActivityId ?? ''}`;
  const defaultTab: TabKey = selectedActivityId ? 'detail' : 'overview';
  const [tabState, setTabState] = useState<{ key: string; tab: TabKey }>({
    key: selectionKey,
    tab: defaultTab,
  });
  const activeTab: TabKey = tabState.key === selectionKey ? tabState.tab : defaultTab;
  const setActiveTab = (t: TabKey) => setTabState({ key: selectionKey, tab: t });
  const [piiUnmasked, setPiiUnmasked] = useState(false);

  // Esc closes the panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (selectedNode || selectedActivityId) {
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [selectedNode, selectedActivityId, onClose]);

  const selectedActivity = useMemo<ActivityDataNode | null>(() => {
    if (!selectedActivityId) return null;
    const n = graph.nodes.find((n) => n.id === selectedActivityId);
    return n && n.type === 'activity_data' ? n : null;
  }, [graph, selectedActivityId]);

  // Tab set depends on the selected node type. Activity drill-down adds Detail.
  const tabs = useMemo<TabKey[]>(() => {
    if (selectedActivity) return ['overview', 'detail', 'gas', 'evidence'];
    if (!selectedNode) return [];
    switch (selectedNode.type) {
      case 'company':
        return ['overview', 'facilities', 'monthly'];
      case 'facility':
        return ['overview', 'sources', 'monthly'];
      case 'emission_source':
        return ['overview', 'records', 'monthly', 'gas'];
      case 'source_document':
        return ['overview', 'evidence'];
      default:
        return ['overview'];
    }
  }, [selectedNode, selectedActivity]);

  // Breadcrumb when an activity is drilled in
  const breadcrumb = useMemo(() => {
    if (!selectedActivity) return null;
    const facility = graph.nodes.find(
      (n) => n.type === 'facility' && n.facility_id === selectedActivity.facility_id,
    );
    const es = graph.nodes.find(
      (n) =>
        n.type === 'emission_source' &&
        n.id === `es-${selectedActivity.facility_id}-${selectedActivity.source_code}-${selectedActivity.material_code}`,
    );
    return { facility, es };
  }, [graph, selectedActivity]);

  if (!selectedNode && !selectedActivity) return null;

  // Header node — when an activity is drilled in we still show the parent's
  // emission_source as the panel "title"; the breadcrumb names the activity.
  const headerNode: GHGNode = breadcrumb?.es ?? selectedNode ?? selectedActivity!;
  const color = theme.colorFor(headerNode);
  const typeLabel = NODE_TYPE_LABELS[headerNode.type];
  const emissions =
    'emissions_tco2e' in headerNode ? headerNode.emissions_tco2e : null;

  return (
    <PiiContext.Provider value={{ unlocked: piiUnlocked, unmasked: piiUnmasked }}>
      <aside className="absolute top-4 bottom-4 right-4 z-40 w-[480px] bg-[#0F1218]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {breadcrumb && (
                <div className="text-[11px] text-gray-500 mb-1 truncate">
                  {graph.meta.company_name}
                  {breadcrumb.facility && <> · <span className="text-gray-400">{breadcrumb.facility.name}</span></>}
                  {breadcrumb.es && <> · <span className="text-gray-400">{breadcrumb.es.name}</span></>}
                  {' · '}
                  <span className="text-white">{selectedActivity?.period_label}</span>
                </div>
              )}
              <h2 className="text-white font-semibold text-base truncate">
                {breadcrumb && selectedActivity ? selectedActivity.name : headerNode.name}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                  style={{ backgroundColor: `${color}30`, color }}
                >
                  {typeLabel.zh} · {typeLabel.en}
                </span>
                {selectedActivity && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300">
                    {selectedActivity.source_type}
                  </span>
                )}
                {headerNode.type === 'emission_source' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300">
                    {EMISSION_TYPE_LABELS[headerNode.emission_type].zh}
                  </span>
                )}
                {(headerNode.scope === 1 || headerNode.scope === 2) && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      headerNode.scope === 1
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}
                  >
                    Scope {headerNode.scope}
                  </span>
                )}
                {emissions !== null && emissions > 0 && (
                  <span className="text-[11px] text-gray-400 ml-1">
                    {emissions.toLocaleString(undefined, { maximumFractionDigits: 4 })} tCO₂e
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PiiToggle unmasked={piiUnmasked} onChange={setPiiUnmasked} />
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1"
                title="關閉 (Esc)"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tab strip */}
          <div className="mt-3 flex gap-1 border-b border-white/5 -mx-5 px-5">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={[
                  'px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                  activeTab === t
                    ? 'border-white text-white'
                    : 'border-transparent text-gray-400 hover:text-gray-200',
                ].join(' ')}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
            {selectedActivity && (
              <button
                onClick={() => onSelectActivity(null)}
                className="ml-auto self-center text-[11px] text-gray-500 hover:text-gray-300"
                title="返回上層"
              >
                ← 返回排放源
              </button>
            )}
          </div>
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && (
            <OverviewTab
              node={selectedActivity ?? selectedNode!}
              graph={graph}
              activity={selectedActivity}
            />
          )}
          {activeTab === 'facilities' && selectedNode?.type === 'company' && (
            <FacilitiesTab graph={graph} onJump={onSelectNode} />
          )}
          {activeTab === 'sources' && selectedNode?.type === 'facility' && (
            <SourcesTab graph={graph} facilityId={selectedNode.facility_id} onJump={onSelectNode} />
          )}
          {activeTab === 'records' && selectedNode?.type === 'emission_source' && (
            <RecordsTab
              graph={graph}
              emissionSourceId={selectedNode.id}
              onSelectActivity={onSelectActivity}
            />
          )}
          {activeTab === 'monthly' && (
            <MonthlyTab graph={graph} node={selectedNode!} />
          )}
          {activeTab === 'gas' && (
            <GasBreakdownTab graph={graph} node={selectedNode} activity={selectedActivity} />
          )}
          {activeTab === 'detail' && selectedActivity && (
            <DetailTab activity={selectedActivity} graph={graph} />
          )}
          {activeTab === 'evidence' && (
            <EvidenceTab activity={selectedActivity} node={selectedNode} graph={graph} />
          )}
        </div>
      </aside>
    </PiiContext.Provider>
  );
}
