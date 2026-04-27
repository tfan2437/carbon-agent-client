import type { Document } from "@/lib/domain/ghg";
import { createClient } from "@/lib/supabase/client";

type SupabaseClient = ReturnType<typeof createClient>;

export type ExistingDoc = Pick<
  Document,
  "id" | "filename" | "content_hash" | "storage_path" | "uploaded_at" | "status"
>;

export type DedupCategory = "fresh" | "exact-dup" | "name-conflict";

export interface DedupResult {
  file: File;
  hash: string;
  category: DedupCategory;
  existing?: ExistingDoc;
  inBatchSibling?: File;
}

const QUERY_CHUNK = 50;

/**
 * Categorize files against existing documents in the project. Runs two
 * parallel `.in()` queries (hash, filename) chunked at 50 each so PostgREST
 * URL length stays comfortable. Hash hit wins over filename hit — the schema
 * treats hash as the canonical dedup key.
 */
export async function categorizeUploads(
  supabase: SupabaseClient,
  projectId: string,
  hashes: Map<File, string>,
): Promise<DedupResult[]> {
  const files = Array.from(hashes.keys());
  if (files.length === 0) return [];

  const seenHash = new Map<string, File>();
  const inBatchDups: { file: File; hash: string; sibling: File }[] = [];
  const remaining: { file: File; hash: string }[] = [];
  for (const file of files) {
    const hash = hashes.get(file);
    if (!hash) continue;
    const sibling = seenHash.get(hash);
    if (sibling) {
      inBatchDups.push({ file, hash, sibling });
    } else {
      seenHash.set(hash, file);
      remaining.push({ file, hash });
    }
  }

  const uniqHashes = Array.from(new Set(remaining.map((r) => r.hash)));
  const uniqNames = Array.from(new Set(remaining.map((r) => r.file.name)));

  const [hashRows, nameRows] = await Promise.all([
    fetchByColumn(supabase, projectId, "content_hash", uniqHashes),
    fetchByColumn(supabase, projectId, "filename", uniqNames),
  ]);

  const byHash = new Map<string, ExistingDoc>();
  for (const row of hashRows) {
    if (row.content_hash && !byHash.has(row.content_hash)) {
      byHash.set(row.content_hash, row);
    }
  }
  const byName = new Map<string, ExistingDoc>();
  for (const row of nameRows) {
    if (!byName.has(row.filename)) byName.set(row.filename, row);
  }

  const results: DedupResult[] = [];

  for (const dup of inBatchDups) {
    results.push({
      file: dup.file,
      hash: dup.hash,
      category: "exact-dup",
      inBatchSibling: dup.sibling,
    });
  }

  for (const r of remaining) {
    const hashHit = byHash.get(r.hash);
    if (hashHit) {
      results.push({
        file: r.file,
        hash: r.hash,
        category: "exact-dup",
        existing: hashHit,
      });
      continue;
    }
    const nameHit = byName.get(r.file.name);
    if (nameHit) {
      results.push({
        file: r.file,
        hash: r.hash,
        category: "name-conflict",
        existing: nameHit,
      });
      continue;
    }
    results.push({ file: r.file, hash: r.hash, category: "fresh" });
  }

  return results;
}

async function fetchByColumn(
  supabase: SupabaseClient,
  projectId: string,
  column: "content_hash" | "filename",
  values: string[],
): Promise<ExistingDoc[]> {
  if (values.length === 0) return [];
  const out: ExistingDoc[] = [];
  for (let i = 0; i < values.length; i += QUERY_CHUNK) {
    const chunk = values.slice(i, i + QUERY_CHUNK);
    const { data, error } = await supabase
      .from("documents")
      .select("id,filename,content_hash,storage_path,uploaded_at,status")
      .eq("project_id", projectId)
      .in(column, chunk);
    if (error) {
      throw new Error(`Dedup query failed (${column}): ${error.message}`);
    }
    if (data) out.push(...(data as ExistingDoc[]));
  }
  return out;
}

/**
 * Pick the lowest-numbered "{stem} (N){ext}" filename not already taken.
 * Used when the user picks "Upload as separate copy" in the conflict modal.
 */
export function dedupedFilename(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${stem} (${n})${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${stem} (${Date.now()})${ext}`;
}
