"use client";

import * as React from "react";

export const Progress: React.FC<{
  pct: number;
  color?: string;
  height?: number;
}> = ({ pct, color = "var(--primary)", height = 4 }) => {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{
        width: "100%",
        height,
        background: "rgba(255,255,255,0.06)",
        borderRadius: height,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${clamped}%`,
          height: "100%",
          background: color,
          borderRadius: height,
          transition: "width 200ms ease-out",
        }}
      />
    </div>
  );
};
