"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import {
  ACTIVE_JOB_STATUSES,
  TERMINAL_JOB_STATUSES,
  isActiveJob,
} from "@/lib/domain/ghg";
import type { Document, Job, Project } from "@/lib/domain/ghg";
import { startJob } from "@/lib/ghg/jobs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActiveJobCard, RecentJobsList } from "@/components/projects/job-status-card";

export interface ProcessingSectionProps {
  project: Project;
  documents: Document[];
  jobs: Job[];
  onJobOptimisticallyQueued: (job: Partial<Job>) => void;
}

export function ProcessingSection({
  project,
  documents,
  jobs,
  onJobOptimisticallyQueued,
}: ProcessingSectionProps) {
  const [submitting, setSubmitting] = useState(false);

  const finishedCount = documents.filter(
    (d) => d.status === "uploaded" || d.status === "processed",
  ).length;

  const activeJob = jobs.find((j) => isActiveJob(j));
  const recentJobs = jobs.filter(
    (j) => !activeJob || j.id !== activeJob.id,
  );

  const lastTerminal = jobs.find((j) =>
    TERMINAL_JOB_STATUSES.includes(j.status),
  );
  const showViewGraph = lastTerminal?.status === "succeeded";

  const disabled = submitting || finishedCount === 0 || !!activeJob;
  const reasonLabel = activeJob
    ? `Waiting for ${ACTIVE_JOB_STATUSES.join(" / ")} job to finish`
    : finishedCount === 0
      ? "Upload at least one document to enable processing"
      : null;

  async function handleProcess() {
    const docIds = documents.map((d) => d.id);
    if (docIds.length === 0) {
      toast.error("No documents to process");
      return;
    }
    setSubmitting(true);
    try {
      const result = await startJob(project.id, docIds);
      toast.success(
        `Job queued — ${result.document_count} document${result.document_count === 1 ? "" : "s"}`,
      );
      onJobOptimisticallyQueued({
        id: result.job_id,
        project_id: project.id,
        status: result.status,
        progress: { done: 0, total: result.document_count, current: null },
        warnings: null,
        error: null,
        document_ids: docIds,
        created_at: new Date().toISOString(),
        started_at: null,
        finished_at: null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Job failed to start");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Processing</CardTitle>
            <CardDescription>
              Runs every document in this project through the backend pipeline.
              Previously processed files are hash-deduped — safe to re-click.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {showViewGraph ? (
              <Button variant="outline" asChild>
                <Link href={`/projects/${project.id}/graph`}>View Graph</Link>
              </Button>
            ) : null}
            <Button
              onClick={handleProcess}
              disabled={disabled}
              title={reasonLabel ?? undefined}
            >
              {submitting ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Play aria-hidden />
              )}
              {documents.length > 0
                ? `Process ${documents.length} file${documents.length === 1 ? "" : "s"}`
                : "Process all files"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {reasonLabel ? (
          <div className="text-xs text-muted-foreground">{reasonLabel}</div>
        ) : null}

        {activeJob ? <ActiveJobCard job={activeJob} /> : null}

        <RecentJobsList jobs={recentJobs} />
      </CardContent>
    </Card>
  );
}
