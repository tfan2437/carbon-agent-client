import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/projects/empty-state";
import { ProjectCard } from "@/components/projects/project-card";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, company_id, reporting_year, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="container mx-auto px-6 py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            GHG inventory projects — upload documents, trigger processing, inspect results.
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus aria-hidden />
            New Project
          </Link>
        </Button>
      </header>

      {error ? (
        <Alert variant="destructive" className="mb-8">
          <AlertTitle>Could not load projects</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : !projects || projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </main>
  );
}
