"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import type { GHGGraphData, GraphVersionListItem } from "@/lib/types";
import { useGraphCache } from "@/components/projects/graph-cache-context";
import {
  listGraphVersions,
  loadGraphVersionJson,
  loadLatestGraphVersionJson,
} from "@/lib/ghg/graph-versions";
import { GraphHistoryRail } from "@/components/projects/graph-history-rail";
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
  const router = useRouter();
  const searchParams = useSearchParams();

  // Selected version comes from ?v=<uuid>; absent means "latest".
  const requestedVersionId = searchParams.get("v");

  const [versions, setVersions] = useState<GraphVersionListItem[]>([]);
  // Cache hits flow straight to render; only the async-fetched payload
  // needs local state. Display data prefers the cache so a click on a
  // previously-viewed version is instant.
  const cachedData = cache.get(projectId, requestedVersionId);
  const [fetchedData, setFetchedData] = useState<GHGGraphData | null>(null);
  const data = cachedData ?? fetchedData;
  const [error, setError] = useState<string | null>(null);

  const crumbs = useMemo(
    () => projectCrumbs(projectId, projectName),
    [projectId, projectName],
  );
  const headerActions = useMemo(
    () => projectHeaderActions(projectMeta),
    [projectMeta],
  );

  // Resolve the URL-requested version against the loaded list so we can
  // (a) pin the rail's selection, (b) cache under the canonical version
  // uuid even when the URL is empty (== latest).
  const resolvedVersionId = useMemo(() => {
    if (versions.length === 0) return null;
    if (requestedVersionId) {
      return versions.find((v) => v.id === requestedVersionId)?.id ?? null;
    }
    return versions[0]?.id ?? null; // newest
  }, [versions, requestedVersionId]);

  // Fetch the version list. Re-run when the realtime channel signals a
  // new build (see subscription effect below).
  const [versionsTick, setVersionsTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listGraphVersions(supabase, projectId);
        if (!cancelled) setVersions(list);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, projectId, versionsTick]);

  // Subscribe to graphs inserts on this project so a fresh build appears
  // in the rail without a manual reload. Only refetches the (cheap)
  // summary list — the blob is loaded lazily on selection.
  useEffect(() => {
    const channel = supabase
      .channel(`graphs:project=${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "graphs",
          filter: `project_id=eq.${projectId}`,
        },
        () => setVersionsTick((t) => t + 1),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, projectId]);

  // Derived: the URL points at a v=<uuid> that isn't in the version list.
  // Becomes true only after the list has loaded so we don't flash this
  // during the initial fetch.
  const versionNotFound =
    requestedVersionId !== null &&
    versions.length > 0 &&
    resolvedVersionId === null;

  // Load (or hit cache for) the graph_json of the resolved version.
  // Recomputes whenever the URL-requested version or the resolved id
  // changes (e.g. the rail finished loading and "latest" snapped to v3).
  useEffect(() => {
    if (versionNotFound) return;
    if (resolvedVersionId === null && versions.length === 0) {
      // version list still loading; keep showing whatever we have
      return;
    }
    if (cachedData) return; // cache hit handled by derived render

    let cancelled = false;
    (async () => {
      try {
        const json = requestedVersionId
          ? await loadGraphVersionJson(supabase, requestedVersionId)
          : await loadLatestGraphVersionJson(supabase, projectId);
        if (cancelled) return;
        cache.set(projectId, requestedVersionId, json);
        // Also warm the canonical (resolved-id) cache key so future URL
        // edits land instantly.
        if (!requestedVersionId && resolvedVersionId) {
          cache.set(projectId, resolvedVersionId, json);
        }
        setFetchedData(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    supabase,
    cache,
    projectId,
    requestedVersionId,
    resolvedVersionId,
    versions.length,
    versionNotFound,
    cachedData,
  ]);

  const handleSelectVersion = (versionId: string) => {
    // Newest version → drop the param (URL stays clean for the default view).
    const isLatest = versions[0]?.id === versionId;
    const next = new URLSearchParams(searchParams.toString());
    if (isLatest) {
      next.delete("v");
    } else {
      next.set("v", versionId);
    }
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : `?`, { scroll: false });
  };

  const overlay = (
    <GraphHistoryRail
      versions={versions}
      selectedVersionId={resolvedVersionId}
      onSelect={handleSelectVersion}
    />
  );

  if (versionNotFound) {
    return (
      <GraphChromeStatus
        label={`Version not found: ${requestedVersionId}`}
        isError
        crumbs={crumbs}
        headerActions={headerActions}
      />
    );
  }
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
      // Remount on version change — GHGGraph captures initialData at
      // mount only (see ghg-graph.tsx). Keying by version_id also gives
      // us a clean reset of camera + selection on switch.
      key={resolvedVersionId ?? "initial"}
      initialData={data}
      crumbs={crumbs}
      headerActions={headerActions}
      extraOverlay={overlay}
    />
  );
}
