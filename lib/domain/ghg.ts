import type { Database } from "@/lib/supabase/types";

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type Job = Database["public"]["Tables"]["jobs"]["Row"];

export type DocumentStatus = Database["public"]["Enums"]["document_status"];
export type JobStatus = Database["public"]["Enums"]["job_status"];

export interface JobProgress {
  done: number;
  total: number;
  current: string | null;
}

export interface JobWarning {
  kind?: string;
  document_id?: string;
  message?: string;
  [key: string]: unknown;
}

export const ACCEPTED_EXTS = [
  ".xlsx",
  ".xls",
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
] as const;

export const ACCEPTED_MIME = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const MIN_FILE_SIZE = 1; // reject 0-byte files (would all dedup to the well-known empty SHA-256)

export const UPLOAD_CONCURRENCY = 3;

export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = ["queued", "running"];
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  "succeeded",
  "failed",
  "cancelled",
];

export interface CompanyOption {
  id: string;
  name: string;
}

// Phase 2 hardcoded company list. Phase 4 moves this to Supabase.
export const COMPANIES: readonly CompanyOption[] = [
  { id: "lingcarbon-transport", name: "零碳運輸股份有限公司" },
] as const;

export interface CreateJobRequest {
  project_id: string;
  document_ids: string[];
  reporting_year?: number;
  company_id?: string;
}

export interface CreateJobResponse {
  job_id: string;
  status: JobStatus;
  document_count: number;
}

export function hasAcceptedExt(filename: string): boolean {
  const lower = filename.toLowerCase();
  return ACCEPTED_EXTS.some((ext) => lower.endsWith(ext));
}

export function isActiveJob(job: Pick<Job, "status">): boolean {
  return ACTIVE_JOB_STATUSES.includes(job.status);
}
