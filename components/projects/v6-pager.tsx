"use client";

import * as React from "react";
import { Icon } from "@/components/engram/Primitives";

const buttonStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  border: 0,
  borderRadius: 6,
  background: active ? "rgba(255,255,255,0.06)" : "transparent",
  color: active ? "var(--fg)" : "var(--fg-3)",
  fontSize: 12,
  fontWeight: 510,
  fontFamily: "inherit",
  cursor: disabled ? "default" : "pointer",
  opacity: disabled ? 0.4 : 1,
  transition: "background 150ms ease-out, color 150ms ease-out",
});

export const Pager: React.FC<{
  page: number;
  total: number;
  onPage: (p: number) => void;
}> = ({ page, total, onPage }) => {
  if (total <= 1) return null;
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      <button
        type="button"
        aria-label="Previous page"
        disabled={page === 1}
        onClick={() => page > 1 && onPage(page - 1)}
        style={buttonStyle(false, page === 1)}
      >
        <Icon name="chevronLeft" size={13} />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          aria-label={`Page ${p}`}
          aria-current={p === page ? "page" : undefined}
          onClick={() => onPage(p)}
          style={buttonStyle(p === page, false)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        aria-label="Next page"
        disabled={page === total}
        onClick={() => page < total && onPage(page + 1)}
        style={buttonStyle(false, page === total)}
      >
        <Icon name="chevronRight" size={13} />
      </button>
    </div>
  );
};
