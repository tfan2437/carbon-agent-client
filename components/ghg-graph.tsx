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
import { Shell, PageHeader } from '@/components/engram/Shell';
import { Icon } from '@/components/engram/Primitives';

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
  fuel: '燃料',
  electricity: '電力',
  refrigerant: '冷媒',
  work_hours: '人時',
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

export interface GHGGraphProps {
  initialData?: GHGGraphData;
  // Page-header breadcrumbs. Caller is responsible for shape — strings
  // and/or <Link className="crumb-link"> children.
  crumbs: React.ReactNode[];
  // Optional right-aligned actions in the page header (e.g. company · year).
  headerActions?: React.ReactNode;
  // Optional canvas overlay rendered inside the relative chrome container,
  // on top of the force graph. Used by the project view to mount the
  // graph-history rail.
  extraOverlay?: React.ReactNode;
  // When non-null, only nodes whose ids are in this set paint at full
  // opacity; everything else dims via the existing hover/dim primitive
  // (opacity 0.15 nodes / 0.05 links). Used by the version selector to
  // surface what changed in this commit vs. its parent. Hover, when
  // active, takes precedence over diff dimming.
  diffHighlightSet?: Set<string> | null;
}

export default function GHGGraph({
  initialData,
  crumbs,
  headerActions,
  extraOverlay,
  diffHighlightSet,
}: GHGGraphProps) {
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

  // Graph payload always supplied by the caller now — both /projects/[id]/graph
  // (via GraphViewClient + Supabase) and /demo (via the page-level fetch) hand
  // the data in as initialData. Kept as state because filter changes in the
  // future may want to update it.
  const [graph] = useState<GHGGraphData | null>(initialData ?? null);

  // Filters
  const [scopeFilter, setScopeFilter] = useState<{ scope1: boolean; scope2: boolean }>({ scope1: true, scope2: true });
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [sourceTypeFilter, setSourceTypeFilter] = useState<Set<SourceType>>(
    () => new Set(ALL_SOURCE_TYPES),
  );
  const [emissionTypeFilter, setEmissionTypeFilter] = useState<Set<EmissionType>>(
    () => new Set(ALL_EMISSION_TYPES),
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [topologyMode, setTopologyMode] = useState<TopologyMode>('expanded');
  const [themeKey, setThemeKey] = useState<ThemeKey>(DEFAULT_THEME);
  const theme = THEMES[themeKey];

  // PII gate — unmask toggle is only available when the URL carries `?pii=1`.
  const searchParams = useSearchParams();
  const piiUnlocked = searchParams?.get('pii') === '1';

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

  // Check if node should be highlighted. Hover takes precedence; absent
  // hover, a non-null diffHighlightSet restricts highlight to the diff.
  const isHighlighted = useCallback((nodeId: string): boolean => {
    if (hoveredNode) {
      if (hoveredNode.id === nodeId) return true;
      return neighborMap.get(hoveredNode.id)?.has(nodeId) || false;
    }
    if (diffHighlightSet) return diffHighlightSet.has(nodeId);
    return true;
  }, [hoveredNode, neighborMap, diffHighlightSet]);

  // Custom node rendering
  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // Force-graph may invoke paint before the sim has placed a node,
    // or for orphans in data with missing/bad links. Skip until it has
    // finite coordinates — otherwise canvas APIs throw.
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    const size = getNodeSize(node, maxEmissions, topologyMode);
    const color = theme.colorFor(node as GHGNode);
    const highlighted = isHighlighted(node.id);
    // Dual-selection: the parent ES is the breadcrumb anchor (selectedNode)
    // and the activity is the drilled-in focus (selectedActivityId). Both
    // get the same selection outline so the user sees the full drill path.
    const isSelected =
      selectedNode?.id === node.id ||
      (selectedActivityId != null && selectedActivityId === node.id);

    // Opacity based on hover OR active diff (both dim non-highlighted).
    const dimMode = hoveredNode != null || diffHighlightSet != null;
    const opacity = dimMode ? (highlighted ? 1 : 0.15) : 1;

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
  }, [maxEmissions, topologyMode, isHighlighted, hoveredNode, selectedNode, selectedActivityId, theme, diffHighlightSet]);

  // Custom link rendering
  const paintLink = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const source = link.source as GraphNode;
    const target = link.target as GraphNode;
    if (
      !Number.isFinite(source.x) ||
      !Number.isFinite(source.y) ||
      !Number.isFinite(target.x) ||
      !Number.isFinite(target.y)
    ) {
      return;
    }

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
    const dimMode = hoveredNode != null || diffHighlightSet != null;
    const opacity = dimMode
      ? (highlighted ? 0.4 : 0.05)
      : isDrillEdge ? 0.9 : 0.25;

    ctx.strokeStyle = isDrillEdge
      ? `rgba(255, 255, 255, ${opacity})`
      : `rgba(107, 114, 128, ${opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  }, [isHighlighted, hoveredNode, selectedNode, selectedActivityId, diffHighlightSet]);

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
  // For tiny graphs (single facility / single source) zoomToFit zooms in
  // 6–15× to "fit" the small bounding box, so a maxSize=38 canvas-unit
  // node + its hover halo ends up filling 50%+ of the viewport. Clamp only
  // the unreasonably-high case (zoom > 3) — medium / large graphs naturally
  // fit at 0.5–3× and should keep their auto-fit zoom so they fill the view.
  useEffect(() => {
    if (!graph) return;
    const timer = setTimeout(() => {
      const fg = fgRef.current;
      if (!fg) return;
      fg.zoomToFit(400, 80);
      const checkTimer = setTimeout(() => {
        const fg2 = fgRef.current;
        if (!fg2) return;
        const k = fg2.zoom();
        const MAX_INITIAL_ZOOM = 3;
        if (k > MAX_INITIAL_ZOOM) fg2.zoom(MAX_INITIAL_ZOOM, 300);
      }, 450);
      return () => clearTimeout(checkTimer);
    }, 500);
    return () => clearTimeout(timer);
  }, [graph]);

  // Background canvas color must match the .lc surface so the force-graph's
  // own clear-rect paints onto a token-driven color, not a hardcoded hex.
  const canvasBg = '#131211';

  // Loading state — same chrome as the resolved view so the page doesn't jump.
  if (!graph) {
    return (
      <Shell hideSidebar>
        <PageHeader crumbs={crumbs} actions={headerActions} />
        <div
          ref={containerRef}
          style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--fg-3)',
            fontSize: 13,
          }}
        >
          Loading graph data…
        </div>
      </Shell>
    );
  }

  // Floating-overlay panel chrome shared across the four corner widgets and
  // the hover tooltip. Mirrors the project's `.card` recipe but slightly
  // more opaque + backdrop-blurred since these float over a busy canvas.
  const overlayPanelStyle: React.CSSProperties = {
    background: 'rgba(20, 16, 14, 0.78)',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    border: '1px solid var(--border-2)',
    borderRadius: 'var(--r-lg)',
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--fg-4)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    display: 'block',
    marginBottom: 6,
  };

  const segmentBtnStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    height: 30,
    padding: '0 8px',
    border: `1px solid ${active ? 'var(--primary-line)' : 'var(--border-2)'}`,
    background: active ? 'var(--primary-soft)' : 'rgba(255,255,255,0.02)',
    color: active ? 'var(--primary)' : 'var(--fg-2)',
    borderRadius: 'var(--r-sm)',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'inherit',
    letterSpacing: '-0.005em',
    cursor: 'pointer',
    transition:
      'background 180ms ease-out, border-color 180ms ease-out, color 180ms ease-out',
  });

  // Visual chrome — canvas + 4 floating overlays + hover tooltip + analytics
  // panel. Wrapped in a relative container so absolutely-positioned widgets
  // resolve against the canvas, not the viewport.
  const chrome = (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor={canvasBg}
        nodeCanvasObject={paintNode}
        linkCanvasObject={paintLink}
        nodePointerAreaPaint={(node, color, ctx) => {
          if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
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
        onZoom={({ k }) => {
          zoomRef.current = k;
        }}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        warmupTicks={100}
        cooldownTicks={200}
        linkDirectionalParticles={0}
        enableNodeDrag={true}
        enableZoomInteraction={true}
        enablePanInteraction={true}
      />

      {/* Hover Tooltip — center-bottom of canvas, never covers selection */}
      {hoveredNode && !selectedNode && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 80,
            transform: 'translateX(-50%)',
            zIndex: 50,
            pointerEvents: 'none',
            ...overlayPanelStyle,
            padding: '12px 14px',
            minWidth: 220,
            maxWidth: 360,
          }}
        >
          <div
            style={{
              color: 'var(--fg)',
              fontWeight: 500,
              fontSize: 13.5,
              letterSpacing: '-0.005em',
            }}
          >
            {hoveredNode.name}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
              flexWrap: 'wrap',
            }}
          >
            {(() => {
              const c = theme.colorFor(hoveredNode as GHGNode);
              return (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '2px 7px',
                    borderRadius: 'var(--r-pill)',
                    border: `1px solid ${c}40`,
                    background: `${c}1f`,
                    color: c,
                  }}
                >
                  {NODE_TYPE_LABELS[hoveredNode.type].en}
                </span>
              );
            })()}
            {hoveredNode.scope && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '2px 7px',
                  borderRadius: 'var(--r-pill)',
                  border:
                    hoveredNode.scope === 1
                      ? '1px solid var(--scope-1-line)'
                      : '1px solid var(--scope-2-line)',
                  background:
                    hoveredNode.scope === 1
                      ? 'var(--scope-1-soft)'
                      : 'var(--scope-2-soft)',
                  color:
                    hoveredNode.scope === 1
                      ? 'var(--scope-1)'
                      : 'var(--scope-2)',
                }}
              >
                Scope {hoveredNode.scope}
              </span>
            )}
            {nodeEmissions(hoveredNode) > 0 && (
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  color: 'var(--fg-3)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatNumber(nodeEmissions(hoveredNode))} tCO₂e
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filter Panel — top-left */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 40,
          width: filterPanelOpen ? 280 : 100,
          transition: 'width 240ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div style={{ ...overlayPanelStyle, overflow: 'hidden' }}>
          <button
            type="button"
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              height: 38,
              padding: '0 12px',
              background: 'transparent',
              border: 0,
              color: 'var(--fg-2)',
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              letterSpacing: '-0.005em',
              cursor: 'pointer',
              transition: 'background 150ms ease-out, color 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'var(--fg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--fg-2)';
            }}
            aria-expanded={filterPanelOpen}
            title={filterPanelOpen ? 'Collapse filters' : 'Open filters'}
          >
            <span>Filters</span>
            <span
              style={{
                display: 'inline-flex',
                transform: filterPanelOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: 'transform 240ms cubic-bezier(0.32, 0.72, 0, 1)',
              }}
            >
              <Icon name="chevronLeft" size={14} color="var(--fg-3)" />
            </span>
          </button>

          {filterPanelOpen && (
            <div
              className="scroll"
              style={{
                padding: '4px 14px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                maxHeight: 'calc(100vh - 140px)',
                overflowY: 'auto',
                animation:
                  'wv-panel-in 220ms cubic-bezier(0.32, 0.72, 0, 1) 60ms both',
              }}
            >
              {/* Search */}
              <div>
                <label htmlFor="graph-search" style={sectionLabelStyle}>
                  Search
                </label>
                <input
                  id="graph-search"
                  className="input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search nodes…"
                  style={{ height: 32, fontSize: 13 }}
                />
              </div>

              {/* Topology */}
              <div>
                <span style={sectionLabelStyle}>View</span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 6,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setTopologyMode('macro')}
                    style={segmentBtnStyle(topologyMode === 'macro')}
                    title="精簡視圖 (~32 nodes)"
                  >
                    精簡
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopologyMode('expanded')}
                    style={segmentBtnStyle(topologyMode === 'expanded')}
                    title="展開所有節點 (~700)"
                  >
                    展開
                  </button>
                </div>
              </div>

              {/* Theme picker */}
              <div>
                <span style={sectionLabelStyle}>Theme</span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 6,
                  }}
                >
                  {THEME_ORDER.map((key) => {
                    const t = THEMES[key];
                    const active = themeKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setThemeKey(key)}
                        title={`${t.englishName} — ${t.description}`}
                        style={segmentBtnStyle(active)}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scope Toggles */}
              <div>
                <span style={sectionLabelStyle}>Scopes</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() =>
                      setScopeFilter((f) => ({ ...f, scope1: !f.scope1 }))
                    }
                    style={segmentBtnStyle(scopeFilter.scope1)}
                    aria-pressed={scopeFilter.scope1}
                  >
                    Scope 1
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setScopeFilter((f) => ({ ...f, scope2: !f.scope2 }))
                    }
                    style={segmentBtnStyle(scopeFilter.scope2)}
                    aria-pressed={scopeFilter.scope2}
                  >
                    Scope 2
                  </button>
                </div>
              </div>

              {/* Facilities */}
              <div>
                <span style={sectionLabelStyle}>Facilities</span>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {facilities.map((facility) => {
                    const active = selectedFacilities.includes(facility.id);
                    return (
                      <button
                        key={facility.id}
                        type="button"
                        onClick={() => {
                          setSelectedFacilities((prev) =>
                            prev.includes(facility.id)
                              ? prev.filter((id) => id !== facility.id)
                              : [...prev, facility.id],
                          );
                        }}
                        className={'nav-item' + (active ? ' active' : '')}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          height: 28,
                          padding: '0 10px',
                          border: 0,
                          background: active
                            ? 'rgba(255,255,255,0.06)'
                            : 'transparent',
                          color: active ? 'var(--fg)' : 'var(--fg-3)',
                          fontFamily: 'inherit',
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          borderRadius: 'var(--r-sm)',
                          letterSpacing: '-0.005em',
                          transition:
                            'background 150ms ease-out, color 150ms ease-out',
                        }}
                      >
                        {facility.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source Type */}
              <div>
                <span style={sectionLabelStyle}>Source Type</span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 6,
                  }}
                >
                  {ALL_SOURCE_TYPES.map((st) => {
                    const active = sourceTypeFilter.has(st);
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setSourceTypeFilter((prev) => {
                            const next = new Set(prev);
                            if (next.has(st)) next.delete(st);
                            else next.add(st);
                            return next;
                          });
                        }}
                        style={segmentBtnStyle(active)}
                      >
                        {SOURCE_TYPE_LABELS[st]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Emission Type */}
              <div>
                <span style={sectionLabelStyle}>Emission Type</span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 6,
                  }}
                >
                  {ALL_EMISSION_TYPES.map((et) => {
                    const active = emissionTypeFilter.has(et);
                    return (
                      <button
                        key={et}
                        type="button"
                        onClick={() => {
                          setEmissionTypeFilter((prev) => {
                            const next = new Set(prev);
                            if (next.has(et)) next.delete(et);
                            else next.add(et);
                            return next;
                          });
                        }}
                        style={segmentBtnStyle(active)}
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

      {/* Top Stats Strip — top-right */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 40,
        }}
      >
        <div
          style={{
            ...overlayPanelStyle,
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 22,
          }}
        >
          <div>
            <div style={sectionLabelStyle}>Total Emissions</div>
            <div
              className="stat-num peach"
              style={{
                fontSize: 22,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatNumber(stats.total)}{' '}
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--fg-4)',
                  fontWeight: 500,
                  letterSpacing: 0,
                }}
              >
                tCO₂e
              </span>
            </div>
          </div>
          {/* TODO: bring back the Scope 1 / Scope 2 summary later if wanted.
              The leading divider belongs to this block — uncomment together
              and the layout returns to the 3-section strip. */}
          {/* <div
            style={{
              width: 1,
              height: 36,
              background: 'var(--border)',
            }}
          />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--scope-1)',
                }}
              />
              <span style={{ color: 'var(--fg-3)' }}>Scope 1</span>
              <span
                className="mono"
                style={{
                  color: 'var(--fg)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatNumber(stats.scope1)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--scope-2)',
                }}
              />
              <span style={{ color: 'var(--fg-3)' }}>Scope 2</span>
              <span
                className="mono"
                style={{
                  color: 'var(--fg)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatNumber(stats.scope2)}
              </span>
            </div>
          </div> */}
          <div
            style={{
              width: 1,
              height: 36,
              background: 'var(--border)',
            }}
          />
          <div
            style={{
              display: 'flex',
              gap: 18,
            }}
          >
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
        onSelectNode={(n) => {
          setSelectedNode(n);
          setSelectedActivityId(null);
        }}
        onSelectActivity={setSelectedActivityId}
        onClose={() => {
          setSelectedNode(null);
          setSelectedActivityId(null);
        }}
      />

      {/* Zoom Controls — bottom-right */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 40,
        }}
      >
        <div
          style={{
            ...overlayPanelStyle,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={() => fgRef.current?.zoom(zoomRef.current * 1.5, 300)}
            title="Zoom in"
            aria-label="Zoom in"
            style={{
              width: 38,
              height: 36,
              padding: 0,
              border: 0,
              borderBottom: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--fg-2)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms ease-out, color 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = 'var(--fg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--fg-2)';
            }}
          >
            <Icon name="plus" size={15} />
          </button>
          <button
            type="button"
            onClick={() => fgRef.current?.zoom(zoomRef.current / 1.5, 300)}
            title="Zoom out"
            aria-label="Zoom out"
            style={{
              width: 38,
              height: 36,
              padding: 0,
              border: 0,
              borderBottom: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--fg-2)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms ease-out, color 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = 'var(--fg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--fg-2)';
            }}
          >
            <Icon name="minus" size={15} />
          </button>
          <button
            type="button"
            onClick={resetView}
            title="Reset view"
            aria-label="Reset view"
            style={{
              width: 38,
              height: 36,
              padding: 0,
              border: 0,
              background: 'transparent',
              color: 'var(--fg-2)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 150ms ease-out, color 150ms ease-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              e.currentTarget.style.color = 'var(--fg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--fg-2)';
            }}
          >
            <Icon name="maximize" size={15} />
          </button>
        </div>
      </div>

      {/* Legend — bottom-left. Caps at the expanded filter rail's 280px;
          shrinks to fit when the active theme has fewer / shorter entries. */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          zIndex: 40,
          maxWidth: 280,
        }}
      >
        <div
          style={{
            ...overlayPanelStyle,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '6px 12px',
          }}
        >
          {theme.legend.map((entry) => (
            <div
              key={entry.label}
              title={entry.hint}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 12,
                color: 'var(--fg-2)',
              }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: entry.color,
                  border: `1px solid ${entry.color}66`,
                }}
              />
              <span>{entry.label}</span>
            </div>
          ))}
        </div>
      </div>

      {extraOverlay}
    </div>
  );

  return (
    <Shell hideSidebar>
      <PageHeader crumbs={crumbs} actions={headerActions} />
      {chrome}
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span
        style={{
          fontSize: 10.5,
          color: 'var(--fg-4)',
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </span>
      <span
        className="mono"
        style={{
          fontSize: 12.5,
          color: 'var(--fg)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value.toLocaleString()}
      </span>
    </div>
  );
}
