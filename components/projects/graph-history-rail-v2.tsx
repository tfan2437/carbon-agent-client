"use client";

import { useState } from "react";
import type { GraphVersionListItem, NodeType } from "@/lib/types";
import { NODE_TYPE_LABELS } from "@/lib/types";
import { formatRelative } from "@/components/projects/v6-doc-row-helpers";
import type { GraphDiff } from "@/lib/diff-graph";

export interface GraphHistoryRailV2Props {
  versions: GraphVersionListItem[];
  selectedVersionId: string | null;
  diffsByVersionId: Map<string, GraphDiff>;
  parentLabelByVersionId: Map<string, string>;
  onSelect: (versionId: string) => void;
}

function fmtDelta(d: number): string {
  if (Math.abs(d) < 0.01) return "±0";
  const sign = d > 0 ? "+" : "−";
  const abs = Math.abs(d);
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  if (abs >= 100) return `${sign}${abs.toFixed(0)}`;
  if (abs >= 10) return `${sign}${abs.toFixed(1)}`;
  return `${sign}${abs.toFixed(2)}`;
}

const TYPE_ORDER: NodeType[] = [
  "company",
  "facility",
  "emission_source",
  "activity_data",
  "source_document",
];

export function GraphHistoryRailV2({
  versions,
  selectedVersionId,
  diffsByVersionId,
  parentLabelByVersionId,
  onSelect,
}: GraphHistoryRailV2Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (versions.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 76,
        right: 256,
        width: 240,
        maxHeight: "calc(100vh - 200px)",
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
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>Timeline</span>
        <span
          style={{
            fontSize: 9.5,
            color: "var(--fg-4)",
            opacity: 0.6,
            textTransform: "none",
            letterSpacing: 0,
          }}
        >
          v2
        </span>
      </div>
      <div
        className="scroll"
        style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}
      >
        {versions.map((row, idx) => {
          const isLatest = idx === 0;
          const isSelected = row.id === selectedVersionId;
          const isHovered = row.id === hoveredId;
          const expanded = isHovered;
          const diff = diffsByVersionId.get(row.id);
          const parentLabel = parentLabelByVersionId.get(row.id);
          const totalDelta = diff && diff.hasParent ? diff.totalDelta : null;
          const isLastInList = idx === versions.length - 1;
          const dotColor = isSelected ? "var(--primary)" : "var(--fg-3)";

          return (
            <div
              key={row.id}
              onMouseEnter={() => setHoveredId(row.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onSelect(row.id)}
              style={{
                position: "relative",
                paddingLeft: 28,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                cursor: "pointer",
                background: isHovered ? "rgba(255,255,255,0.04)" : "transparent",
                transition: "background 120ms",
              }}
            >
              {/* Connector line + dot */}
              <div
                style={{
                  position: "absolute",
                  left: 12,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "var(--border)",
                  // Hide the segment above the first dot and below the last.
                  ...(idx === 0 && { top: 14 }),
                  ...(isLastInList && { bottom: "calc(100% - 14px)" }),
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: 7,
                  top: 9,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: isSelected
                    ? "rgba(20, 16, 14, 0.78)"
                    : dotColor,
                  border: `2px solid ${dotColor}`,
                  boxSizing: "border-box",
                  zIndex: 1,
                }}
              />

              {/* Compact one-liner */}
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 12.5,
                    color: isSelected ? "var(--primary)" : "var(--fg-1)",
                    fontWeight: 600,
                  }}
                >
                  v{row.version_number}
                </span>
                {isLatest && (
                  <span
                    style={{
                      fontSize: 9,
                      padding: "1px 6px",
                      background: "rgba(95, 130, 200, 0.18)",
                      color: "#9CB7E0",
                      border: "1px solid rgba(95, 130, 200, 0.4)",
                      borderRadius: 999,
                      fontWeight: 500,
                      letterSpacing: "0.02em",
                    }}
                  >
                    main
                  </span>
                )}
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--fg-4)",
                    marginLeft: "auto",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatRelative(row.built_at)}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 6,
                  marginTop: 2,
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--fg-3)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {(row.summary.total_tco2e ?? 0).toFixed(2)} t
                </span>
                {totalDelta !== null && Math.abs(totalDelta) > 0.005 && (
                  <span
                    className="mono"
                    style={{
                      fontSize: 10.5,
                      color: totalDelta > 0 ? "#E58971" : "#79B987",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmtDelta(totalDelta)}
                  </span>
                )}
              </div>

              {/* Inline expansion on hover */}
              {expanded && diff && diff.hasParent && parentLabel && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "8px 10px",
                    background: "rgba(0, 0, 0, 0.35)",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--fg-4)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 4,
                    }}
                  >
                    vs {parentLabel}
                  </div>
                  {(diff.added.length > 0 || diff.removed.length > 0) && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--fg-2)",
                        lineHeight: 1.55,
                      }}
                    >
                      {TYPE_ORDER.flatMap((t) => {
                        const a = diff.addedByType[t] ?? 0;
                        const r = diff.removedByType[t] ?? 0;
                        if (a === 0 && r === 0) return [];
                        return [
                          <div
                            key={t}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span>{NODE_TYPE_LABELS[t].zh}</span>
                            <span
                              className="mono"
                              style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                              {a > 0 && (
                                <span style={{ color: "#79B987" }}>+{a}</span>
                              )}
                              {r > 0 && (
                                <span
                                  style={{
                                    color: "#E58971",
                                    marginLeft: a > 0 ? 4 : 0,
                                  }}
                                >
                                  −{r}
                                </span>
                              )}
                            </span>
                          </div>,
                        ];
                      })}
                    </div>
                  )}
                  {diff.changed.length > 0 && (
                    <div
                      style={{
                        fontSize: 10.5,
                        color: "var(--fg-4)",
                        marginTop: 4,
                      }}
                    >
                      {diff.changed.length} changed
                    </div>
                  )}
                  {diff.added.length === 0 &&
                    diff.removed.length === 0 &&
                    diff.changed.length === 0 && (
                      <div
                        style={{ fontSize: 11, color: "var(--fg-3)" }}
                      >
                        No changes
                      </div>
                    )}
                </div>
              )}
              {expanded && !diff && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 10.5,
                    color: "var(--fg-4)",
                  }}
                >
                  Loading…
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
