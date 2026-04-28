"use client";

import { useMemo } from "react";
import type { GraphVersionListItem } from "@/lib/types";
import { formatRelative } from "@/components/projects/v6-doc-row-helpers";

export interface GraphHistoryRailProps {
  versions: GraphVersionListItem[];
  // The version currently shown on canvas. null while still loading or if
  // no versions exist; matches the "selected" pill in the rail.
  selectedVersionId: string | null;
  onSelect: (versionId: string) => void;
}

function formatTotal(t: number | null | undefined): string {
  if (t == null || !Number.isFinite(t)) return "—";
  if (t >= 1000) return `${(t / 1000).toFixed(1)}k`;
  if (t >= 100) return t.toFixed(0);
  if (t >= 10) return t.toFixed(1);
  return t.toFixed(2);
}

function formatDelta(curr: number, prev: number | undefined): string | null {
  if (prev === undefined) return null;
  const d = curr - prev;
  if (Math.abs(d) < 0.01) return "±0";
  const sign = d > 0 ? "+" : "−";
  const abs = Math.abs(d);
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  if (abs >= 100) return `${sign}${abs.toFixed(0)}`;
  if (abs >= 10) return `${sign}${abs.toFixed(1)}`;
  return `${sign}${abs.toFixed(2)}`;
}

export function GraphHistoryRail({
  versions,
  selectedVersionId,
  onSelect,
}: GraphHistoryRailProps) {
  // Pre-compute deltas vs the chronologically previous version (versions
  // are sorted newest-first, so previous = next index).
  const rows = useMemo(
    () =>
      versions.map((v, i) => {
        const prev = versions[i + 1];
        return {
          ...v,
          delta: formatDelta(v.summary.total_tco2e, prev?.summary.total_tco2e),
          deltaSign:
            prev === undefined
              ? null
              : v.summary.total_tco2e > prev.summary.total_tco2e
                ? "up"
                : v.summary.total_tco2e < prev.summary.total_tco2e
                  ? "down"
                  : "flat",
        };
      }),
    [versions],
  );

  if (rows.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 76,
        right: 16,
        width: 224,
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
        History
      </div>
      <div
        className="scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 6,
        }}
      >
        {rows.map((row) => {
          const active = row.id === selectedVersionId;
          const deltaColor =
            row.deltaSign === "up"
              ? "#E58971"
              : row.deltaSign === "down"
                ? "#79B987"
                : "var(--fg-4)";
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                marginBottom: 2,
                border: `1px solid ${active ? "var(--primary-line)" : "transparent"}`,
                background: active ? "var(--primary-soft)" : "transparent",
                color: "var(--fg-1)",
                borderRadius: "var(--r-sm)",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: "inherit",
                transition: "background 120ms, border-color 120ms",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {/* Timeline dot + connector */}
              <div
                style={{
                  width: 8,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  alignSelf: "stretch",
                  position: "relative",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: active ? "var(--primary)" : "var(--fg-3)",
                    border: active
                      ? "2px solid var(--primary-soft)"
                      : "1px solid var(--border)",
                    marginTop: 4,
                  }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: 12.5,
                      color: active ? "var(--primary)" : "var(--fg-1)",
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
                      fontSize: 11.5,
                      color: "var(--fg-2)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatTotal(row.summary.total_tco2e)}
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
                  {row.delta && (
                    <span
                      className="mono"
                      style={{
                        fontSize: 10.5,
                        color: deltaColor,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {row.delta}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
