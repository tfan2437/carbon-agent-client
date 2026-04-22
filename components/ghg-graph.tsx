'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { useSearchParams } from 'next/navigation';
import {
  EMISSION_TYPE_LABELS,
  EmissionType,
  GHGGraphData,
  GHGNode,
  NODE_TYPE_LABELS,
  Scope,
  SourceType,
} from '@/lib/types';
import { DEFAULT_THEME, THEMES, THEME_ORDER, ThemeKey } from '@/lib/themes';
import AnalyticsPanel from '@/components/analytics-panel';

// Force-graph augments nodes with x/y during simulation; intersect with the
// discriminated union so per-type narrowing (activity_data etc.) still works.
type GraphNode = GHGNode & NodeObject;

interface GraphLink extends LinkObject {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

type TopologyMode = 'macro' | 'expanded';

// Macro mode renders only the structural backbone — activity / source_document
// nodes still live in `graph` and feed the analytics panel, but they are not
// painted on the canvas. With ~349 records the expanded view is unreadable.
const MACRO_TYPES: ReadonlySet<GHGNode['type']> = new Set([
  'company',
  'facility',
  'emission_source',
]);

const ALL_SOURCE_TYPES: SourceType[] = ['fuel', 'electricity', 'refrigerant', 'work_hours'];
const ALL_EMISSION_TYPES: EmissionType[] = [
  'mobile_combustion',
  'fugitive',
  'purchased_electricity',
  'process',
];

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  fuel: '燃料 Fuel',
  electricity: '電力 Electricity',
  refrigerant: '冷媒 Refrigerant',
  work_hours: '人時 Work Hours',
};

// source_document has no emissions field; everything else carries emissions_tco2e.
function nodeEmissions(node: GHGNode): number {
  return 'emissions_tco2e' in node ? node.emissions_tco2e : 0;
}

// Format numbers for display. Values are tCO₂e, which span ~0.0005 to ~57k in
// current data, so we keep 4dp for sub-1 values instead of collapsing to "0".
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  if (num > 0 && num < 1) return num.toFixed(4);
  if (num < 10) return num.toFixed(2);
  return num.toFixed(0);
}

// Calculate node size based on emissions (log scale). Macro mode uses
// a wider range since we have fewer nodes competing for screen real estate.
function getNodeSize(node: GraphNode, maxEmissions: number, mode: TopologyMode): number {
  const emissions = nodeEmissions(node);
  const [minSize, maxSize] = mode === 'macro' ? [10, 38] : [4, 24];
  // Anchor the company node a bit larger so it's always visually dominant.
  if (node.type === 'company') return mode === 'macro' ? maxSize : 24;
  if (emissions === 0 || maxEmissions === 0) return minSize;
  const logEmissions = Math.log10(emissions + 1);
  const logMax = Math.log10(maxEmissions + 1);
  return minSize + (logEmissions / logMax) * (maxSize - minSize);
}

