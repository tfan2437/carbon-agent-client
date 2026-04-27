import type { Document, DocumentStatus } from "@/lib/domain/ghg";
import type { V6Status } from "@/components/projects/v6-status-pill";

export type V6GlyphKind =
  | "fuel"
  | "electricity"
  | "refrigerant"
  | "workers"
  | "file";

export function mapDocStatus(s: DocumentStatus): V6Status {
  // duplicate is a hash-dedup of an already-processed file — surface as
  // "processed" so the user-facing meaning ("data is in the system") matches
  // the V6 5-status palette.
  if (s === "failed") return "error";
  if (s === "duplicate") return "processed";
  return s;
}

export function glyphKindFor(docType: Document["doc_type"]): V6GlyphKind {
  if (docType === "fuel") return "fuel";
  if (docType === "electricity") return "electricity";
  if (docType === "refrigerant") return "refrigerant";
  if (docType === "work_hours") return "workers";
  return "file";
}

export function formatSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Math.max(0, Date.now() - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
}

export function formatEta(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const s = Math.round(seconds);
  if (s < 60) return `~${s}s remaining`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `~${m}m ${rem}s remaining`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `~${h}h ${mm}m remaining`;
}
