"use client";

import { useState } from "react";
import type { GraphVersionListItem, NodeType } from "@/lib/types";
import { NODE_TYPE_LABELS } from "@/lib/types";
import { formatRelative } from "@/components/projects/v6-doc-row-helpers";
import type { GraphDiff } from "@/lib/diff-graph";

export interface GraphHistoryRailV3Props {
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

function fmtTotal(t: number): string {
  if (!Number.isFinite(t)) return "—";
  if (t >= 1000) return `${(t / 1000).toFixed(1)}k`;
  if (t >= 100) return t.toFixed(0);
  if (t >= 10) return t.toFixed(1);
  return t.toFixed(2);
}

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

export function GraphHistoryRailV3({
  versions,
  selectedVersionId,
  diffsByVersionId,
  parentLabelByVersionId,
  onSelect,
}: GraphHistoryRailV3Props) {
  const [hover, setHover] = useState<HoverState | null>(null);

  if (versions.length === 0) return null;

  const ROW_HEIGHT = 36;
  const HEADER_HEIGHT = 32;

  const hoveredDiff = hover ? diffsByVersionId.get(hover.versionId) : null;
  const hoveredParentLabel = hover
    ? parentLabelByVersionId.get(hover.versionId)
    : null;

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 76,
          right: 512,
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
            padding: "8px 12px",
            fontSize: 11,
            color: "var(--fg-4)",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            borderBottom: "1px solid var(--border-2)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            height: HEADER_HEIGHT,
            boxSizing: "border-box",
          }}
        >
          <span>Versions</span>
          <span
            style={{
              fontSize: 9.5,
              color: "var(--fg-4)",
              opacity: 0.6,
              textTransform: "none",
              letterSpacing: 0,
            }}
          >
            v3
          </span>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "32px 1fr 56px 48px",
            padding: "4px 12px",
            fontSize: 9.5,
            color: "var(--fg-4)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            borderBottom: "1px solid var(--border-2)",
            opacity: 0.7,
          }}
        >
          <span>V#</span>
          <span>Time</span>
          <span style={{ textAlign: "right" }}>tCO₂e</span>
          <span style={{ textAlign: "right" }}>Δ</span>
        </div>

        <div className="scroll" style={{ flex: 1, overflowY: "auto" }}>
          {versions.map((row, idx) => {
            const isLatest = idx === 0;
            const isSelected = row.id === selectedVersionId;
            const isHovered = hover?.versionId === row.id;
            const diff = diffsByVersionId.get(row.id);
            const totalDelta = diff && diff.hasParent ? diff.totalDelta : null;
            const delta = fmtDelta(totalDelta);

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
                  display: "grid",
                  gridTemplateColumns: "32px 1fr 56px 48px",
                  alignItems: "center",
                  padding: "0 12px",
                  height: ROW_HEIGHT,
                  fontSize: 11.5,
                  cursor: "pointer",
                  borderLeft: `2px solid ${isSelected ? "var(--primary)" : "transparent"}`,
                  background: isHovered
                    ? "rgba(255,255,255,0.05)"
                    : isSelected
                      ? "var(--primary-soft)"
                      : "transparent",
                  color: isSelected ? "var(--primary)" : "var(--fg-2)",
                  transition: "background 100ms",
                }}
              >
                <span
                  className="mono"
                  style={{ fontWeight: 600, fontSize: 12 }}
                >
                  v{row.version_number}
                  {isLatest && (
                    <span
                      style={{
                        marginLeft: 3,
                        fontSize: 8,
                        color: "var(--fg-4)",
                        verticalAlign: "super",
                      }}
                    >
                      ★
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    color: "var(--fg-3)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatRelative(row.built_at)}
                </span>
                <span
                  className="mono"
                  style={{
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 11,
                    color: "var(--fg-2)",
                  }}
                >
                  {fmtTotal(row.summary.total_tco2e ?? 0)}
                </span>
                <span
                  className="mono"
                  style={{
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 10.5,
                    color: delta?.color ?? "var(--fg-4)",
                  }}
                >
                  {delta?.text ?? "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover popover anchored to the row, slid further left so it
          doesn't overlap V3's body. */}
      {hover && hoveredDiff && hoveredDiff.hasParent && hoveredParentLabel && (
        <div
          style={{
            position: "fixed",
            top: hover.rowTop,
            // Page is full-width; popover floats to the left of V3's right
            // edge. 240 (V3 width) + 512 (V3 right offset) + a gap.
            right: 760,
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
            <div style={{ fontSize: 11, color: "var(--fg-3)" }}>
              No changes
            </div>
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
