import type { CreateJobResponse } from "@/lib/domain/ghg";

/**
 * Send every document in the project to the backend for processing.
 * The backend dedupes by content hash, so this is always safe to call.
 * See lingcarbon-phase-2-frontend.md §12 for the contract.
 */
export async function startJob(
  projectId: string,
  documentIds: string[],
  opts: { reporting_year?: number; company_id?: string } = {},
): Promise<CreateJobResponse> {
  if (documentIds.length === 0) {
    throw new Error("No documents to process");
  }
  const res = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      document_ids: documentIds,
      ...opts,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Failed to start job (${res.status})${body ? `: ${body}` : ""}`,
    );
  }
  return (await res.json()) as CreateJobResponse;
}
