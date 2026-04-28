"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type {
  GHGGraphData,
  GraphVersionListItem,
  GraphVersionSummary,
} from "@/lib/types";

type Client = SupabaseClient<Database>;

// Listing query — never selects graph_json so the rail can render N
// versions without paying for the (potentially MB-sized) blob.
export async function listGraphVersions(
  supabase: Client,
  projectId: string,
): Promise<GraphVersionListItem[]> {
  const { data, error } = await supabase
    .from("graphs")
    .select("id, version_number, built_at, job_id, summary")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false });
  if (error) {
    throw new Error(`listGraphVersions failed: ${error.message}`);
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    version_number: row.version_number,
    built_at: row.built_at,
    job_id: row.job_id,
    summary: row.summary as unknown as GraphVersionSummary,
  }));
}

export async function loadGraphVersionJson(
  supabase: Client,
  versionId: string,
): Promise<GHGGraphData> {
  const { data, error } = await supabase
    .from("graphs")
    .select("graph_json")
    .eq("id", versionId)
    .maybeSingle();
  if (error) {
    throw new Error(`loadGraphVersionJson failed: ${error.message}`);
  }
  if (!data?.graph_json) {
    throw new Error(`Graph version not found: ${versionId}`);
  }
  return data.graph_json as unknown as GHGGraphData;
}

export async function loadLatestGraphVersionJson(
  supabase: Client,
  projectId: string,
): Promise<GHGGraphData> {
  const { data, error } = await supabase
    .from("graphs")
    .select("graph_json")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(`loadLatestGraphVersionJson failed: ${error.message}`);
  }
  if (!data?.graph_json) {
    throw new Error(`No graph version exists for project: ${projectId}`);
  }
  return data.graph_json as unknown as GHGGraphData;
}
