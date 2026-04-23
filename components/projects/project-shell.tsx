"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { COMPANIES, TERMINAL_JOB_STATUSES } from "@/lib/domain/ghg";
import type { Document, Job, JobStatus, Project } from "@/lib/domain/ghg";
import { Button } from "@/components/ui/button";
import { UploadSection } from "@/components/projects/upload-section";
import { DocumentsSection } from "@/components/projects/documents-section";
import { ProcessingSection } from "@/components/projects/processing-section";

function companyLabel(companyId: string): string {
  return COMPANIES.find((c) => c.id === companyId)?.name ?? companyId;
}

type DocumentChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Document | null;
  old: Document | null;
};

type JobChangePayload = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Job | null;
  old: Job | null;
};

export interface ProjectShellProps {
  project: Project;
  initialDocuments: Document[];
  initialJobs: Job[];
}

export function ProjectShell({
  project,
  initialDocuments,
  initialJobs,
}: ProjectShellProps) {
  const supabase = useMemo(() => createClient(), []);
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const seenTerminals = useRef<Set<string>>(
    new Set(
      initialJobs
        .filter((j) => TERMINAL_JOB_STATUSES.includes(j.status))
        .map((j) => j.id),
    ),
  );

  // Keep the documents list sorted newest-first on every change.
  const addOrUpdateDocument = useCallback((doc: Document) => {
    setDocuments((prev) => {
      const without = prev.filter((d) => d.id !== doc.id);
      return [doc, ...without].sort(
        (a, b) =>
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
      );
    });
  }, []);

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const addOrUpdateJob = useCallback((job: Partial<Job>) => {
    setJobs((prev) => {
      const existing = prev.find((j) => j.id === job.id);
      if (existing) {
        return prev.map((j) =>
          j.id === job.id ? ({ ...j, ...job } as Job) : j,
        );
      }
      if (!job.id) return prev;
      return [job as Job, ...prev];
    });
  }, []);

  // Realtime: documents
  useEffect(() => {
    const channel = supabase
      .channel(`documents:project=${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          const p = payload as unknown as DocumentChangePayload;
          if (p.eventType === "DELETE" && p.old) {
            removeDocument(p.old.id);
          } else if (p.new) {
            addOrUpdateDocument(p.new);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, project.id, addOrUpdateDocument, removeDocument]);

  // Realtime: jobs
  useEffect(() => {
    const channel = supabase
      .channel(`jobs:project=${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "jobs",
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          const p = payload as unknown as JobChangePayload;
          if (p.eventType === "DELETE" && p.old) {
            setJobs((prev) => prev.filter((j) => j.id !== p.old!.id));
            return;
          }
          if (!p.new) return;
          addOrUpdateJob(p.new);

          // Toast on terminal transition, once per job.
          const terminal = TERMINAL_JOB_STATUSES.includes(p.new.status as JobStatus);
          if (terminal && !seenTerminals.current.has(p.new.id)) {
            seenTerminals.current.add(p.new.id);
            if (p.new.status === "succeeded") {
              toast.success("Processing complete");
            } else if (p.new.status === "failed") {
              toast.error(
                p.new.error
                  ? `Processing failed: ${p.new.error}`
                  : "Processing failed",
              );
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, project.id, addOrUpdateJob]);

  return (
    <main className="container mx-auto max-w-4xl px-6 py-10 space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">
            <ArrowLeft aria-hidden />
            All projects
          </Link>
        </Button>
      </div>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted-foreground">
          {companyLabel(project.company_id)} · Reporting year {project.reporting_year}
        </p>
      </header>

      <UploadSection
        projectId={project.id}
        onDocumentUploaded={addOrUpdateDocument}
      />

      <DocumentsSection
        documents={documents}
        onDocumentDeleted={removeDocument}
      />

      <ProcessingSection
        project={project}
        documents={documents}
        jobs={jobs}
        onJobOptimisticallyQueued={addOrUpdateJob}
      />
    </main>
  );
}
