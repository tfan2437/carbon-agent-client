"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import {
  ACCEPTED_EXTS,
  COMPANIES,
  MAX_FILE_SIZE,
  TERMINAL_JOB_STATUSES,
  UPLOAD_CONCURRENCY,
  hasAcceptedExt,
  isActiveJob,
} from "@/lib/domain/ghg";
import type { Document, Job, JobStatus, Project } from "@/lib/domain/ghg";
import {
  uploadDocumentsConcurrently,
  deleteDocument,
  type UploadProgress,
} from "@/lib/ghg/upload";
import { startJob } from "@/lib/ghg/jobs";
import type { GHGGraphData } from "@/lib/types";

import { Shell, PageHeader } from "@/components/engram/Shell";
import { Glyph, Icon } from "@/components/engram/Primitives";
import { useGraphCache } from "@/components/projects/graph-cache-context";
import { ProjectDeleteButton } from "@/components/projects/project-delete-button";
import {
  StatusPill,
  type V6Status,
} from "@/components/projects/v6-status-pill";
import {
  StatusFilterButtons,
  type V6Counts,
  type V6Filter,
} from "@/components/projects/v6-status-filter";
import { Pager } from "@/components/projects/v6-pager";
import { Progress } from "@/components/projects/v6-progress";
import {
  formatEta,
  formatRelative,
  formatSize,
  glyphKindFor,
  mapDocStatus,
  type V6GlyphKind,
} from "@/components/projects/v6-doc-row-helpers";

const PER_PAGE = 10;
const ACCEPT_ATTR = ACCEPTED_EXTS.join(",");

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

type V6Row = {
  id: string;
  filename: string;
  size: number | null;
  status: V6Status;
  uploadedAt: string | null;
  glyphKind: V6GlyphKind;
  storagePath: string | null;
  isUploading: boolean;
  title?: string;
  rawDocStatus?: Document["status"];
};

export interface ProjectDetailClientProps {
  project: Project;
  initialDocuments: Document[];
  initialJobs: Job[];
}

