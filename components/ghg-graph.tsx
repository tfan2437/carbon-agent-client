'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D, { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d';
import { GHGNode, GHG_DATA, getNodeColor, NODE_TYPE_LABELS, calculateScopeEmissions, getFacilities, NodeType, Scope } from '@/lib/ghg-data';

// Extended types for force graph
interface GraphNode extends NodeObject {
  id: string;
  name: string;
  nameEn?: string;
  type: NodeType;
  scope: Scope;
  emissions?: number;
  activityValue?: number;
  activityUnit?: string;
  emissionFactor?: {
    value: number;
    unit: string;
    source: string;
  };
  facility?: string;
  year: number;
  x?: number;
  y?: number;
}

interface GraphLink extends LinkObject {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Format large numbers
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toFixed(0);
}

// Calculate node size based on emissions (log scale)
function getNodeSize(node: GraphNode, maxEmissions: number): number {
  if (!node.emissions || node.emissions === 0) return 4;
  const minSize = 4;
  const maxSize = 24;
  const logEmissions = Math.log10(node.emissions + 1);
  const logMax = Math.log10(maxEmissions + 1);
  return minSize + ((logEmissions / logMax) * (maxSize - minSize));
}

export default function GHGGraph() {
  const fgRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [filterPanelOpen, setFilterPanelOpen] = useState(true);

  // Filters
  const [selectedYear] = useState(2024);
  const [scopeFilter, setScopeFilter] = useState<{ scope1: boolean; scope2: boolean }>({ scope1: true, scope2: true });
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate stats
  const stats = useMemo(() => calculateScopeEmissions(GHG_DATA.nodes), []);
  const facilities = useMemo(() => getFacilities(GHG_DATA.nodes), []);
  const maxEmissions = useMemo(() => Math.max(...GHG_DATA.nodes.map(n => n.emissions || 0)), []);

  // Build neighbor map for hover highlighting
  const neighborMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    GHG_DATA.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : (link.source as GraphNode).id;
      const targetId = typeof link.target === 'string' ? link.target : (link.target as GraphNode).id;
      if (!map.has(sourceId)) map.set(sourceId, new Set());
      if (!map.has(targetId)) map.set(targetId, new Set());
      map.get(sourceId)!.add(targetId);
      map.get(targetId)!.add(sourceId);
    });
    return map;
  }, []);

  // Filter graph data
  const graphData: GraphData = useMemo(() => {
    let nodes = GHG_DATA.nodes as GraphNode[];
    let links = GHG_DATA.links as GraphLink[];

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
          .filter(n => n.name.toLowerCase().includes(query) || (n.nameEn && n.nameEn.toLowerCase().includes(query)))
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
  }, [scopeFilter, selectedFacilities, searchQuery, neighborMap]);

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
    const size = getNodeSize(node, maxEmissions);
    const color = getNodeColor(node as GHGNode);
    const highlighted = isHighlighted(node.id);
    const isSelected = selectedNode?.id === node.id;

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

    // Draw selection ring
    if (isSelected) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Draw label only when zoomed in or hovered
    const showLabel = globalScale > 1.5 || (hoveredNode && highlighted);
    if (showLabel) {
      const fontSize = Math.max(10 / globalScale, 3);
      ctx.font = `${fontSize}px 'Geist', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = `rgba(156, 163, 175, ${opacity})`;
      ctx.fillText(node.name, node.x!, node.y! + size + 4 / globalScale);
    }

    ctx.globalAlpha = 1;
  }, [maxEmissions, isHighlighted, hoveredNode, selectedNode]);

  // Custom link rendering
  const paintLink = useCallback((link: GraphLink, ctx: CanvasRenderingContext2D) => {
    const source = link.source as GraphNode;
    const target = link.target as GraphNode;
    if (!source.x || !source.y || !target.x || !target.y) return;

    const sourceHighlighted = isHighlighted(source.id);
    const targetHighlighted = isHighlighted(target.id);
    const highlighted = sourceHighlighted && targetHighlighted;
    const opacity = hoveredNode ? (highlighted ? 0.4 : 0.05) : 0.25;

    ctx.strokeStyle = `rgba(107, 114, 128, ${opacity})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
  }, [isHighlighted, hoveredNode]);

  // Get linked documents for a node
  const getLinkedDocuments = useCallback((nodeId: string): GraphNode[] => {
    const visited = new Set<string>();
    const documents: GraphNode[] = [];

    const traverse = (currentId: string) => {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const node = graphData.nodes.find(n => n.id === currentId);
      if (node?.type === 'source_document') {
        documents.push(node);
        return;
      }

      graphData.links.forEach(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        if (sourceId === currentId) traverse(targetId);
      });
    };

    traverse(nodeId);
    return documents;
  }, [graphData]);

  // Focus on a specific node
  const focusOnNode = useCallback((node: GraphNode) => {
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      fgRef.current.centerAt(node.x, node.y, 500);
      fgRef.current.zoom(2.5, 500);
    }
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 80);
    }
  }, []);

  // Initial fit
  useEffect(() => {
    const timer = setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.zoomToFit(400, 80);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
          const size = getNodeSize(node as GraphNode, maxEmissions);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, size + 4, 0, 2 * Math.PI);
          ctx.fill();
        }}
        onNodeHover={(node) => setHoveredNode(node as GraphNode | null)}
        onNodeClick={(node) => setSelectedNode(node as GraphNode)}
        onBackgroundClick={() => setSelectedNode(null)}
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
            {hoveredNode.nameEn && (
              <div className="text-gray-400 text-xs mt-0.5">{hoveredNode.nameEn}</div>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: getNodeColor(hoveredNode as GHGNode) + '30', color: getNodeColor(hoveredNode as GHGNode) }}>
                {NODE_TYPE_LABELS[hoveredNode.type].en}
              </span>
              {hoveredNode.scope && (
                <span className={`text-xs px-2 py-0.5 rounded ${hoveredNode.scope === 1 ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                  Scope {hoveredNode.scope}
                </span>
              )}
              {hoveredNode.emissions && (
                <span className="text-gray-300 text-xs">
                  {formatNumber(hoveredNode.emissions)} kgCO₂e
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

              {/* Year */}
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider">Year</label>
                <div className="mt-1 flex gap-2">
                  <button className="flex-1 bg-white/10 text-white text-sm py-2 rounded-lg border border-white/20">
                    {selectedYear}
                  </button>
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
            </div>
          )}
        </div>
      </div>

      {/* Stats Card - Top Right */}
      <div className="absolute top-4 right-4 z-40">
        <div className="bg-[#1a1d24]/80 backdrop-blur-md border border-white/10 rounded-xl p-4 min-w-[200px]">
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-2">Total Emissions</div>
          <div className="text-white text-2xl font-semibold">{formatNumber(stats.total)} <span className="text-sm text-gray-400">kgCO₂e</span></div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span className="text-gray-400 text-sm">Scope 1</span>
              </div>
              <span className="text-white text-sm">{formatNumber(stats.scope1)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <span className="text-gray-400 text-sm">Scope 2</span>
              </div>
              <span className="text-white text-sm">{formatNumber(stats.scope2)}</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Facilities</span>
              <span className="text-white">{facilities.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Inspector Panel - Right Side */}
      <div
        className={`absolute top-24 right-4 z-40 transition-all duration-300 ${selectedNode ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0 pointer-events-none'}`}
      >
        {selectedNode && (
          <div className="bg-[#1a1d24]/90 backdrop-blur-md border border-white/10 rounded-xl w-80 max-h-[calc(100vh-140px)] overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">{selectedNode.name}</h3>
                  {selectedNode.nameEn && (
                    <p className="text-gray-400 text-sm mt-0.5">{selectedNode.nameEn}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-white p-1"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: getNodeColor(selectedNode as GHGNode) + '30', color: getNodeColor(selectedNode as GHGNode) }}>
                  {NODE_TYPE_LABELS[selectedNode.type].zh} / {NODE_TYPE_LABELS[selectedNode.type].en}
                </span>
                {selectedNode.scope && (
                  <span className={`text-xs px-2 py-1 rounded ${selectedNode.scope === 1 ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    Scope {selectedNode.scope}
                  </span>
                )}
              </div>
            </div>

            {/* Metrics */}
            {(selectedNode.emissions || selectedNode.activityValue) && (
              <div className="p-4 border-b border-white/10">
                <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Metrics</h4>
                <div className="space-y-3">
                  {selectedNode.emissions && (
                    <div>
                      <div className="text-gray-400 text-sm">Emissions</div>
                      <div className="text-white text-xl font-medium">
                        {selectedNode.emissions.toLocaleString()} <span className="text-sm text-gray-400">kgCO₂e</span>
                      </div>
                      <div className="text-gray-500 text-xs mt-1">
                        {((selectedNode.emissions / stats.total) * 100).toFixed(1)}% of company total
                      </div>
                    </div>
                  )}
                  {selectedNode.activityValue && (
                    <div className="mt-2">
                      <div className="text-gray-400 text-sm">Activity Value</div>
                      <div className="text-white text-lg">
                        {selectedNode.activityValue.toLocaleString()} <span className="text-sm text-gray-400">{selectedNode.activityUnit}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Emission Factor */}
            {selectedNode.emissionFactor && (
              <div className="p-4 border-b border-white/10">
                <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Emission Factor</h4>
                <div className="text-white">
                  {selectedNode.emissionFactor.value} <span className="text-gray-400 text-sm">{selectedNode.emissionFactor.unit}</span>
                </div>
                <div className="text-gray-500 text-xs mt-1">
                  Source: {selectedNode.emissionFactor.source}
                </div>
              </div>
            )}

            {/* Linked Documents */}
            {selectedNode.type !== 'source_document' && (
              <div className="p-4 border-b border-white/10">
                <h4 className="text-gray-400 text-xs uppercase tracking-wider mb-3">Linked Documents</h4>
                <div className="space-y-2">
                  {getLinkedDocuments(selectedNode.id).length > 0 ? (
                    getLinkedDocuments(selectedNode.id).map(doc => (
                      <button
                        key={doc.id}
                        onClick={() => {
                          setSelectedNode(doc);
                          focusOnNode(doc);
                        }}
                        className="w-full text-left px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-gray-300 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {doc.name}
                      </button>
                    ))
                  ) : (
                    <div className="text-gray-500 text-sm">No linked documents</div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-4">
              <button
                onClick={() => focusOnNode(selectedNode)}
                className="w-full bg-white/10 hover:bg-white/15 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                Focus Subtree
              </button>
            </div>
          </div>
        )}
      </div>

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
        <div className="bg-[#1a1d24]/80 backdrop-blur-md border border-white/10 rounded-xl p-3">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="text-gray-400">Scope 1</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              <span className="text-gray-400">Scope 2</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-gray-500"></span>
              <span className="text-gray-400">Structural</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
