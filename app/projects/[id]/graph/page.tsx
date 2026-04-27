import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { COMPANIES } from "@/lib/domain/ghg";
import { Shell, PageHeader } from "@/components/engram/Shell";
import { Icon } from "@/components/engram/Primitives";
import { GraphViewClient } from "@/components/projects/graph-view-client";

export const dynamic = "force-dynamic";

function companyLabel(companyId: string): string {
  return COMPANIES.find((c) => c.id === companyId)?.name ?? companyId;
}

export default async function ProjectGraphPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch project + graph presence in parallel. The graph_json blob is left
  // out of the RSC roundtrip — the client component reads it from the
  // prefetch cache or queries Supabase directly on a cold visit.
  const [projectRes, graphRes] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, company_id, reporting_year")
      .eq("id", id)
      .single(),
    supabase
      .from("graphs")
      .select("job_id, built_at")
      .eq("project_id", id)
      .order("built_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const project = projectRes.data;
  if (!project) notFound();

  const projectMeta = `${companyLabel(project.company_id)} · ${project.reporting_year}`;
  const crumbs = [
    <Link key="projects" href="/projects" className="crumb-link">
      Projects
    </Link>,
    <Link key="project" href={`/projects/${id}`} className="crumb-link">
      {project.name}
    </Link>,
    "Graph",
  ];

  if (!graphRes.data) {
    return (
      <Shell hideSidebar>
        <PageHeader
          crumbs={crumbs}
          actions={
            <span
              className="mono"
              style={{
                fontSize: 11.5,
                color: "var(--fg-4)",
                whiteSpace: "nowrap",
              }}
            >
              {projectMeta}
            </span>
          }
        />
        <div
          className="scroll"
          style={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            justifyContent: "center",
            padding: "60px 20px",
          }}
        >
          <div style={{ width: 480, maxWidth: "100%" }}>
            <div
              className="card"
              style={{
                padding: 36,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 14,
              }}
            >
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
                  color: "var(--primary)",
                }}
              >
                <Icon name="graph" size={24} color="var(--primary)" />
              </div>
              <h1 className="serif" style={{ fontSize: 22 }}>
                No graph yet
              </h1>
              <p
                style={{
                  fontSize: 13.5,
                  color: "var(--fg-3)",
                  lineHeight: 1.55,
                  maxWidth: 360,
                  margin: 0,
                }}
              >
                Finish a successful processing job on this project first — the
                graph is written once the backend completes extraction.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 6,
                  justifyContent: "center",
                }}
              >
                <Link
                  href={`/projects/${id}`}
                  className="btn btn-ghost"
                  style={{ textDecoration: "none" }}
                >
                  <Icon
                    name="arrowLeft"
                    size={13}
                    color="var(--fg-2)"
                  />
                  Back to project
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <GraphViewClient
      projectId={id}
      projectName={project.name}
      projectMeta={projectMeta}
    />
  );
}
