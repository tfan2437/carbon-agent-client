"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

import { createClient } from "@/lib/supabase/client";
import type { GHGGraphData } from "@/lib/types";
import { useGraphCache } from "@/components/projects/graph-cache-context";

const GHGGraph = dynamic(() => import("@/components/ghg-graph"), {
  ssr: false,
  loading: () => <GraphLoading />,
});

function GraphLoading({ label = "Loading graph..." }: { label?: string }) {
  return (
    <div
      className="w-full h-screen flex items-center justify-center"
      style={{ backgroundColor: "#0B0E14" }}
    >
      <div className="text-gray-400 text-sm">{label}</div>
    </div>
  );
}

export interface GraphViewClientProps {
  projectId: string;
}

export function GraphViewClient({ projectId }: GraphViewClientProps) {
  const supabase = useMemo(() => createClient(), []);
  const cache = useGraphCache();
  const [data, setData] = useState<GHGGraphData | null>(() =>
    cache.get(projectId),
  );
  const [error, setError] = useState<string | null>(null);

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
    return <GraphLoading label={`Failed to load graph: ${error}`} />;
  }
  if (!data) {
    return <GraphLoading />;
  }
  return <GHGGraph initialData={data} />;
}
