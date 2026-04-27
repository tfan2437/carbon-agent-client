"use client";

import * as React from "react";
import { Icon } from "./Primitives";
import { Sidebar } from "./Sidebar";

// Shell — app frame: <Sidebar> + main content + optional right rail.
// Sidebar itself lives in components/engram/Sidebar.tsx.

type ShellProps = {
  children?: React.ReactNode;
  rightRail?: React.ReactNode;
};

export const Shell: React.FC<ShellProps> = ({ children, rightRail }) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const toggle = React.useCallback(() => setCollapsed((c) => !c), []);

  return (
    <div className="lc" style={{ display: "flex", height: "100vh", width: "100%", background: "var(--bg)" }}>
      <Sidebar onToggle={toggle} collapsed={collapsed} />
      <main style={{
        flex: 1, minWidth: 0, height: "100%",
        display: "flex", flexDirection: "column", overflow: "hidden",
        position: "relative",
      }}>
        {collapsed && (
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="Open sidebar"
            onClick={toggle}
            style={{ position: "absolute", top: 9, left: 10, zIndex: 5 }}
          >
            <Icon name="sidebar" size={15} color="var(--fg-3)" />
          </button>
        )}
        {children}
      </main>
      {rightRail}
    </div>
  );
};

type PageHeaderProps = {
  title?: string;
  crumbs?: React.ReactNode[];
  actions?: React.ReactNode;
};

// Top bar inside content — thin breadcrumb header.
export const PageHeader: React.FC<PageHeaderProps> = ({ title, crumbs, actions }) => (
  <header style={{
    height: 44, flex: "0 0 44px",
    display: "flex", alignItems: "center",
    padding: "0 16px",
    borderBottom: "1px solid var(--border)",
    gap: 10,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--fg)", fontSize: 13, fontWeight: 500 }}>
      {crumbs ? crumbs.map((c, i) => (
        <React.Fragment key={i}>
          <span style={{ color: i === crumbs.length - 1 ? "var(--fg)" : "var(--fg-3)" }}>{c}</span>
          {i < crumbs.length - 1 && <Icon name="chevronRight" size={12} color="var(--fg-4)" />}
        </React.Fragment>
      )) : <span>{title}</span>}
    </div>
    <div style={{ flex: 1 }} />
    {actions}
  </header>
);
