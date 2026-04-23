"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadProgress } from "@/lib/ghg/upload";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadItem({ progress }: { progress: UploadProgress }) {
  const { phase, filename, size, error } = progress;
  const Icon = phase === "error" ? AlertTriangle : phase === "done" ? CheckCircle2 : Loader2;
  const label =
    phase === "queued"
      ? "Queued"
      : phase === "uploading"
        ? "Uploading"
        : phase === "inserting"
          ? "Saving"
          : phase === "done"
            ? "Uploaded"
            : "Failed";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2 text-sm",
        phase === "error"
          ? "border-destructive/50 bg-destructive/10 text-destructive-foreground"
          : "border-border bg-muted/30",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          phase === "done"
            ? "text-emerald-500"
            : phase === "error"
              ? "text-destructive"
              : "animate-spin text-muted-foreground",
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="truncate">{filename}</div>
        {phase === "error" ? (
          <div className="text-xs text-destructive">{error}</div>
        ) : (
          <div className="text-xs text-muted-foreground">
            {formatSize(size)} · {label}
          </div>
        )}
      </div>
    </div>
  );
}