export function ProjectDetailClient({
  project,
  initialDocuments,
  initialJobs,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const graphCache = useGraphCache();

  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [uploadingMap, setUploadingMap] = useState<Map<string, UploadProgress>>(
    new Map(),
  );
  const [filter, setFilter] = useState<V6Filter>("all");
  const [page, setPage] = useState(1);
  const [submittingJob, setSubmittingJob] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const seenTerminals = useRef<Set<string>>(
    new Set(
      initialJobs
        .filter((j) => TERMINAL_JOB_STATUSES.includes(j.status))
        .map((j) => j.id),
    ),
  );
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Prefetch the built graph into the client-side cache as soon as a
  // succeeded job exists. Keeps the "View Graph" click instant.
  const hasSucceededJob = jobs.some((j) => j.status === "succeeded");
  useEffect(() => {
    if (!hasSucceededJob) return;
    if (graphCache.get(project.id)) return;
    let cancelled = false;
    (async () => {
      const { data: row } = await supabase
        .from("graphs")
        .select("graph_json")
        .eq("project_id", project.id)
        .order("built_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !row?.graph_json) return;
      graphCache.set(project.id, row.graph_json as unknown as GHGGraphData);
    })();
    return () => {
      cancelled = true;
    };
  }, [hasSucceededJob, supabase, project.id, graphCache]);

  // Stop the browser from navigating when the user drops a file outside the zone.
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  // ---------- Upload pipeline ----------

  const validateAndCollect = useCallback(
    (fileList: FileList | File[]): File[] => {
      const files = Array.from(fileList);
      const accepted: File[] = [];
      for (const file of files) {
        if (!hasAcceptedExt(file.name)) {
          toast.error(`${file.name}: unsupported file type`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name}: exceeds 50 MB limit`);
          continue;
        }
        accepted.push(file);
      }
      return accepted;
    },
    [],
  );

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = validateAndCollect(fileList);
      if (files.length === 0) return;
      void uploadDocumentsConcurrently(
        project.id,
        files,
        UPLOAD_CONCURRENCY,
        (progress) => {
          setUploadingMap((prev) => {
            const next = new Map(prev);
            if (progress.phase === "done" || progress.phase === "error") {
              next.delete(progress.documentId);
            } else if (
              progress.phase === "uploading" ||
              progress.phase === "inserting"
            ) {
              next.set(progress.documentId, progress);
            }
            return next;
          });
          if (progress.phase === "done" && progress.document) {
            addOrUpdateDocument(progress.document);
          }
          if (progress.phase === "error") {
            toast.error(
              progress.error
                ? `${progress.filename}: ${progress.error}`
                : `${progress.filename}: upload failed`,
            );
          }
        },
      );
    },
    [project.id, validateAndCollect, addOrUpdateDocument],
  );

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current += 1;
    if (e.dataTransfer?.types?.includes("Files")) setIsDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragging(false);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  };
  const openPicker = () => inputRef.current?.click();
  const onZoneKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  };

  // ---------- Row delete ----------

  const handleDelete = useCallback(
    async (row: V6Row) => {
      if (!row.storagePath) return;
      const ok = window.confirm(`Delete "${row.filename}"?`);
      if (!ok) return;
      try {
        await deleteDocument(row.id, row.storagePath);
        removeDocument(row.id);
        toast.success(`Deleted ${row.filename}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    },
    [removeDocument],
  );

  // ---------- Process job ----------

  const activeJob = jobs.find((j) => isActiveJob(j));

  const handleProcess = useCallback(async () => {
    const docIds = documents
      .filter((d) => d.status === "uploaded")
      .map((d) => d.id);
    if (docIds.length === 0) {
      toast.error("No uploaded documents to process");
      return;
    }
    setSubmittingJob(true);
    try {
      const result = await startJob(project.id, docIds);
      toast.success(
        `Job queued — ${result.document_count} document${result.document_count === 1 ? "" : "s"}`,
      );
      addOrUpdateJob({
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
      setSubmittingJob(false);
    }
  }, [documents, project.id, addOrUpdateJob]);

  // ---------- Derived rows ----------

  const rows = useMemo<V6Row[]>(() => {
    const uploadingRows: V6Row[] = Array.from(uploadingMap.values()).map(
      (p) => ({
        id: `upl-${p.documentId}`,
        filename: p.filename,
        size: p.size,
        status: "uploading",
        uploadedAt: null,
        glyphKind: "file",
        storagePath: null,
        isUploading: true,
      }),
    );
    const documentRows: V6Row[] = documents.map((d) => ({
      id: d.id,
      filename: d.filename,
      size: d.file_size_bytes,
      status: mapDocStatus(d.status),
      uploadedAt: d.uploaded_at,
      glyphKind: glyphKindFor(d.doc_type),
      storagePath: d.storage_path,
      isUploading: false,
      title:
        d.status === "duplicate"
          ? "Hash-dedup of an already-processed file"
          : undefined,
      rawDocStatus: d.status,
    }));
    return [...uploadingRows, ...documentRows];
  }, [uploadingMap, documents]);

  const counts = useMemo<V6Counts>(() => {
    const c: V6Counts = {
      all: rows.length,
      uploading: 0,
      uploaded: 0,
      processing: 0,
      processed: 0,
      error: 0,
    };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const filtered = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
    [rows, filter],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PER_PAGE;
  const visible = filtered.slice(start, start + PER_PAGE);

  const handleFilter = useCallback((next: V6Filter) => {
    setFilter(next);
    setPage(1);
  }, []);

  // ---------- Rail counts + ETA ----------

  const railTotal = counts.processed + counts.processing + counts.error;
  const railDone = counts.processed;
  const railPct = railTotal > 0 ? (railDone / railTotal) * 100 : 0;

  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!activeJob) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeJob]);

  const etaText = useMemo(() => {
    if (!activeJob || !activeJob.started_at || now === 0) return null;
    const startedMs = new Date(activeJob.started_at).getTime();
    if (Number.isNaN(startedMs)) return null;
    const elapsed = (now - startedMs) / 1000;
    if (elapsed < 5 || railDone <= 0) return null;
    const remaining = railTotal - railDone;
    if (remaining <= 0) return null;
    const perDoc = elapsed / Math.max(1, railDone);
    return formatEta(perDoc * remaining);
  }, [activeJob, now, railTotal, railDone]);

  const uploadedCount = counts.uploaded;
  const processDisabled =
    submittingJob || uploadedCount === 0 || !!activeJob;
  const processTitle = activeJob
    ? "Wait for the current job to finish"
    : uploadedCount === 0
      ? "Upload at least one document to enable processing"
      : undefined;

  const viewGraphDisabled = !graphCache.get(project.id) && !hasSucceededJob;

  // ---------- Render ----------

  return (
    <Shell>
      <PageHeader
        crumbs={[
          <Link key="projects" href="/projects" className="crumb-link">
            Projects
          </Link>,
          project.name,
        ]}
        actions={
          <>
            <span
              className="mono"
              style={{
                fontSize: 11.5,
                color: "var(--fg-4)",
                whiteSpace: "nowrap",
              }}
            >
              {companyLabel(project.company_id)} · {project.reporting_year}
            </span>
            <div
              style={{
                width: 1,
                height: 18,
                background: "var(--border)",
              }}
            />
            <ProjectDeleteButton
              projectId={project.id}
              projectName={project.name}
              redirectTo="/projects"
            />
          </>
        }
      />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "360px 1fr",
            gap: 16,
            padding: "16px 20px 0",
            minHeight: 0,
          }}
        >
          <DropZone
            isDragging={isDragging}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={openPicker}
            onKeyDown={onZoneKeyDown}
            inputRef={inputRef}
            onInputChange={(e) => {
              if (e.target.files?.length) handleFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <h3 className="serif" style={{ fontSize: 16 }}>
                Documents
              </h3>
              <div style={{ flex: 1 }} />
              <StatusFilterButtons
                filter={filter}
                onFilter={handleFilter}
                counts={counts}
              />
            </div>

            <div
              className="card"
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <DocumentsTable rows={visible} onDelete={handleDelete} />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 4px",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--fg-4)" }}
              >
                {filtered.length === 0
                  ? "0 of 0"
                  : `${start + 1}–${Math.min(
                      start + PER_PAGE,
                      filtered.length,
                    )} of ${filtered.length}`}
              </span>
              <Pager
                page={safePage}
                total={totalPages}
                onPage={setPage}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "0 0 auto",
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <div
            style={{
              flex: 1,
              maxWidth: 460,
              minWidth: 280,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
              }}
            >
              <span
                style={{
                  color: "var(--fg)",
                  fontSize: 13,
                  fontWeight: 510,
                }}
              >
                Processing
              </span>
              <span
                className="mono"
                style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}
              >
                <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                  {railDone}
                </span>
                <span style={{ color: "var(--fg-4)" }}>{` / ${railTotal}`}</span>
              </span>
              <span style={{ fontSize: 11.5, color: "var(--fg-4)" }}>
                documents
              </span>
              <span style={{ flex: 1 }} />
              {etaText && (
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--fg-4)" }}
                >
                  {etaText}
                </span>
              )}
            </div>
            <Progress pct={railPct} />
          </div>

          <div style={{ flex: 1 }} />

          <button
            type="button"
            className="btn"
            disabled={viewGraphDisabled}
            style={{
              opacity: viewGraphDisabled ? 0.5 : 1,
              cursor: viewGraphDisabled ? "not-allowed" : "pointer",
            }}
            onClick={() => router.push(`/projects/${project.id}/graph`)}
          >
            <Icon name="graph" size={13} color="var(--fg-2)" />
            View Graph
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={processDisabled}
            title={processTitle}
            onClick={handleProcess}
            style={{
              opacity: processDisabled ? 0.5 : 1,
              cursor: processDisabled ? "not-allowed" : "pointer",
            }}
          >
            <Icon name="play" size={12} color="var(--primary-ink)" />
            {`Process ${uploadedCount} file${uploadedCount === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </Shell>
  );
}

// ---------- Drop zone ----------

const DropZone: React.FC<{
  isDragging: boolean;
  onDragEnter: (e: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onDrop: (e: DragEvent<HTMLDivElement>) => void;
  onClick: () => void;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({
  isDragging,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onClick,
  onKeyDown,
  inputRef,
  onInputChange,
}) => {
  const [isHover, setIsHover] = useState(false);
  const active = isDragging || isHover;
  return (
  <div
    role="button"
    tabIndex={0}
    aria-label="Upload files"
    onClick={onClick}
    onKeyDown={onKeyDown}
    onDragEnter={onDragEnter}
    onDragOver={onDragOver}
    onDragLeave={onDragLeave}
    onDrop={onDrop}
    onMouseEnter={() => setIsHover(true)}
    onMouseLeave={() => setIsHover(false)}
    style={{
      width: 360,
      height: "100%",
      padding: 24,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
      position: "relative",
      overflow: "hidden",
      cursor: "pointer",
      borderRadius: 12,
      border: `1.5px dashed ${
        active ? "var(--primary-line)" : "var(--border-3)"
      }`,
      background: active
        ? "rgba(180,88,64,0.16)"
        : "linear-gradient(180deg, rgba(222,115,86,0.06), rgba(222,115,86,0.01))",
      transition:
        "border-color 260ms ease-out, background 260ms ease-out",
    }}
  >
    <svg
      width={84}
      height={84}
      viewBox="0 0 84 84"
      fill="none"
      stroke="var(--primary)"
      strokeWidth={1.5}
      style={{
        position: "absolute",
        top: 16,
        right: 16,
        opacity: 0.12,
        pointerEvents: "none",
      }}
      aria-hidden
    >
      <rect x="22" y="10" width="40" height="52" rx="4" />
      <rect x="14" y="18" width="40" height="52" rx="4" />
      <rect x="6" y="26" width="40" height="52" rx="4" />
    </svg>

    <div
      style={{
        width: 54,
        height: 54,
        borderRadius: 14,
        background: "var(--primary-soft)",
        border: "1px solid var(--primary-line)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 14,
        color: "var(--primary)",
      }}
    >
      <Icon name="upload" size={24} color="var(--primary)" />
    </div>

    <h3 className="serif" style={{ fontSize: 17, marginBottom: 6 }}>
      Drop documents
    </h3>

    <p
      style={{
        fontSize: 12,
        color: "var(--fg-3)",
        maxWidth: 240,
        lineHeight: 1.45,
        marginBottom: 16,
      }}
    >
      PDF · XLSX · JPG · PNG, up to 50 MB each. {UPLOAD_CONCURRENCY} concurrent
      uploads.
    </p>

    <span
      className="btn btn-sm"
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <Icon name="folder" size={12} color="var(--fg-2)" />
      Browse files
    </span>

    <input
      ref={inputRef}
      type="file"
      multiple
      accept={ACCEPT_ATTR}
      style={{ display: "none" }}
      onChange={onInputChange}
    />
  </div>
  );
};

// ---------- Documents table ----------

const HEADER_CELL: React.CSSProperties = {
  textAlign: "left",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--fg-3)",
  letterSpacing: "0.02em",
  padding: "8px 12px",
  borderBottom: "1px solid var(--border)",
};

const BODY_CELL: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid var(--border)",
  fontSize: 13.5,
  color: "var(--fg-2)",
  verticalAlign: "middle",
};

const DocumentsTable: React.FC<{
  rows: V6Row[];
  onDelete: (row: V6Row) => void;
}> = ({ rows, onDelete }) => (
  <div style={{ flex: 1, minHeight: 0, overflow: "auto" }} className="scroll">
    <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <colgroup>
        <col />
        <col style={{ width: 118 }} />
        <col style={{ width: 84 }} />
        <col style={{ width: 96 }} />
        <col style={{ width: 44 }} />
      </colgroup>
      <thead>
        <tr>
          <th style={{ ...HEADER_CELL, paddingLeft: 14 }}>File</th>
          <th style={HEADER_CELL}>Status</th>
          <th style={HEADER_CELL}>Size</th>
          <th style={HEADER_CELL}>Uploaded</th>
          <th style={HEADER_CELL} aria-label="Actions"></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <DocumentRow
            key={row.id}
            row={row}
            isLast={i === rows.length - 1}
            onDelete={onDelete}
          />
        ))}
        {rows.length === 0 && (
          <tr>
            <td
              colSpan={5}
              style={{
                padding: "40px 12px",
                textAlign: "center",
                color: "var(--fg-4)",
                fontSize: 13,
                borderBottom: 0,
              }}
            >
              No documents match this filter.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);

const DocumentRow: React.FC<{
  row: V6Row;
  isLast: boolean;
  onDelete: (row: V6Row) => void;
}> = ({ row, isLast, onDelete }) => {
  const [hover, setHover] = useState(false);
  const cell: React.CSSProperties = {
    ...BODY_CELL,
    borderBottom: isLast ? 0 : BODY_CELL.borderBottom,
    background: hover ? "rgba(255,255,255,0.015)" : "transparent",
  };
  const canDelete = !!row.storagePath;
  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ cursor: "default" }}
    >
      <td style={{ ...cell, paddingLeft: 14 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
          }}
        >
          {row.glyphKind === "file" ? (
            <span
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border-2)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--fg-3)",
                flex: "0 0 20px",
              }}
            >
              <Icon name="file" size={11} />
            </span>
          ) : (
            <Glyph kind={row.glyphKind} size={20} />
          )}
          <span
            title={row.title ?? row.filename}
            style={{
              color: "var(--fg)",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {row.filename}
          </span>
        </div>
      </td>
      <td style={cell}>
        <StatusPill status={row.status} small title={row.title} />
      </td>
      <td
        style={{
          ...cell,
          fontFamily: "var(--font-mono)",
          fontSize: 11.5,
          color: "var(--fg-3)",
        }}
      >
        {formatSize(row.size)}
      </td>
      <td style={{ ...cell, fontSize: 12, color: "var(--fg-3)" }}>
        {formatRelative(row.uploadedAt)}
      </td>
      <td style={{ ...cell, padding: "8px 4px" }}>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label={`More for ${row.filename}`}
          disabled={!canDelete}
          style={{
            opacity: canDelete ? 1 : 0.3,
            cursor: canDelete ? "pointer" : "not-allowed",
          }}
          onClick={() => canDelete && onDelete(row)}
        >
          <Icon name="more" size={13} color="var(--fg-3)" />
        </button>
      </td>
    </tr>
  );
};
