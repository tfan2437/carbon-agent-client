import * as React from "react";

export type IconName =
  | "search" | "plus" | "chevronDown" | "chevronRight" | "chevronLeft"
  | "more" | "filter" | "sort" | "layers" | "inbox" | "user" | "folder"
  | "grid" | "list" | "settings" | "help" | "upload" | "file" | "fileText"
  | "download" | "check" | "x" | "trash" | "alert" | "clock" | "play"
  | "pause" | "zoom" | "zoomOut" | "graph" | "sparkles" | "arrowLeft"
  | "arrowRight" | "flame" | "zap" | "snowflake" | "factory" | "bus"
  | "workers" | "globe" | "pdf" | "csv" | "xlsx" | "cycle" | "sidebar"
  | "eye" | "edit" | "leaf" | "chart" | "database" | "copy" | "lock";

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
};

// Shared icons — stroke 1.75, lucide-style, 16px default
export const Icon: React.FC<IconProps> = ({ name, size = 16, color = "currentColor", style }) => {
  const sw = 1.75;
  const p: React.SVGProps<SVGSVGElement> = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style,
  };
  const icons: Record<IconName, React.ReactNode> = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    chevronDown: <><path d="m6 9 6 6 6-6"/></>,
    chevronRight: <><path d="m9 18 6-6-6-6"/></>,
    chevronLeft: <><path d="m15 18-6-6 6-6"/></>,
    more: <><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></>,
    filter: <><path d="M3 6h18M6 12h12M10 18h4"/></>,
    sort: <><path d="M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3"/></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></>,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    folder: <><path d="M4 5a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Z"/></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></>,
    help: <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>,
    fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></>,
    check: <><path d="M20 6 9 17l-5-5"/></>,
    x: <><path d="M18 6 6 18M6 6l12 12"/></>,
    trash: <><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
    alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
    play: <><polygon points="5 3 19 12 5 21 5 3"/></>,
    pause: <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>,
    zoom: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></>,
    zoomOut: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/></>,
    graph: <><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v2M10.8 19h2.4M7 17.3l3-2.5M17 17.3l-3-2.5"/></>,
    sparkles: <><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 17l.5 1.5L7 19l-1.5.5L5 21l-.5-1.5L3 19l1.5-.5L5 17zM19 3l.5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5L19 3z"/></>,
    arrowLeft: <><path d="m12 19-7-7 7-7M19 12H5"/></>,
    arrowRight: <><path d="m12 5 7 7-7 7M5 12h14"/></>,
    flame: <><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></>,
    zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    snowflake: <><path d="M2 12h20M12 2v20M4.93 4.93l14.14 14.14M19.07 4.93 4.93 19.07"/></>,
    factory: <><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2zM17 18h1M12 18h1M7 18h1"/></>,
    bus: <><path d="M8 6v6M15 6v6M2 12h19.6M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></>,
    workers: <><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M17 11l2 2 4-4"/></>,
    globe: <><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
    pdf: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h1.5a1.5 1.5 0 0 0 0-3H9v6M14 18v-6h2a1.5 1.5 0 0 1 0 3h-2"/></>,
    csv: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 18h2M14 15v3M16 13.5a1.5 1.5 0 0 0-3 0c0 2 3 1 3 3a1.5 1.5 0 0 1-3 0"/></>,
    xlsx: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13l4 5M12 13l-4 5"/></>,
    cycle: <><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8M21 3v5h-5"/></>,
    sidebar: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></>,
    eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10zM2 21c0-3 1.85-5.36 5.08-6"/></>,
    chart: <><path d="M3 3v18h18M7 16V9M12 16V6M17 16v-4"/></>,
    database: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  };
  return <svg {...p}>{icons[name]}</svg>;
};

type GlyphKind = "fuel" | "electricity" | "refrigerant" | "workers" | "mobile" | "fugitive" | "purchased" | "process";

type GlyphProps = {
  kind: GlyphKind;
  size?: number;
};

// Scope / type glyph colored circle
export const Glyph: React.FC<GlyphProps> = ({ kind, size = 22 }) => {
  const map: Record<GlyphKind, { icon: IconName; color: string }> = {
    fuel:        { icon: "flame",    color: "#E9B84E" },
    electricity: { icon: "zap",      color: "#6FA4C9" },
    refrigerant: { icon: "snowflake",color: "#9FC5E8" },
    workers:     { icon: "workers",  color: "#C6A882" },
    mobile:      { icon: "bus",      color: "#DE7356" },
    fugitive:    { icon: "snowflake",color: "#9FC5E8" },
    purchased:   { icon: "zap",      color: "#6FA4C9" },
    process:     { icon: "factory",  color: "#C8876A" },
  };
  const m = map[kind] || map.fuel;
  return (
    <span style={{
      width: size, height: size, borderRadius: "50%",
      background: `color-mix(in oklab, ${m.color} 14%, transparent)`,
      border: `1px solid color-mix(in oklab, ${m.color} 30%, transparent)`,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      color: m.color, flex: `0 0 ${size}px`,
    }}>
      <Icon name={m.icon} size={size * 0.55} />
    </span>
  );
};

type SparklineProps = {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
};

// Sparkline — 12-month mini bar chart
export const Sparkline: React.FC<SparklineProps> = ({ data, color = "#DE7356", height = 28, width = 120 }) => {
  const max = Math.max(...data, 1);
  const barW = width / data.length - 2;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * height);
        return <rect key={i} x={i * (barW + 2)} y={height - h} width={barW} height={h} rx={1} fill={color} opacity={0.55 + 0.45 * (v / max)} />;
      })}
    </svg>
  );
};
