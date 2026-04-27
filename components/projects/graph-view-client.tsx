"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { createClient } from "@/lib/supabase/client";
import type { GHGGraphData } from "@/lib/types";
import { useGraphCache } from "@/components/projects/graph-cache-context";
import { Shell, PageHeader } from "@/components/engram/Shell";
import { Icon } from "@/components/engram/Primitives";

const GHGGraph = dynamic(() => import("@/components/ghg-graph"), {
  ssr: false,
  loading: () => <ProjectGraphLoading />,
});

export interface GraphViewClientProps {
  projectId: string;
  projectName: string;
  projectMeta: string;
}

function projectCrumbs(projectId: string, projectName: string): ReactNode[] {
  return [
    <Link key="projects" href="/projects" className="crumb-link">
      Projects
    </Link>,
    <Link
      key="project"
      href={`/projects/${projectId}`}
      className="crumb-link"
    >
      {projectName}
    </Link>,
    "Graph",
  ];
}

function projectHeaderActions(projectMeta: string): ReactNode {
  return (
    <span
      className="mono"
      style={{
        fontSize: 11.5,
        color: "var(--fg-4)",
        whiteSpace: "nowrap",
      }}
    >
      {projectMeta}
    </span>
  );
}

// Loading fallback used during the dynamic-import window. Project context
// isn't in scope here, so the breadcrumbs collapse to "Graph" until the
// real component mounts.
function ProjectGraphLoading() {
  return (
    <Shell hideSidebar>
      <PageHeader crumbs={["Graph"]} />
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
        Loading graph…
      </div>
    </Shell>
  );
}

function GraphChromeStatus({
  label,
  isError = false,
  crumbs,
  headerActions,
}: {
  label: string;
  isError?: boolean;
  crumbs: ReactNode[];
  headerActions?: ReactNode;
}) {
  return (
    <Shell hideSidebar>
      <PageHeader crumbs={crumbs} actions={headerActions} />
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
            color: isError ? "#E58971" : "var(--fg-3)",
            fontSize: 13,
          }}
        >
          {isError && <Icon name="alert" size={14} color="#E58971" />}
          {label}
        </div>
      </div>
    </Shell>
  );
}

export function GraphViewClient({
  projectId,
  projectName,
  projectMeta,
}: GraphViewClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const cache = useGraphCache();
  const [data, setData] = useState<GHGGraphData | null>(() =>
    cache.get(projectId),
  );
  const [error, setError] = useState<string | null>(null);

  const crumbs = useMemo(
    () => projectCrumbs(projectId, projectName),
    [projectId, projectName],
  );
  const headerActions = useMemo(
    () => projectHeaderActions(projectMeta),
    [projectMeta],
  );

  useEffect(() => {
    if (data) return;
    let cancelled = false;
    (async () => {
      const { data: row, error: fetchErr } = await supabase
        .from("graphs")
        .select("graph_json")
        .eq("project_id", projectId)
        .order("built_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
        return;
      }
      if (!row?.graph_json) {
        setError("Graph data missing");
        return;
      }
      const json = row.graph_json as unknown as GHGGraphData;
      cache.set(projectId, json);
      setData(json);
    })();
    return () => {
      cancelled = true;
    };
  }, [data, supabase, projectId, cache]);

  if (error) {
    return (
      <GraphChromeStatus
        label={`Failed to load graph: ${error}`}
        isError
        crumbs={crumbs}
        headerActions={headerActions}
      />
    );
  }
  if (!data) {
    return (
      <GraphChromeStatus
        label="Loading graph…"
        crumbs={crumbs}
        headerActions={headerActions}
      />
    );
  }
  return (
    <GHGGraph
      initialData={data}
      crumbs={crumbs}
      headerActions={headerActions}
    />
  );
}
