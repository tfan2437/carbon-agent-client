import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectShell } from "@/components/projects/project-shell";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [projectRes, documentsRes, jobsRes] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).single(),
    supabase
      .from("documents")
      .select("*")
      .eq("project_id", id)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("jobs")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const project = projectRes.data;
  if (!project) notFound();

  return (
    <ProjectShell
      project={project}
      initialDocuments={documentsRes.data ?? []}
      initialJobs={jobsRes.data ?? []}
    />
  );
}
