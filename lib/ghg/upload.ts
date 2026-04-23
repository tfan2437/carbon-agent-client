import { createClient } from "@/lib/supabase/client";
import type { Document } from "@/lib/domain/ghg";

export type UploadPhase =
  | "queued"
  | "uploading"
  | "inserting"
  | "done"
  | "error";

export interface UploadProgress {
  documentId: string;
  filename: string;
  size: number;
  phase: UploadPhase;
  error?: string;
  document?: Document;
}

export type UploadProgressHandler = (p: UploadProgress) => void;

function bucketName(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? "ghg";
}

/**
 * Upload a single file to Supabase Storage and insert the matching
 * documents row. On insert failure, best-effort delete the Storage blob
 * so we never leave an orphaned object.
 */
export async function uploadDocument(
  projectId: string,
  file: File,
  onProgress: UploadProgressHandler,
): Promise<Document | null> {
  const supabase = createClient();
  const documentId = crypto.randomUUID();
  const bucket = bucketName();
  const storagePath = `${projectId}/inputs/${documentId}/${file.name}`;
  const base = {
    documentId,
    filename: file.name,
    size: file.size,
  };

  onProgress({ ...base, phase: "uploading" });

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false,
      cacheControl: "3600",
    });

  if (uploadError) {
    onProgress({
      ...base,
      phase: "error",
      error: uploadError.message,
    });
    return null;
  }

  onProgress({ ...base, phase: "inserting" });

  const { data: inserted, error: insertError } = await supabase
    .from("documents")
    .insert({
      id: documentId,
      project_id: projectId,
      storage_path: storagePath,
      filename: file.name,
      file_size_bytes: file.size,
      status: "uploaded",
    })
    .select()
    .single();

  if (insertError || !inserted) {
    await supabase.storage
      .from(bucket)
      .remove([storagePath])
      .catch(() => {
        /* orphan cleanup is best-effort */
      });
    onProgress({
      ...base,
      phase: "error",
      error: insertError?.message ?? "Insert failed",
    });
    return null;
  }

  onProgress({ ...base, phase: "done", document: inserted });
  return inserted;
}

/**
 * Run uploads in parallel with a bounded concurrency limit. Each file is
 * reported independently — no Promise.all rejection semantics.
 */
export async function uploadDocumentsConcurrently(
  projectId: string,
  files: File[],
  concurrency: number,
  onProgress: UploadProgressHandler,
): Promise<void> {
  const queue = [...files];
  const workers: Promise<void>[] = [];
  const workerCount = Math.max(1, Math.min(concurrency, queue.length));

  for (let i = 0; i < workerCount; i += 1) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const file = queue.shift();
          if (!file) return;
          await uploadDocument(projectId, file, onProgress);
        }
      })(),
    );
  }

  await Promise.all(workers);
}

export async function deleteDocument(
  documentId: string,
  storagePath: string,
): Promise<void> {
  const supabase = createClient();
  const bucket = bucketName();

  const { error: removeError } = await supabase.storage
    .from(bucket)
    .remove([storagePath]);
  if (removeError) {
    throw new Error(`Storage delete failed: ${removeError.message}`);
  }

  const { error: dbError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);
  if (dbError) {
    throw new Error(`Database delete failed: ${dbError.message}`);
  }
}