export default function GHGGraph() {
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  // Selection state — graph node click sets `selectedNode`; analytics-panel
  // record drill-down sets `selectedActivityId` (kept as id-string so we can
  // pin the row across panel re-renders).
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);

  // Graph payload fetched from /mock-data/graph.json at runtime.
  const [graph, setGraph] = useState<GHGGraphData | null>(null);
  const [graphError, setGraphError] = useState<Error | null>(null);

  // Filters
  const [selectedYear] = useState(2025);
  const [scopeFilter, setScopeFilter] = useState<{ scope1: boolean; scope2: boolean }>({ scope1: true, scope2: true });
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<Set<SourceType>>(
    () => new Set(ALL_SOURCE_TYPES),
  );
  const [emissionTypeFilter, setEmissionTypeFilter] = useState<Set<EmissionType>>(
    () => new Set(ALL_EMISSION_TYPES),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [topologyMode, setTopologyMode] = useState<TopologyMode>('macro');
  const [themeKey, setThemeKey] = useState<ThemeKey>(DEFAULT_THEME);
  const theme = THEMES[themeKey];

  // PII gate — unmask toggle is only available when the URL carries `?pii=1`.
  const searchParams = useSearchParams();
  const piiUnlocked = searchParams?.get('pii') === '1';

  useEffect(() => {
    let cancelled = false;
    fetch('/mock-data/graph.json')
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load graph.json: ${r.status} ${r.statusText}`);
        return r.json() as Promise<GHGGraphData>;
      })
      .then((data) => { if (!cancelled) setGraph(data); })
      .catch((err: Error) => { if (!cancelled) setGraphError(err); });
    return () => { cancelled = true; };
  }, []);

  // Hard fail — no silent fallback to static data (per CLAUDE.md conventions).
  if (graphError) throw graphError;

  // Stats pulled from meta (top-level summary, already computed by build_graph.py).
  const stats = useMemo(() => ({
    scope1: graph?.meta.scope_1_tco2e ?? 0,
    scope2: graph?.meta.scope_2_tco2e ?? 0,
    total: graph?.meta.total_tco2e ?? 0,
  }), [graph]);

  const facilities = useMemo(
    () => graph?.nodes.filter((n) => n.type === 'facility') ?? [],
    [graph]
  );

  const maxEmissions = useMemo(() => {
    if (!graph) return 0;
    return Math.max(0, ...graph.nodes.map(nodeEmissions));
  }, [graph]);

  // Build neighbor map for hover highlighting
  const neighborMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!graph) return map;
    graph.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      if (!map.has(sourceId)) map.set(sourceId, new Set());
      if (!map.has(targetId)) map.set(targetId, new Set());
      map.get(sourceId)!.add(targetId);
      map.get(targetId)!.add(sourceId);
    });
    return map;
  }, [graph]);

  // Filter graph data
  const graphData: GraphData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    let nodes = graph.nodes as GraphNode[];
    let links = graph.links as GraphLink[];

    // Topology mode — macro hides activity/source_document layers (~520 nodes
    // reduce to ~32). Lower layers are still in `graph` for the side panel.
    if (topologyMode === 'macro') {
      nodes = nodes.filter((n) => MACRO_TYPES.has(n.type));
    }

    // Filter by source_type — applies to emission_source nodes (whose
    // children's source_type drives source_type_counts), and indirectly
    // dims facilities that lose all their sources.
    if (sourceTypeFilter.size < ALL_SOURCE_TYPES.length) {
      const allowedEsKeys = new Set<string>();
      // An emission_source is "kept" if any of its child activities matches.
      // We pre-compute this from the full graph to honor the filter even in
      // macro mode (where activities aren't in `nodes`).
      for (const a of graph.nodes) {
        if (a.type !== 'activity_data') continue;
        if (sourceTypeFilter.has(a.source_type)) {
          allowedEsKeys.add(`es-${a.facility_id}-${a.source_code}-${a.material_code}`);
        }
      }
      nodes = nodes.filter((n) =>
        n.type !== 'emission_source' || allowedEsKeys.has(n.id),
      );
    }

    // Filter by emission_type
    if (emissionTypeFilter.size < ALL_EMISSION_TYPES.length) {
      nodes = nodes.filter(
        (n) => n.type !== 'emission_source' || emissionTypeFilter.has(n.emission_type),
      );
    }

    // Filter by scope
    if (!scopeFilter.scope1 || !scopeFilter.scope2) {
      const allowedScopes: (Scope)[] = [];
      if (scopeFilter.scope1) allowedScopes.push(1);
      if (scopeFilter.scope2) allowedScopes.push(2);
      allowedScopes.push(null); // Always show structural nodes

      nodes = nodes.filter(n => allowedScopes.includes(n.scope));
    }

    // Filter by facilities
    if (selectedFacilities.length > 0) {
      const relevantNodeIds = new Set<string>();

      // Add company
      nodes.filter(n => n.type === 'company').forEach(n => relevantNodeIds.add(n.id));

      // Add selected facilities and their descendants
      const addDescendants = (nodeId: string) => {
        relevantNodeIds.add(nodeId);
        links.forEach(link => {
          const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
          const targetId = typeof link.target === 'string' ? link.target : link.target.id;
          if (sourceId === nodeId && !relevantNodeIds.has(targetId)) {
            addDescendants(targetId);
          }
        });
      };

      selectedFacilities.forEach(addDescendants);
      nodes = nodes.filter(n => relevantNodeIds.has(n.id));
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchingIds = new Set(
        nodes
          .filter(n => n.name.toLowerCase().includes(query))
          .map(n => n.id)
      );

      // Also include connected nodes
      const extendedIds = new Set(matchingIds);
      matchingIds.forEach(id => {
        neighborMap.get(id)?.forEach(neighborId => extendedIds.add(neighborId));
      });

      nodes = nodes.filter(n => extendedIds.has(n.id));
    }

    // Filter links to only include existing nodes
    const nodeIds = new Set(nodes.map(n => n.id));
    links = links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    return { nodes, links };
  }, [graph, topologyMode, sourceTypeFilter, emissionTypeFilter, scopeFilter, selectedFacilities, searchQuery, neighborMap]);

  // Handle resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Check if node should be highlighted
  const isHighlighted = useCallback((nodeId: string): boolean => {
    if (!hoveredNode) return true;
    if (hoveredNode.id === nodeId) return true;
    return neighborMap.get(hoveredNode.id)?.has(nodeId) || false;
  }, [hoveredNode, neighborMap]);

  // Custom node rendering
  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = getNodeSize(node, maxEmissions, topologyMode);
    const color = theme.colorFor(node as GHGNode);
    const highlighted = isHighlighted(node.id);
    // Dual-selection: the parent ES is the breadcrumb anchor (selectedNode)
    // and the activity is the drilled-in focus (selectedActivityId). Both
    // get the same selection outline so the user sees the full drill path.
    const isSelected =
      selectedNode?.id === node.id ||
      (selectedActivityId != null && selectedActivityId === node.id);

    // Opacity based on hover state
    const opacity = hoveredNode ? (highlighted ? 1 : 0.15) : 1;

    // Draw glow/halo for highlighted nodes
    if (highlighted && (hoveredNode || isSelected)) {
      const gradient = ctx.createRadialGradient(node.x!, node.y!, size * 0.5, node.x!, node.y!, size * 2);
      gradient.addColorStop(0, `${color}40`);
      gradient.addColorStop(1, `${color}00`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, size * 2, 0, 2 * Math.PI);
      ctx.fill();
    }

    // Draw node circle
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
    ctx.fill();

    // Selection ring — both the anchor ES and the drilled-in activity get the
    // same solid white outline.
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Draw label — always visible for company/facility in macro mode (few enough
    // nodes that legibility wins). emission_source labels appear when zoomed.
    const alwaysLabeled = topologyMode === 'macro' && (node.type === 'company' || node.type === 'facility');
    const showLabel = alwaysLabeled || globalScale > 1.2 || (hoveredNode && highlighted);
    if (showLabel) {
      const fontSize = Math.max((node.type === 'company' ? 14 : 11) / globalScale, 3);
      ctx.font = `${fontSize}px 'Geist', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = `rgba(229, 231, 235, ${opacity})`;
      ctx.fillText(node.name, node.x!, node.y! + size + 4 / globalScale);
    }

    ctx.globalAlpha = 1;
  }, [maxEmissions, topologyMode, isHighlighted, hoveredNode, selectedNode, selectedActivityId, theme]);

  // Custom link rendering
  const paintLink = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const source = link.source as GraphNode;
    const target = link.target as GraphNode;
    if (!source.x || !source.y || !target.x || !target.y) return;

    const sourceHighlighted = isHighlighted(source.id);
    const targetHighlighted = isHighlighted(target.id);
    const highlighted = sourceHighlighted && targetHighlighted;
    // The link that joins the selected ES anchor to its drilled-in activity
    // gets emphasized so the drill path reads at a glance.
    const isDrillEdge =
      selectedActivityId != null &&
      selectedNode != null &&
      ((source.id === selectedNode.id && target.id === selectedActivityId) ||
        (target.id === selectedNode.id && source.id === selectedActivityId));
    const opacity = hoveredNode ? (highlighted ? 0.4 : 0.05) : isDrillEdge ? 0.9 : 0.25;

    ctx.strokeStyle = isDrillEdge
      ? `rgba(255, 255, 255, ${opacity})`
      : `rgba(107, 114, 128, ${opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  }, [isHighlighted, hoveredNode, selectedNode, selectedActivityId]);

  // Focus on a specific node — used by analytics-panel "jump to facility" actions.
  const focusOnNode = useCallback((node: GraphNode) => {
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      fgRef.current.centerAt(node.x, node.y, 500);
      fgRef.current.zoom(2.5, 500);
    }
  }, []);
  void focusOnNode;

  // Reset view
  const resetView = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 80);
    }
  }, []);

  // Initial fit — re-run when graph loads so zoomToFit sees real nodes.
  useEffect(() => {
    if (!graph) return;
    const timer = setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 80);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [graph]);

  if (!graph) {
    return (
      <div ref={containerRef} className="w-full h-screen flex items-center justify-center" style={{ backgroundColor: '#0B0E14' }}>
        <div className="text-gray-400 text-sm">Loading graph data…</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-screen overflow-hidden" style={{ backgroundColor: '#0B0E14' }}>
      {/* Force Graph Canvas */}
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0B0E14"
        nodeCanvasObject={paintNode}
        linkCanvasObject={paintLink}
        nodePointerAreaPaint={(node, color, ctx) => {
          const size = getNodeSize(node as GraphNode, maxEmissions, topologyMode);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, size + 4, 0, 2 * Math.PI);
          ctx.fill();
        }}
        onNodeHover={(node) => setHoveredNode(node as GraphNode | null)}
        onNodeClick={(node) => {
          const n = node as GraphNode;
          // Activity nodes (visible in 詳細 view) route through the same
          // drilled-in flow as the records-table click: select the parent
          // emission_source as the panel anchor and set the activity id so
          // the panel renders its full tab set (概覽 / 明細 / 氣體 / 原始檔案).
          if (n.type === 'activity_data') {
            const parentEs = graph?.nodes.find(
              (m) =>
                m.type === 'emission_source' &&
                m.id === `es-${n.facility_id}-${n.source_code}-${n.material_code}`,
            );
            setSelectedNode(parentEs ?? n);
            setSelectedActivityId(n.id);
            return;
          }
          setSelectedNode(n);
          setSelectedActivityId(null);
        }}
        onBackgroundClick={() => {
          setSelectedNode(null);
          setSelectedActivityId(null);
        }}
        onZoom={({ k }) => { zoomRef.current = k; }}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={100}
        cooldownTicks={200}
        linkDirectionalParticles={0}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />

      {/* Hover Tooltip */}
      {hoveredNode && !selectedNode && (
        <div
          className="absolute pointer-events-none z-50"
          style={{
            left: '50%',
            bottom: 80,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="bg-[#1a1d24]/90 backdrop-blur-md border border-white/10 rounded-lg px-4 py-3 shadow-xl">
            <div className="text-white font-medium text-sm">{hoveredNode.name}</div>
            <div className="flex items-center gap-3 mt-2">
              {(() => {
                const c = theme.colorFor(hoveredNode as GHGNode);
                return (
                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: c + '30', color: c }}>
                    {NODE_TYPE_LABELS[hoveredNode.type].en}
                  </span>
                );
              })()}
              {hoveredNode.scope && (
                <span className={`text-xs px-2 py-0.5 rounded ${hoveredNode.scope === 1 ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  Scope {hoveredNode.scope}
                </span>
              )}
              {nodeEmissions(hoveredNode) > 0 && (
                <span className="text-gray-300 text-xs">
                  {formatNumber(nodeEmissions(hoveredNode))} tCO₂e
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filter Panel - Top Left */}
      <div className={`absolute top-4 left-4 z-40 transition-all duration-300 ${filterPanelOpen ? 'w-72' : 'w-10'}`}>
        <div className="bg-[#1a1d24]/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
          {/* Panel Header */}
          <button
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-white hover:bg-white/5 transition-colors"
          >
            <span className={`font-medium text-sm ${!filterPanelOpen ? 'hidden' : ''}`}>Filters</span>
            <svg className={`w-4 h-4 transition-transform ${filterPanelOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {filterPanelOpen && (
            <div className="px-4 pb-4 space-y-4">
              {/* Search */}
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider">Search</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search nodes..."
                  className="mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-white/30"
                />
              </div>

              {/* Year + Topology */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-gray-400 text-xs uppercase tracking-wider">Year</label>
                  <button className="mt-1 w-full bg-white/10 text-white text-sm py-2 rounded-lg border border-white/20">
                    {selectedYear}
                  </button>
                </div>
                <div className="flex-1">
                  <label className="text-gray-400 text-xs uppercase tracking-wider">View</label>
                  <button
                    onClick={() => setTopologyMode((m) => (m === 'macro' ? 'expanded' : 'macro'))}
                    className="mt-1 w-full bg-white/5 hover:bg-white/10 text-white text-sm py-2 rounded-lg border border-white/10 transition-colors"
                    title={topologyMode === 'macro' ? '展開所有節點 (~700)' : '回到精簡視圖 (~32 nodes)'}
                  >
                    {topologyMode === 'macro' ? '精簡' : '展開'}
                  </button>
                </div>
              </div>

              {/* Theme picker */}
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider">Theme</label>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {THEME_ORDER.map((key) => {
                    const t = THEMES[key];
                    const active = themeKey === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setThemeKey(key)}
                        title={`${t.englishName} — ${t.description}`}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border ${active ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-gray-500 border-white/5 hover:text-gray-300'}`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scope Toggles */}
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider">Scopes</label>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setScopeFilter(f => ({ ...f, scope1: !f.scope1 }))}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${scopeFilter.scope1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-white/5 text-gray-500 border border-white/10'}`}
                  >
                    Scope 1
                  </button>
                  <button
                    onClick={() => setScopeFilter(f => ({ ...f, scope2: !f.scope2 }))}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${scopeFilter.scope2 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40' : 'bg-white/5 text-gray-500 border border-white/10'}`}
                  >
                    Scope 2
                  </button>
                </div>
              </div>

              {/* Facilities */}
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider">Facilities</label>
                <div className="mt-2 space-y-1">
                  {facilities.map(facility => (
                    <button
                      key={facility.id}
                      onClick={() => {
                        setSelectedFacilities(prev =>
                          prev.includes(facility.id)
                            ? prev.filter(id => id !== facility.id)
                            : [...prev, facility.id]
                        );
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedFacilities.includes(facility.id) ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                    >
                      {facility.name}
                    </button>
                  ))}
                  {selectedFacilities.length > 0 && (
                    <button
                      onClick={() => setSelectedFacilities([])}
                      className="w-full text-center text-xs text-gray-500 hover:text-gray-400 mt-2"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
              </div>

              {/* Source Type */}
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider">Source Type</label>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {ALL_SOURCE_TYPES.map((st) => {
                    const active = sourceTypeFilter.has(st);
                    return (
                      <button
                        key={st}
                        onClick={() => {
                          setSourceTypeFilter((prev) => {
                            const next = new Set(prev);
                            if (next.has(st)) next.delete(st);
                            else next.add(st);
                            return next;
                          });
                        }}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border ${active ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-gray-500 border-white/5'}`}
                      >
                        {SOURCE_TYPE_LABELS[st]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Emission Type */}
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider">Emission Type</label>
                <div className="mt-2 grid grid-cols-2 gap-1.5">
                  {ALL_EMISSION_TYPES.map((et) => {
                    const active = emissionTypeFilter.has(et);
                    return (
                      <button
                        key={et}
                        onClick={() => {
                          setEmissionTypeFilter((prev) => {
                            const next = new Set(prev);
                            if (next.has(et)) next.delete(et);
                            else next.add(et);
                            return next;
                          });
                        }}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border ${active ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-gray-500 border-white/5'}`}
                      >
                        {EMISSION_TYPE_LABELS[et].zh}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Stats Strip — sticky */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-3">
        <div className="bg-[#1a1d24]/85 backdrop-blur-md border border-white/10 rounded-xl px-5 py-3 flex items-center gap-6">
          <div>
            <div className="text-gray-400 text-[10px] uppercase tracking-wider">Total Emissions ({selectedYear})</div>
            <div className="text-white text-xl font-semibold leading-tight">
              {formatNumber(stats.total)} <span className="text-xs text-gray-400">tCO₂e</span>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-gray-400">Scope 1</span>
              <span className="text-white tabular-nums">{formatNumber(stats.scope1)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-gray-400">Scope 2</span>
              <span className="text-white tabular-nums">{formatNumber(stats.scope2)}</span>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex gap-4 text-xs">
            <Stat label="場站" value={graph.meta.facility_count} />
            <Stat label="排放源" value={graph.meta.emission_source_count} />
            <Stat label="活動紀錄" value={graph.meta.record_count} />
            <Stat label="原始檔案" value={graph.meta.source_document_count} />
          </div>
        </div>
      </div>

      {/* Analytics Panel — slides in from right when a node is selected */}
      <AnalyticsPanel
        graph={graph}
        selectedNode={selectedNode}
        selectedActivityId={selectedActivityId}
        piiUnlocked={piiUnlocked}
        theme={theme}
        onSelectNode={(n) => { setSelectedNode(n); setSelectedActivityId(null); }}
        onSelectActivity={setSelectedActivityId}
        onClose={() => { setSelectedNode(null); setSelectedActivityId(null); }}
      />


      {/* Zoom Controls - Bottom Right */}
      <div className="absolute bottom-4 right-4 z-40">
        <div className="bg-[#1a1d24]/80 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden flex flex-col">
          <button
            onClick={() => fgRef.current?.zoom(zoomRef.current * 1.5, 300)}
            className="px-4 py-3 text-white hover:bg-white/10 transition-colors border-b border-white/10"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
            </svg>
          </button>
          <button
            onClick={() => fgRef.current?.zoom(zoomRef.current / 1.5, 300)}
            className="px-4 py-3 text-white hover:bg-white/10 transition-colors border-b border-white/10"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
            </svg>
          </button>
          <button
            onClick={resetView}
            className="px-4 py-3 text-white hover:bg-white/10 transition-colors"
            title="Reset view"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Legend - Bottom Left */}
      <div className="absolute bottom-4 left-4 z-40">
        <div className="bg-[#1a1d24]/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-500 text-[10px] uppercase tracking-wider">{theme.englishName}</span>
            {theme.legend.map((entry) => (
              <div key={entry.label} className="flex items-center gap-2" title={entry.hint}>
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-300">{entry.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-gray-400 text-[10px] uppercase tracking-wider">{label}</span>
      <span className="text-white tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}
