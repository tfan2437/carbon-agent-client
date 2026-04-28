import type { GHGGraphData, GHGNode, NodeType } from "@/lib/types";

// Numeric tolerance for emissions comparison — graph builder rounds at
// multiple stages, and float subtraction within ~1e-6 is just noise.
const EPSILON = 1e-6;

function nodeEmissions(node: GHGNode): number {
  // Different node shapes carry tCO₂e under different keys. The current
  // schema standardizes on `total_tco2e` for company/facility/source and
  // `emissions_tco2e` for activity/source_document. Use whichever is set.
  const anyNode = node as unknown as Record<string, unknown>;
  const v =
    typeof anyNode.total_tco2e === "number"
      ? (anyNode.total_tco2e as number)
      : typeof anyNode.emissions_tco2e === "number"
        ? (anyNode.emissions_tco2e as number)
        : 0;
  return Number.isFinite(v) ? v : 0;
}

export interface DiffChangedEntry {
  id: string;
  name: string;
  type: NodeType;
  before: number;
  after: number;
  delta: number;
}

export interface GraphDiff {
  // Node ids to render at full opacity on the canvas. Includes added +
  // changed. For v1 (no parent) this is every id in `curr` so nothing
  // dims.
  highlightSet: Set<string>;
  // Whether `prev` was provided. False for v1 — the panel reads this to
  // skip the "Changes since vN-1" section entirely.
  hasParent: boolean;
  added: GHGNode[];
  changed: DiffChangedEntry[];
  removed: GHGNode[];
  totalDelta: number;
  // Counts per node type, for compact summary rendering.
  addedByType: Record<NodeType, number>;
  removedByType: Record<NodeType, number>;
}

const EMPTY_BY_TYPE: Record<NodeType, number> = {
  company: 0,
  facility: 0,
  emission_source: 0,
  activity_data: 0,
  source_document: 0,
};

function emptyByType(): Record<NodeType, number> {
  return { ...EMPTY_BY_TYPE };
}

/**
 * Diff `curr` against `prev`. Single pass over both node lists.
 *
 * - `added`: ids in curr not in prev.
 * - `changed`: same id, emissions differ beyond EPSILON.
 * - `removed`: ids in prev not in curr (panel-only — can't highlight a
 *   node that doesn't exist on the current canvas).
 *
 * When `prev` is null, returns an "all highlighted" diff so v1 renders
 * fully colored with no diff panel content.
 */
export function computeGraphDiff(
  prev: GHGGraphData | null,
  curr: GHGGraphData,
): GraphDiff {
  if (!prev) {
    return {
      highlightSet: new Set(curr.nodes.map((n) => n.id)),
      hasParent: false,
      added: [],
      changed: [],
      removed: [],
      totalDelta: 0,
      addedByType: emptyByType(),
      removedByType: emptyByType(),
    };
  }

  const prevById = new Map<string, GHGNode>();
  for (const n of prev.nodes) {
    prevById.set(n.id, n);
  }
  const currIds = new Set<string>(curr.nodes.map((n) => n.id));

  const highlightSet = new Set<string>();
  const added: GHGNode[] = [];
  const changed: DiffChangedEntry[] = [];
  const addedByType = emptyByType();

  for (const n of curr.nodes) {
    const p = prevById.get(n.id);
    if (!p) {
      added.push(n);
      addedByType[n.type] += 1;
      highlightSet.add(n.id);
      continue;
    }
    const before = nodeEmissions(p);
    const after = nodeEmissions(n);
    if (Math.abs(after - before) > EPSILON) {
      changed.push({
        id: n.id,
        name: n.name,
        type: n.type,
        before,
        after,
        delta: after - before,
      });
      highlightSet.add(n.id);
    }
  }

  const removed: GHGNode[] = [];
  const removedByType = emptyByType();
  for (const n of prev.nodes) {
    if (!currIds.has(n.id)) {
      removed.push(n);
      removedByType[n.type] += 1;
    }
  }

  // Sort changed by absolute delta desc — biggest movers at the top.
  changed.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return {
    highlightSet,
    hasParent: true,
    added,
    changed,
    removed,
    totalDelta: nodeEmissions(curr.nodes.find((n) => n.type === "company") ?? curr.nodes[0]) -
      nodeEmissions(prev.nodes.find((n) => n.type === "company") ?? prev.nodes[0]),
    addedByType,
    removedByType,
  };
}
