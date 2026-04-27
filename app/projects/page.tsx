import { createClient } from "@/lib/supabase/server";
import { COMPANIES } from "@/lib/domain/ghg";
import ProjectsDashboardClient, {
  type DashboardStats,
} from "@/components/projects/projects-dashboard-client";
import type { Project, ProjStatus } from "@/components/engram/Data";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

type DocStatus = Database["public"]["Enums"]["document_status"];

// Deterministic pseudo-random sparkline per project id.
// TODO(next phase): derive from emission_results grouped by month(period_start).
function fakeSpark(seed: string, base: number): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0x7fffffff;
  const out: number[] = [];
  for (let i = 0; i < 12; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    out.push(Math.round(base + (h / 0x7fffffff) * base * 1.5));
  }
  return out;
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, diffMs / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = h / 24;
  if (d < 14) return `${Math.round(d)}d ago`;
  return `${Math.round(d / 7)}w ago`;
}

function deriveStatus(docStatuses: DocStatus[], hasActiveJob: boolean): ProjStatus {
  if (docStatuses.length === 0) return "empty";
  if (hasActiveJob || docStatuses.some((s) => s === "processing")) return "processing";
  if (docStatuses.every((s) => s === "processed")) return "processed";
  return "uploaded";
}

export default async function ProjectsPage() {
  const supabase = await createClient();

  const [projectsRes, docsRes, jobsRes, recordsRes, emissionsRes] = await Promise.all([
    supabase.from("projects").select("*").order("updated_at", { ascending: false }),
    supabase.from("documents").select("project_id,status"),
    supabase
      .from("jobs")
      .select("project_id,status")
      .in("status", ["queued", "running"]),
    supabase.from("records").select("project_id"),
    supabase.from("emission_results").select("project_id,emissions_tco2e"),
  ]);

  const projects = projectsRes.data ?? [];
  const documents = docsRes.data ?? [];
  const activeJobs = jobsRes.data ?? [];
  const records = recordsRes.data ?? [];
  const emissions = emissionsRes.data ?? [];

  const docsByProject = new Map<string, DocStatus[]>();
  for (const d of documents) {
    const arr = docsByProject.get(d.project_id) ?? [];
    arr.push(d.status);
    docsByProject.set(d.project_id, arr);
  }
  const activeJobSet = new Set(activeJobs.map((j) => j.project_id));
  const recordsByProject = new Map<string, number>();
  for (const r of records) {
    recordsByProject.set(r.project_id, (recordsByProject.get(r.project_id) ?? 0) + 1);
  }
  const tco2eByProject = new Map<string, number>();
  for (const e of emissions) {
    const prev = tco2eByProject.get(e.project_id) ?? 0;
    tco2eByProject.set(e.project_id, prev + (e.emissions_tco2e ?? 0));
  }

  const companyNameById = new Map(COMPANIES.map((c) => [c.id, c.name]));

  const dashboardProjects: Project[] = projects.map((p) => {
    const docStatuses = docsByProject.get(p.id) ?? [];
    const uploadedDocs = docStatuses.length;
    const processedDocs = docStatuses.filter((s) => s === "processed").length;
    const projStatus = deriveStatus(docStatuses, activeJobSet.has(p.id));
    const completion = uploadedDocs === 0 ? 0 : Math.round((processedDocs / uploadedDocs) * 100);

    return {
      id: p.id,
      name: p.name,
      company: companyNameById.get(p.company_id) ?? p.company_id,
      year: p.reporting_year,
      projStatus,
      lead: 0, // FAKE: no owner column in DB yet.
      uploadedDocs,
      processedDocs,
      tco2e: tco2eByProject.get(p.id) ?? 0,
      records: recordsByProject.get(p.id) ?? 0,
      updated: relativeTime(p.updated_at),
      completion,
      spark: fakeSpark(p.id, 20 + completion * 2), // FAKE: deterministic per-id placeholder.
    };
  });

  const stats: DashboardStats = {
    totalProjects: projects.length,
    totalDocsProcessed: documents.filter((d) => d.status === "processed").length,
    totalDocsPending: documents.filter((d) => d.status === "uploaded" || d.status === "processing").length,
    totalDocsFailed: documents.filter((d) => d.status === "failed").length,
    totalRecords: records.length,
    totalTco2e: emissions.reduce((a, e) => a + (e.emissions_tco2e ?? 0), 0),
  };

  return <ProjectsDashboardClient projects={dashboardProjects} stats={stats} />;
}
