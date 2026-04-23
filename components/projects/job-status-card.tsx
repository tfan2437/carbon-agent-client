"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Clock } from "lucide-react";

import type { Job, JobProgress, JobWarning } from "@/lib/domain/ghg";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { JobStatusBadge } from "@/components/projects/job-status-badge";

function parseProgress(raw: Job["progress"]): JobProgress | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const done = typeof obj.done === "number" ? obj.done : 0;
  const total = typeof obj.total === "number" ? obj.total : 0;
  const current =
    typeof obj.current === "string" ? obj.current : null;
  return { done, total, current };
}

function parseWarnings(raw: Job["warnings"]): JobWarning[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  return raw as JobWarning[];
}

function formatDuration(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const secs = Math.max(0, Math.round((end - start) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem === 0 ? `${mins}m` : `${mins}m ${rem}s`;
}

function formatStart(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActiveJobCard({ job }: { job: Job }) {
  const progress = parseProgress(job.progress);
  const warnings = parseWarnings(job.warnings);
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : job.status === "queued"
        ? 0
        : 5;

  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    if (job.status !== "running" || !job.started_at) return;
    const startedAt = job.started_at;
    const check = () => {
      const started = new Date(startedAt).getTime();
      setStuck(Date.now() - started > 15 * 60 * 1000);
    };
    const timeout = setTimeout(check, 0);
    const interval = setInterval(check, 30_000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [job.status, job.started_at]);

  return (
    <div className="rounded-lg border bg-card px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <JobStatusBadge status={job.status} />
            <span className="text-xs text-muted-foreground">
              {progress ? `${progress.done}/${progress.total}` : null}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Started {job.started_at ? formatStart(job.started_at) : "—"} ·
            elapsed {formatDuration(job.started_at, null)}
          </div>
        </div>
      </div>

      <Progress value={pct} />

      {progress?.current ? (
        <div className="text-sm text-muted-foreground truncate">
          Current: <span className="text-foreground">{progress.current}</span>
        </div>
      ) : null}

      {stuck ? (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <Clock className="size-4 mt-0.5" aria-hidden />
          This job has been running for more than 15 minutes — it may be stuck.
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="text-xs text-muted-foreground">
          {warnings.length} warning{warnings.length === 1 ? "" : "s"} so far.
        </div>
      ) : null}
    </div>
  );
}

function RecentJobRow({ job }: { job: Job }) {
  const [open, setOpen] = useState(false);
  const warnings = parseWarnings(job.warnings);
  const progress = parseProgress(job.progress);
  const hasDetail = warnings.length > 0 || !!job.error;

  return (
    <div className="rounded-md border px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => hasDetail && setOpen((x) => !x)}
        className={cn(
          "flex w-full items-center justify-between gap-2 text-left",
          hasDetail ? "cursor-pointer" : "cursor-default",
        )}
      >
        <span className="flex items-center gap-2">
          <JobStatusBadge status={job.status} />
          <span className="text-muted-foreground">
            {progress ? `${progress.done}/${progress.total}` : null}
          </span>
        </span>
        <span className="flex items-center gap-2 text-muted-foreground">
          <span>{formatStart(job.created_at)}</span>
          <span>· {formatDuration(job.started_at, job.finished_at)}</span>
          {hasDetail ? (
            open ? <ChevronDown className="size-3" aria-hidden /> : <ChevronRight className="size-3" aria-hidden />
          ) : null}
        </span>
      </button>

      {open && hasDetail ? (
        <div className="mt-2 space-y-2 border-t pt-2">
          {job.error ? (
            <div className="flex items-start gap-2 text-destructive">
              <AlertTriangle className="size-3.5 mt-0.5" aria-hidden />
              <span className="font-mono text-[11px] break-all">{job.error}</span>
            </div>
          ) : null}
          {warnings.length > 0 ? (
            <ul className="space-y-1 text-muted-foreground">
              {warnings.slice(0, 10).map((w, i) => (
                <li key={i} className="font-mono text-[11px]">
                  {(w.kind ? `[${w.kind}] ` : "") + (w.message ?? JSON.stringify(w))}
                </li>
              ))}
              {warnings.length > 10 ? (
                <li className="text-[11px] italic">+{warnings.length - 10} more</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export interface RecentJobsListProps {
  jobs: Job[];
}

export function RecentJobsList({ jobs }: RecentJobsListProps) {
  if (jobs.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Recent jobs
      </div>
      <div className="space-y-2">
        {jobs.slice(0, 5).map((job) => (
          <RecentJobRow key={job.id} job={job} />
        ))}
      </div>
    </div>
  );
}
