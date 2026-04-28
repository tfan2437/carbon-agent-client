"use client";

import { useState } from "react";
import type { GraphVersionListItem, NodeType } from "@/lib/types";
import { NODE_TYPE_LABELS } from "@/lib/types";
import { formatRelative } from "@/components/projects/v6-doc-row-helpers";
import type { GraphDiff } from "@/lib/diff-graph";

export interface GraphHistoryRailV4Props {
  versions: GraphVersionListItem[];
  selectedVersionId: string | null;
  diffsByVersionId: Map<string, GraphDiff>;
  parentLabelByVersionId: Map<string, string>;
  onSelect: (versionId: string) => void;
}

const TYPE_ORDER: NodeType[] = [
  "company",
  "facility",
  "emission_source",
  "activity_data",
  "source_document",
];

function fmtDelta(d: number | null): { text: string; color: string } | null {
  if (d == null || Math.abs(d) < 0.01) return null;
  const sign = d > 0 ? "+" : "−";
  const abs = Math.abs(d);
  let text: string;
  if (abs >= 1000) text = `${sign}${(abs / 1000).toFixed(1)}k`;
  else if (abs >= 100) text = `${sign}${abs.toFixed(0)}`;
  else if (abs >= 10) text = `${sign}${abs.toFixed(1)}`;
  else text = `${sign}${abs.toFixed(2)}`;
  return { text, color: d > 0 ? "#E58971" : "#79B987" };
}

interface HoverState {
  versionId: string;
  rowTop: number;
}

export function GraphHistoryRailV4({
  versions,
  selectedVersionId,
  diffsByVersionId,
  parentLabelByVersionId,
  onSelect,
}: GraphHistoryRailV4Props) {
  const [hover, setHover] = useState<HoverState | null>(null);

  if (versions.length === 0) return null;

  const hoveredDiff = hover ? diffsByVersionId.get(hover.versionId) : null;
  const hoveredParentLabel = hover
    ? parentLabelByVersionId.get(hover.versionId)
    : null;

  return (
    <>
      <div
        style={{
          // Aligned to the right edge of the stats strip (right: 16);
          // small gap below the strip per design direction.
          position: "absolute",
          top: 88,
          right: 16,
          width: 150,
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
          }}
        >
          Branch
        </div>

        {/* No vertical padding — rows sit flush against the header border
            and the rail's bottom edge so there's no black gutter. */}
        <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
          {versions.map((row, idx) => {
            const isSelected = row.id === selectedVersionId;
            const isHovered = hover?.versionId === row.id;
            const isLastInList = idx === versions.length - 1;
            const dotColor = isSelected ? "var(--primary)" : "var(--fg-3)";

            // Selected stays orange even while hovered — only the diff
            // popover responds to hover. Non-selected rows take the
            // subtle hover wash.
            const background = isSelected
              ? "var(--primary-soft)"
              : isHovered
                ? "rgba(255,255,255,0.05)"
                : "transparent";

            return (
              <div
                key={row.id}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHover({ versionId: row.id, rowTop: rect.top });
                }}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect(row.id)}
                style={{
                  position: "relative",
                  paddingLeft: 28,
                  paddingRight: 12,
                  paddingTop: 10,
                  paddingBottom: 10,
                  cursor: "pointer",
                  background,
                  transition: "background 120ms",
                }}
              >
                {/* Connector line + dot — both states are hollow rings,
                    only the ring color changes between selected and not. */}
                <div
                  style={{
                    position: "absolute",
                    left: 12,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    background: "var(--border)",
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
                    background: "rgba(20, 16, 14, 0.78)",
                    border: `2px solid ${dotColor}`,
                    boxSizing: "border-box",
                    zIndex: 1,
                  }}
                />

                {/* Row body — vN and relative time, single line */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    gap: 8,
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
                  <span
                    style={{
                      fontSize: 10.5,
                      color: "var(--fg-4)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {formatRelative(row.built_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Side popover anchored to the hovered row's vertical position.
          V4 left edge is at right: 166 (right 16 + width 150); popover
          sits just left of that. */}
      {hover && hoveredDiff && hoveredDiff.hasParent && hoveredParentLabel && (
        <div
          style={{
            position: "fixed",
            top: hover.rowTop,
            right: 192,
            width: 220,
            zIndex: 60,
            background: "rgba(28, 22, 20, 0.96)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--border-2)",
            borderRadius: "var(--r-lg)",
            padding: "10px 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 10.5,
                color: "var(--fg-4)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              vs {hoveredParentLabel}
            </span>
            {Math.abs(hoveredDiff.totalDelta) > 0.005 && (
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: hoveredDiff.totalDelta > 0 ? "#E58971" : "#79B987",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {fmtDelta(hoveredDiff.totalDelta)?.text ?? ""} t
              </span>
            )}
          </div>
          {hoveredDiff.added.length === 0 &&
          hoveredDiff.removed.length === 0 &&
          hoveredDiff.changed.length === 0 ? (
            <div style={{ fontSize: 11, color: "var(--fg-3)" }}>No changes</div>
          ) : (
            <div style={{ fontSize: 11, color: "var(--fg-2)", lineHeight: 1.6 }}>
              {TYPE_ORDER.flatMap((t) => {
                const a = hoveredDiff.addedByType[t] ?? 0;
                const r = hoveredDiff.removedByType[t] ?? 0;
                if (a === 0 && r === 0) return [];
                return [
                  <div
                    key={t}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ color: "var(--fg-3)" }}>
                      {NODE_TYPE_LABELS[t].zh}
                    </span>
                    <span
                      className="mono"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {a > 0 && <span style={{ color: "#79B987" }}>+{a}</span>}
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
              {hoveredDiff.changed.length > 0 && (
                <div
                  style={{
                    marginTop: 4,
                    paddingTop: 4,
                    borderTop: "1px solid var(--border)",
                    fontSize: 10.5,
                    color: "var(--fg-4)",
                  }}
                >
                  {hoveredDiff.changed.length} changed
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
