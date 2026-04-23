import Link from "next/link";
import { Building2, Calendar } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { COMPANIES } from "@/lib/domain/ghg";
import { ProjectDeleteButton } from "@/components/projects/project-delete-button";

type ProjectCardProject = {
  id: string;
  name: string;
  company_id: string;
  reporting_year: number;
  created_at: string;
};

function companyLabel(companyId: string): string {
  return COMPANIES.find((c) => c.id === companyId)?.name ?? companyId;
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ProjectCard({ project }: { project: ProjectCardProject }) {
  return (
    <div className="relative">
      <Link
        href={`/projects/${project.id}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
      >
        <Card className="transition-colors hover:border-foreground/20 hover:bg-accent/40">
          <CardHeader>
            <CardTitle className="truncate pr-8 text-base">
              {project.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Building2 className="size-4" aria-hidden />
              <span>{companyLabel(project.company_id)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="size-4" aria-hidden />
              <span>Reporting year {project.reporting_year}</span>
            </div>
            <div className="text-xs pt-2">
              Created {relativeDate(project.created_at)}
            </div>
          </CardContent>
        </Card>
      </Link>
      <div className="absolute right-2 top-2">
        <ProjectDeleteButton
          projectId={project.id}
          projectName={project.name}
        />
      </div>
    </div>
  );
}
