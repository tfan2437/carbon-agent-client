import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { JobStatus } from "@/lib/domain/ghg";

const MAP: Record<JobStatus, { label: string; className: string }> = {
  queued: {
    label: "Queued",
    className: "bg-muted text-foreground border-border",
  },
  running: {
    label: "Running",
    className:
      "bg-sky-500/15 text-sky-300 border-sky-500/40 animate-pulse",
  },
  succeeded: {
    label: "Succeeded",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/20 text-destructive border-destructive/40",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted text-muted-foreground border-border",
  },
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const { label, className } = MAP[status];
  return (
    <Badge variant="outline" className={cn("font-medium", className)}>
      {label}
    </Badge>
  );
}
