"use client";

import type { GraphDiff } from "@/lib/diff-graph";
import type { NodeType } from "@/lib/types";
import { NODE_TYPE_LABELS } from "@/lib/types";

export interface GraphDiffPanelProps {
  diff: GraphDiff;
  // Display label of the parent we're comparing against, e.g. "v1".
  // Rendered in the header so the user knows what the deltas reference.
  parentLabel: string;
}

function fmtTotal(t: number): string {
  if (!Number.isFinite(t)) return "—";
  const sign = t > 0 ? "+" : t < 0 ? "−" : "";
  const abs = Math.abs(t);
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  if (abs >= 100) return `${sign}${abs.toFixed(0)}`;
  if (abs >= 10) return `${sign}${abs.toFixed(1)}`;
  if (abs >= 0.01) return `${sign}${abs.toFixed(2)}`;
  return `${sign}${abs.toFixed(4)}`;
}

// Show added/removed counts in a stable type order so the row ordering
// doesn't shuffle as the diff updates.
const TYPE_ORDER: NodeType[] = [
  "company",
  "facility",
  "emission_source",
  "activity_data",
  "source_document",
];

function CountRow({
  label,
  byType,
  prefix,
  color,
}: {
  label: string;
  byType: Record<NodeType, number>;
  prefix: "+" | "−";
  color: string;
}) {
  const entries = TYPE_ORDER.filter((t) => byType[t] > 0).map((t) => ({
    type: t,
    count: byType[t],
  }));
  if (entries.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          fontSize: 10.5,
          color: "var(--fg-4)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {entries.map((e) => (
          <div
            key={e.type}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11.5,
              color: "var(--fg-2)",
            }}
          >
            <span>{NODE_TYPE_LABELS[e.type].zh}</span>
            <span
              className="mono"
              style={{ color, fontVariantNumeric: "tabular-nums" }}
            >
              {prefix}
              {e.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GraphDiffPanel({ diff, parentLabel }: GraphDiffPanelProps) {
  // Don't render at all when there's no parent (v1) or no real changes.
  if (!diff.hasParent) return null;
  if (
    diff.added.length === 0 &&
    diff.changed.length === 0 &&
    diff.removed.length === 0
  ) {
    return null;
  }

  const ADDED_COLOR = "#79B987";
  const REMOVED_COLOR = "#E58971";

  // Cap the changed list — anything beyond ~6 entries usually means
  // top-of-tree rollups (company, facility) being above per-source noise.
  // Show up to 6 with a "+N more" tail.
  const MAX_CHANGED = 6;
  const changedShown = diff.changed.slice(0, MAX_CHANGED);
  const changedHidden = diff.changed.length - changedShown.length;

  return (
    <div
      style={{
        position: "absolute",
        top: 76 + 220 + 8, // history rail top + estimated rail height + gap
        right: 16,
        width: 224,
        maxHeight: "calc(100vh - 460px)",
        zIndex: 35,
        display: "flex",
        flexDirection: "column",
        background: "rgba(20, 16, 14, 0.78)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        border: "1px solid var(--border-2)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px 8px",
          fontSize: 11,
          color: "var(--fg-4)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          borderBottom: "1px solid var(--border-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Changes since {parentLabel}</span>
        {Math.abs(diff.totalDelta) > 0.005 && (
          <span
            className="mono"
            style={{
              fontSize: 10.5,
              color: diff.totalDelta > 0 ? "#E58971" : "#79B987",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {fmtTotal(diff.totalDelta)} t
          </span>
        )}
      </div>
      <div
        className="scroll"
        style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}
      >
        <CountRow
          label="Added"
          byType={diff.addedByType}
          prefix="+"
          color={ADDED_COLOR}
        />
        <CountRow
          label="Removed"
          byType={diff.removedByType}
          prefix="−"
          color={REMOVED_COLOR}
        />

        {changedShown.length > 0 && (
          <div>
            <div
              style={{
                fontSize: 10.5,
                color: "var(--fg-4)",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              Changed
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {changedShown.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 8,
                    fontSize: 11.5,
                    color: "var(--fg-2)",
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                      minWidth: 0,
                    }}
                    title={`${NODE_TYPE_LABELS[e.type].zh} · ${e.name}`}
                  >
                    {e.name}
                  </span>
                  <span
                    className="mono"
                    style={{
                      color: e.delta > 0 ? "#E58971" : "#79B987",
                      fontVariantNumeric: "tabular-nums",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtTotal(e.delta)}
                    <span
                      style={{
                        fontSize: 9.5,
                        color: "var(--fg-4)",
                        marginLeft: 2,
                      }}
                    >
                      t
                    </span>
                  </span>
                </div>
              ))}
              {changedHidden > 0 && (
                <div
                  style={{
                    fontSize: 10.5,
                    color: "var(--fg-4)",
                    marginTop: 2,
                  }}
                >
                  +{changedHidden} more
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
