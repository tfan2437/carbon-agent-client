/**
 * Web Crypto SHA-256 helpers for client-side file deduplication.
 *
 * Returns lowercase hex strings to match the backend's `documents.content_hash`
 * format (see /Users/wei/Desktop/supabase_db.sql).
 */

export async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

export type HashProgressHandler = (done: number, total: number) => void;

/**
 * Hash files with bounded concurrency. Caps simultaneous in-memory ArrayBuffers
 * so a 50-file batch doesn't OOM mobile Safari (50MB cap × concurrency).
 */
export async function hashFilesConcurrently(
  files: File[],
  concurrency: number,
  onProgress?: HashProgressHandler,
): Promise<Map<File, string>> {
  const result = new Map<File, string>();
  const queue = [...files];
  const total = files.length;
  let done = 0;
  const workerCount = Math.max(1, Math.min(concurrency, queue.length));

  const workers: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i += 1) {
    workers.push(
      (async () => {
        while (queue.length > 0) {
          const file = queue.shift();
          if (!file) return;
          const hash = await hashFile(file);
          result.set(file, hash);
          done += 1;
          onProgress?.(done, total);
        }
      })(),
    );
  }
  await Promise.all(workers);
  return result;
}
