"use client";

import { createClient } from "@/lib/supabase/client";

const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "ghg";

/**
 * Cascade-delete a project: its Storage blobs first, then dependent
 * rows (emission_results / records / graphs / jobs / documents), then
 * the project row itself. Tables may or may not have ON DELETE CASCADE
 * at the DB level — we don't rely on it.
 *
 * Realtime DELETE events will fire for documents + jobs subscribers;
 * navigating away from /projects/[id] during deletion is fine.
 */
export async function deleteProject(projectId: string): Promise<void> {
  const supabase = createClient();

  // 1. Collect every storage_path this project owns so we can remove
  //    the blobs. We use the DB as the source of truth rather than
  //    recursively listing the bucket.
  const { data: docs, error: docsErr } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("project_id", projectId);
  if (docsErr) throw new Error(`List documents failed: ${docsErr.message}`);

  const paths = (docs ?? [])
    .map((d) => d.storage_path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);

  // 2. Remove Storage blobs. supabase-js caps remove() payloads; chunk
  //    to be safe even though 1000 is the practical limit.
  if (paths.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < paths.length; i += CHUNK) {
      const slice = paths.slice(i, i + CHUNK);
      const { error: storageErr } = await supabase.storage
        .from(BUCKET)
        .remove(slice);
      if (storageErr) {
        throw new Error(`Storage remove failed: ${storageErr.message}`);
      }
    }
  }

  // 3. Delete dependent rows. Order matters if FKs have no CASCADE.
  const tables = [
    "emission_results",
    "records",
    "graphs",
    "jobs",
    "documents",
  ] as const;
  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("project_id", projectId);
    if (error) {
      throw new Error(`Delete ${table} failed: ${error.message}`);
    }
  }

  // 4. Finally the project itself.
  const { error: projectErr } = await supabase
    .from("projects")
    .delete()
    .eq("id", projectId);
  if (projectErr) {
    throw new Error(`Delete project failed: ${projectErr.message}`);
  }
}

export interface BulkDeleteResult {
  ok: { id: string; name: string }[];
  failed: { id: string; name: string; error: string }[];
}

/**
 * Cascade-delete many projects in parallel. Each call goes through the same
 * deleteProject() above, so cascade semantics are identical. Failures don't
 * block other deletes — partial successes are surfaced via the result.
 */
export async function bulkDeleteProjects(
  projects: { id: string; name: string }[],
): Promise<BulkDeleteResult> {
  const results = await Promise.allSettled(
    projects.map((p) => deleteProject(p.id)),
  );
  const ok: BulkDeleteResult["ok"] = [];
  const failed: BulkDeleteResult["failed"] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      ok.push(projects[i]);
    } else {
      failed.push({
        ...projects[i],
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  });
  return { ok, failed };
}
