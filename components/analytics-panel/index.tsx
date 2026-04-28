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
import { Icon } from '@/components/engram/Primitives';
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

  const scopePill = (scope: 1 | 2) => {
    const isOne = scope === 1;
    return {
      fontSize: 11,
      fontWeight: 500,
      padding: '2px 7px',
      borderRadius: 9999,
      border: isOne
        ? '1px solid var(--scope-1-line)'
        : '1px solid var(--scope-2-line)',
      background: isOne ? 'var(--scope-1-soft)' : 'var(--scope-2-soft)',
      color: isOne ? 'var(--scope-1)' : 'var(--scope-2)',
    } as const;
  };

  return (
    <PiiContext.Provider value={{ unlocked: piiUnlocked, unmasked: piiUnmasked }}>
      <aside
        style={{
          position: 'absolute',
          top: 16,
          bottom: 16,
          right: 16,
          width: 480,
          zIndex: 60,
          background: 'rgba(20, 16, 14, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid var(--border-2)',
          borderRadius: 'var(--r-lg)',
          boxShadow:
            '0 1px 0 0 rgba(0,0,0,0.05), 0 12px 32px -8px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 18px 0',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {breadcrumb && (
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--fg-4)',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {graph.meta.company_name}
                  {breadcrumb.facility && (
                    <>
                      {' · '}
                      <span style={{ color: 'var(--fg-3)' }}>
                        {breadcrumb.facility.name}
                      </span>
                    </>
                  )}
                  {breadcrumb.es && (
                    <>
                      {' · '}
                      <span style={{ color: 'var(--fg-3)' }}>
                        {breadcrumb.es.name}
                      </span>
                    </>
                  )}
                  {' · '}
                  <span style={{ color: 'var(--fg)' }}>
                    {selectedActivity?.period_label}
                  </span>
                </div>
              )}
              <h2
                className="serif"
                style={{
                  fontSize: 16,
                  color: 'var(--fg)',
                  margin: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {breadcrumb && selectedActivity
                  ? selectedActivity.name
                  : headerNode.name}
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '2px 7px',
                    borderRadius: 9999,
                    border: `1px solid ${color}40`,
                    background: `${color}1f`,
                    color,
                  }}
                >
                  {typeLabel.zh} · {typeLabel.en}
                </span>
                {selectedActivity && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '2px 7px',
                      borderRadius: 9999,
                      border: '1px solid var(--border-2)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--fg-3)',
                    }}
                  >
                    {selectedActivity.source_type}
                  </span>
                )}
                {headerNode.type === 'emission_source' && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '2px 7px',
                      borderRadius: 9999,
                      border: '1px solid var(--border-2)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--fg-3)',
                    }}
                  >
                    {EMISSION_TYPE_LABELS[headerNode.emission_type].zh}
                  </span>
                )}
                {(headerNode.scope === 1 || headerNode.scope === 2) && (
                  <span style={scopePill(headerNode.scope)}>
                    Scope {headerNode.scope}
                  </span>
                )}
                {emissions !== null && emissions > 0 && (
                  <span
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      color: 'var(--fg-3)',
                      marginLeft: 2,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {emissions.toLocaleString(undefined, {
                      maximumFractionDigits: 4,
                    })}{' '}
                    tCO₂e
                  </span>
                )}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
              }}
            >
              <PiiToggle unmasked={piiUnmasked} onChange={setPiiUnmasked} />
              <button
                type="button"
                onClick={onClose}
                title="關閉 (Esc)"
                aria-label="Close"
                className="btn btn-ghost btn-icon"
              >
                <Icon name="x" size={14} color="var(--fg-3)" />
              </button>
            </div>
          </div>

          {/* Tab strip — flush with header bottom border, underline-active */}
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              marginLeft: -18,
              marginRight: -18,
              paddingLeft: 18,
              paddingRight: 18,
            }}
          >
            {tabs.map((t) => {
              const active = activeTab === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTab(t)}
                  role="tab"
                  aria-selected={active}
                  style={{
                    padding: '8px 12px',
                    border: 0,
                    borderBottom: active
                      ? '2px solid var(--primary)'
                      : '2px solid transparent',
                    marginBottom: -1,
                    background: 'transparent',
                    color: active ? 'var(--fg)' : 'var(--fg-3)',
                    fontSize: 12.5,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    letterSpacing: '-0.005em',
                    cursor: 'pointer',
                    transition: 'color 150ms ease-out',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.color = 'var(--fg-2)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.color = 'var(--fg-3)';
                  }}
                >
                  {TAB_LABELS[t]}
                </button>
              );
            })}
            {selectedActivity && (
              <button
                type="button"
                onClick={() => onSelectActivity(null)}
                title="返回上層"
                style={{
                  marginLeft: 'auto',
                  marginBottom: -1,
                  alignSelf: 'center',
                  border: 0,
                  background: 'transparent',
                  color: 'var(--fg-4)',
                  fontSize: 11,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  padding: '6px 8px',
                  transition: 'color 150ms ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--fg-2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--fg-4)';
                }}
              >
                ← 返回排放源
              </button>
            )}
          </div>
        </div>

        {/* Tab body */}
        <div
          className="scroll"
          style={{ flex: 1, overflowY: 'auto' }}
        >
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
