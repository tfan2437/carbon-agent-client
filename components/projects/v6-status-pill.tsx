"use client";

import * as React from "react";

export type V6Status =
  | "uploading"
  | "uploaded"
  | "processing"
  | "processed"
  | "error";

type Tone = { label: string; color: string; soft: string; line: string };

export const V6_STATUS_TONES: Record<V6Status, Tone> = {
  uploading: {
    label: "Uploading",
    color: "#6FA4C9",
    soft: "rgba(111,164,201,0.14)",
    line: "rgba(111,164,201,0.35)",
  },
  uploaded: {
    label: "Uploaded",
    color: "var(--fg-2)",
    soft: "rgba(255,255,255,0.05)",
    line: "var(--border-2)",
  },
  processing: {
    label: "Processing",
    color: "#DE7356",
    soft: "rgba(222,115,86,0.14)",
    line: "rgba(222,115,86,0.35)",
  },
  processed: {
    label: "Processed",
    color: "oklch(0.72 0.14 155)",
    soft: "oklch(0.72 0.14 155 / 0.14)",
    line: "oklch(0.72 0.14 155 / 0.35)",
  },
  error: {
    label: "Error",
    color: "oklch(0.65 0.22 25)",
    soft: "oklch(0.65 0.22 25 / 0.14)",
    line: "oklch(0.65 0.22 25 / 0.35)",
  },
};

const ANIMATED: Record<V6Status, boolean> = {
  uploading: true,
  uploaded: false,
  processing: true,
  processed: false,
  error: false,
};

export const StatusPill: React.FC<{
  status: V6Status;
  small?: boolean;
  title?: string;
}> = ({ status, small, title }) => {
  const t = V6_STATUS_TONES[status];
  const animate = ANIMATED[status];
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: small ? 20 : 22,
        padding: small ? "0 7px" : "0 9px",
        borderRadius: 9999,
        fontSize: small ? 10.5 : 11.5,
        fontWeight: 500,
        border: `1px solid ${t.line}`,
        background: t.soft,
        color: t.color,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: t.color,
          animation: animate ? "wv-pulse 1.4s ease-in-out infinite" : undefined,
        }}
      />
      {t.label}
    </span>
  );
};
