"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Primitives";

// Sidebar — slim, Engram-branded navigation rail.
// Extracted into its own file so it can evolve independently of <Shell>.

type HexLogoProps = { size?: number };

// Hexagon brand glyph (peach gradient, thin inner stroke).
// useId() gives each mount a unique gradient id in case multiple logos render.
export const HexLogo: React.FC<HexLogoProps> = ({ size = 22 }) => {
  const gradId = React.useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E58971" />
          <stop offset="100%" stopColor="#C65A3E" />
        </linearGradient>
      </defs>
      <path d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z" fill={`url(#${gradId})`} />
      <path
        d="M12 6.5 L16.5 9 L16.5 14 L12 16.5 L7.5 14 L7.5 9 Z"
        fill="none" stroke="#1a0f0a" strokeWidth="1.2" opacity="0.6"
      />
    </svg>
  );
};

type SidebarSectionProps = {
  label: string;
  open: boolean;
  onClick: () => void;
};

// Collapsible section header ("Workspace ▾").
export const SidebarSection: React.FC<SidebarSectionProps> = ({ label, open, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-expanded={open}
    style={{
      display: "flex", alignItems: "center", gap: 4,
      padding: "14px 8px 6px", cursor: "pointer",
      color: "var(--fg-4)", fontSize: 11.5, fontWeight: 500,
      textTransform: "uppercase", letterSpacing: "0.08em", userSelect: "none",
      background: "transparent", border: 0, width: "100%",
      textAlign: "left", fontFamily: "inherit",
    }}
  >
    <span>{label}</span>
    <span style={{
      transform: `rotate(${open ? 0 : -90}deg)`,
      transition: "transform 180ms", display: "inline-flex",
    }}>
      <Icon name="chevronDown" size={12} color="var(--fg-4)" />
    </span>
  </button>
);

export interface SidebarNavModel {
  id: string;
  icon: IconName;
  label: string;
  href?: string;
  count?: number;
}

type SidebarNavItemProps = SidebarNavModel & {
  active?: boolean;
};

// A single nav row — renders as Next Link when href is provided, otherwise a plain div placeholder.
export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({ icon, label, count, href, active }) => {
  const className = "nav-item" + (active ? " active" : "");
  const body = (
    <>
      {icon && <span className="nav-icon"><Icon name={icon} size={15} /></span>}
      <span style={{ flex: 1 }}>{label}</span>
      {count != null && (
        <span style={{ fontSize: 11, color: "var(--fg-4)", fontVariantNumeric: "tabular-nums" }}>{count}</span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        aria-current={active ? "page" : undefined}
        style={{ textDecoration: "none" }}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className={className} role="link" aria-disabled="true" tabIndex={0} style={{ cursor: "default" }}>
      {body}
    </div>
  );
};

type SidebarBrandProps = {
  onToggle?: () => void;
};

// Brand row: hex logo + wordmark + sidebar-toggle icon button.
export const SidebarBrand: React.FC<SidebarBrandProps> = ({ onToggle }) => (
  <div style={{ padding: "12px 10px 8px", display: "flex", alignItems: "center", gap: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, padding: "2px 4px" }}>
      <HexLogo size={22} />
      <span style={{
        color: "var(--fg)", fontWeight: 600, fontSize: 14.5,
        letterSpacing: "-0.02em", fontFeatureSettings: '"cv01","ss03"',
      }}>Engram</span>
    </div>
    <button type="button" className="btn btn-ghost btn-icon" aria-label="Toggle sidebar" onClick={onToggle}>
      <Icon name="sidebar" size={15} color="var(--fg-3)" />
    </button>
  </div>
);

// Data-driven nav model so individual items are easy to edit / reorder.
export const SIDEBAR_TOP: SidebarNavModel[] = [
  { id: "search", icon: "search", label: "Search" },
  { id: "mine",   icon: "user",   label: "My projects" },
];

export const SIDEBAR_WORKSPACE: SidebarNavModel[] = [
  { id: "overview", icon: "sparkles", label: "Overview" },
  { id: "projects", icon: "folder",   label: "Projects", href: "/projects" },
  { id: "graph",    icon: "graph",    label: "Graph",    href: "/demo" },
  { id: "reports",  icon: "chart",    label: "Reports" },
  { id: "more",     icon: "more",     label: "More" },
];

// Match a pathname against a sidebar item's href. An exact match or a descendant (href="/projects" covers "/projects/new").
const isActive = (pathname: string, href: string | undefined) => {
  if (!href) return false;
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
};

type SidebarProps = {
  onToggle?: () => void;
};

// The sidebar itself. Active item is derived from pathname — no props needed.
export const Sidebar: React.FC<SidebarProps> = ({ onToggle }) => {
  const pathname = usePathname() ?? "";
  const [openWorkspace, setOpenWorkspace] = React.useState(true);

  return (
    <aside style={{
      width: 220, flex: "0 0 220px", height: "100%",
      background: "var(--bg-deep)",
      borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      fontSize: 13,
    }}>
      <SidebarBrand onToggle={onToggle} />

      <nav className="scroll" style={{ flex: 1, overflow: "auto", padding: "4px 10px 10px" }}>
        {SIDEBAR_TOP.map((it) => (
          <SidebarNavItem key={it.id} {...it} active={isActive(pathname, it.href)} />
        ))}

        <SidebarSection
          label="Workspace"
          open={openWorkspace}
          onClick={() => setOpenWorkspace(!openWorkspace)}
        />
        {openWorkspace && SIDEBAR_WORKSPACE.map((it) => (
          <SidebarNavItem key={it.id} {...it} active={isActive(pathname, it.href)} />
        ))}
      </nav>
    </aside>
  );
};
