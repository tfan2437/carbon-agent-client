import type { GHGGraphData, GHGNode } from "@/lib/types";

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

/**
 * Compute the set of node ids that are "interesting" in `curr` vs `prev`:
 *   - added (id present in curr but not in prev)
 *   - changed (id present in both, but emissions differ beyond EPSILON)
 *
 * Removed nodes are intentionally NOT in the set — they don't exist in
 * `curr` so they can't be highlighted on the current canvas. The user
 * spec says "highlight what changed in this commit"; removals belong to
 * a future text-diff panel.
 *
 * When `prev` is null (e.g. v1 has no parent), returns the set of all
 * node ids in `curr` so the canvas renders fully colored — no greying.
 */
export function computeDiffHighlight(
  prev: GHGGraphData | null,
  curr: GHGGraphData,
): Set<string> {
  if (!prev) {
    return new Set(curr.nodes.map((n) => n.id));
  }

  const prevById = new Map<string, GHGNode>();
  for (const n of prev.nodes) {
    prevById.set(n.id, n);
  }

  const out = new Set<string>();
  for (const n of curr.nodes) {
    const p = prevById.get(n.id);
    if (!p) {
      out.add(n.id);
      continue;
    }
    if (Math.abs(nodeEmissions(n) - nodeEmissions(p)) > EPSILON) {
      out.add(n.id);
    }
  }
  return out;
}
