import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { DocumentStatus } from "@/lib/domain/ghg";

const MAP: Record<DocumentStatus, { label: string; className: string }> = {
  uploaded: {
    label: "Uploaded",
    className: "bg-muted text-foreground border-border",
  },
  processing: {
    label: "Processing",
    className:
      "bg-sky-500/15 text-sky-300 border-sky-500/40 animate-pulse",
  },
  processed: {
    label: "Processed",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  },
  duplicate: {
    label: "Duplicate",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/20 text-destructive border-destructive/40",
  },
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const { label, className } = MAP[status];
  return (
    <Badge variant="outline" className={cn("font-medium", className)}>
      {label}
    </Badge>
  );
}
