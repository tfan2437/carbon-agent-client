"use client";

import * as React from "react";
import { Icon, type IconName } from "@/components/engram/Primitives";
import {
  V6_STATUS_TONES,
  type V6Status,
} from "@/components/projects/v6-status-pill";

export type V6Filter = "all" | V6Status;

export type V6Counts = Record<V6Status, number> & { all: number };

type Tab = { id: V6Filter; icon: IconName; label: string; color: string };

const TABS: Tab[] = [
  { id: "all",        icon: "layers", label: "All",        color: "var(--fg-2)" },
  { id: "uploading",  icon: "upload", label: "Uploading",  color: V6_STATUS_TONES.uploading.color },
  { id: "uploaded",   icon: "inbox",  label: "Uploaded",   color: "var(--fg-3)" },
  { id: "processing", icon: "cycle",  label: "Processing", color: V6_STATUS_TONES.processing.color },
  { id: "processed",  icon: "check",  label: "Processed",  color: V6_STATUS_TONES.processed.color },
  { id: "error",      icon: "alert",  label: "Error",      color: V6_STATUS_TONES.error.color },
];

export const StatusFilterButtons: React.FC<{
  filter: V6Filter;
  onFilter: (id: V6Filter) => void;
  counts: V6Counts;
}> = ({ filter, onFilter, counts }) => (
  <div
    role="tablist"
    aria-label="Filter by status"
    style={{
      display: "inline-flex",
      alignItems: "center",
      padding: 3,
      gap: 2,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid var(--border)",
      borderRadius: 8,
    }}
  >
    {TABS.map((t) => {
      const active = filter === t.id;
      const n = counts[t.id] ?? 0;
      return (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active}
          title={`${t.label} · ${n}`}
          onClick={() => onFilter(t.id)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 28,
            padding: "0 10px",
            border: 0,
            borderRadius: 6,
            background: active ? "rgba(255,255,255,0.08)" : "transparent",
            color: active ? "var(--fg)" : "var(--fg-3)",
            fontSize: 12,
            fontWeight: 510,
            fontFamily: "inherit",
            cursor: "pointer",
            transition:
              "background 150ms ease-out, color 150ms ease-out",
          }}
        >
          <Icon
            name={t.icon}
            size={13}
            color={active ? t.color : "currentColor"}
          />
          <span
            className="mono"
            style={{
              fontSize: 11,
              color: active ? "var(--fg-2)" : "var(--fg-4)",
            }}
          >
            {n}
          </span>
        </button>
      );
    })}
  </div>
);
