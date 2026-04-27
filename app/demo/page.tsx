"use client";

import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import type { GHGGraphData } from "@/lib/types";
import { Shell, PageHeader } from "@/components/engram/Shell";
import { Icon } from "@/components/engram/Primitives";

const GHGGraph = dynamic(() => import("@/components/ghg-graph"), {
  ssr: false,
  loading: () => <DemoGraphLoading />,
});

const DEMO_CRUMBS: ReactNode[] = [
  <Link key="projects" href="/projects" className="crumb-link">
    Projects
  </Link>,
  "Demo Graph",
];

const DEMO_HEADER_ACTIONS: ReactNode = (
  <span
    className="mono"
    style={{
      fontSize: 11.5,
      color: "var(--fg-4)",
      whiteSpace: "nowrap",
    }}
  >
    Mock data · 2025
  </span>
);

function DemoGraphLoading() {
  return (
    <Shell hideSidebar>
      <PageHeader crumbs={DEMO_CRUMBS} actions={DEMO_HEADER_ACTIONS} />
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--fg-3)",
          fontSize: 13,
        }}
      >
        Loading demo graph…
      </div>
    </Shell>
  );
}

function DemoGraphError({ message }: { message: string }) {
  return (
    <Shell hideSidebar>
      <PageHeader crumbs={DEMO_CRUMBS} actions={DEMO_HEADER_ACTIONS} />
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: "#E58971",
            fontSize: 13,
          }}
        >
          <Icon name="alert" size={14} color="#E58971" />
          {message}
        </div>
      </div>
    </Shell>
  );
}

// Demo route — read-only mock-data showcase. Mirrors the structure of
// /projects/[id]/graph (Shell + PageHeader + dynamic GHGGraph), but the
// graph data comes from the static /mock-data/graph.json file rather
// than Supabase.
export default function DemoPage() {
  const [data, setData] = useState<GHGGraphData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/mock-data/graph.json")
      .then((r) => {
        if (!r.ok) {
          throw new Error(`Failed to load graph.json: ${r.status} ${r.statusText}`);
        }
        return r.json() as Promise<GHGGraphData>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <DemoGraphError message={`Failed to load graph: ${error}`} />;
  if (!data) return <DemoGraphLoading />;

  return (
    <GHGGraph
      initialData={data}
      crumbs={DEMO_CRUMBS}
      headerActions={DEMO_HEADER_ACTIONS}
    />
  );
}
