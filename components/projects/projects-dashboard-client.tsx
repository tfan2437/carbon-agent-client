"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon, Sparkline } from "@/components/engram/Primitives";
import { Shell, PageHeader } from "@/components/engram/Shell";
import type { Project, ProjStatus } from "@/components/engram/Data";
import { bulkDeleteProjects } from "@/lib/ghg/projects";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Projects dashboard client — UI layer. Data is fetched server-side in app/projects/page.tsx.

export type DashboardStats = {
  totalProjects: number;
  totalDocsProcessed: number;
  totalDocsPending: number;
  totalDocsFailed: number;
  totalRecords: number;
  totalTco2e: number;
};

type StatusMeta = { label: string; color: string; dotOpacity: number };

const PROJ_STATUS_META: Record<ProjStatus, StatusMeta> = {
  empty:      { label: "Empty",      color: "var(--fg-4)",  dotOpacity: 0.4 },
  uploaded:   { label: "Uploaded",   color: "#6FA4C9",      dotOpacity: 1 },
  processing: { label: "Processing", color: "#E9B84E",      dotOpacity: 1 },
  processed:  { label: "Processed",  color: "#7FA886",      dotOpacity: 1 },
};

export const StatusPill: React.FC<{ status: ProjStatus }> = ({ status }) => {
  const m = PROJ_STATUS_META[status] || PROJ_STATUS_META.empty;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "var(--fg-3)", fontSize: 13 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: m.color, opacity: m.dotOpacity }} />
      {m.label}
    </span>
  );
};

// Completion ring — always peach/orange per ref; full ring = processed.
export const CompletionRing: React.FC<{ pct: number }> = ({ pct }) => {
  const r = 7, c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  const color = "#DE7356";
  return (
    <svg width={18} height={18} viewBox="0 0 18 18" style={{ display: "block" }} aria-hidden="true">
      <circle cx={9} cy={9} r={r} stroke="var(--border-2)" strokeWidth={2} fill="none" />
      <circle cx={9} cy={9} r={r} stroke={color} strokeWidth={2} fill="none"
        strokeDasharray={c} strokeDashoffset={off}
        transform="rotate(-90 9 9)" strokeLinecap="round" />
    </svg>
  );
};

interface ProjectsViewProps {
  projects: Project[];
  selectedIds: Set<string>;
  anySelected: boolean;
  onSingleClick: (id: string) => void;
  onDoubleClick: (id: string) => void;
  onToggleSelect: (id: string) => void;
}

export const ProjectsList: React.FC<ProjectsViewProps> = ({
  projects, selectedIds, anySelected, onSingleClick, onDoubleClick, onToggleSelect,
}) => {
  const [hover, setHover] = React.useState<string | null>(null);
  const headStyle: React.CSSProperties = {
    fontSize: 11.5, color: "var(--fg-4)", fontWeight: 500,
    textTransform: "uppercase", letterSpacing: "0.06em",
    padding: "10px 12px", textAlign: "left",
    borderBottom: "1px solid var(--border)",
  };
  return (
    <div style={{ padding: "0 20px" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
        <colgroup>
          <col />
          <col style={{ width: 160 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 140 }} />
          <col style={{ width: 120 }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" style={headStyle}>Name</th>
            <th scope="col" style={headStyle}>Status</th>
            <th scope="col" style={headStyle}>Last updated</th>
            <th scope="col" style={headStyle}>Emission year</th>
            <th scope="col" style={headStyle}>Completion</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => {
            const isSelected = selectedIds.has(p.id);
            const rowStyle: React.CSSProperties = {
              borderBottom: "1px solid var(--border)",
              fontSize: 13.5,
              background: isSelected
                ? "rgba(222,115,86,0.08)"
                : hover === p.id
                  ? "rgba(255,255,255,0.02)"
                  : "transparent",
              cursor: "pointer",
              userSelect: "none",
            };
            const cellStyle: React.CSSProperties = { padding: "11px 12px", verticalAlign: "middle" };
            const showCheckbox = isSelected || anySelected || hover === p.id;
            return (
              <tr key={p.id}
                onMouseEnter={() => setHover(p.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSingleClick(p.id)}
                onDoubleClick={() => onDoubleClick(p.id)}
                aria-selected={isSelected}
                style={rowStyle}>
                <td style={cellStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(p.id)}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${p.name}`}
                      style={{
                        opacity: showCheckbox ? 1 : 0,
                        transition: "opacity 150ms",
                        cursor: "pointer",
                        flexShrink: 0,
                      }} />
                    <Link
                      href={`/projects/${p.id}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        color: "var(--fg)", fontWeight: 500,
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        textDecoration: "none",
                      }}
                      className="hover:underline">
                      {p.name}
                    </Link>
                  </div>
                </td>
                <td style={cellStyle}>
                  <StatusPill status={p.projStatus} />
                </td>
                <td style={{ ...cellStyle, color: "var(--fg-3)", fontSize: 12.5 }}>
                  {p.updated}
                </td>
                <td style={{ ...cellStyle, color: "var(--fg-3)", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                  {p.year}
                </td>
                <td style={cellStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}
                       title={p.projStatus === "processed" ? "Processed" : p.uploadedDocs === 0 ? "Empty" : `${p.processedDocs} / ${p.uploadedDocs} docs processed`}>
                    <CompletionRing pct={p.completion} />
                    <span style={{ color: "var(--fg-3)", fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>
                      {p.completion}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {projects.length === 0 && (
        <div style={{ padding: "40px 12px", textAlign: "center", color: "var(--fg-4)", fontSize: 13 }}>
          No projects match this filter.
        </div>
      )}
    </div>
  );
};

export const ProjectsCards: React.FC<ProjectsViewProps> = ({
  projects, selectedIds, anySelected, onSingleClick, onDoubleClick, onToggleSelect,
}) => {
  const [hover, setHover] = React.useState<string | null>(null);
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
      padding: "8px 20px 32px",
    }}>
      {projects.map((p) => {
        const isSelected = selectedIds.has(p.id);
        const isHover = hover === p.id;
        const showCheckbox = isSelected || anySelected || isHover;
        const cardStyle: React.CSSProperties = {
          padding: 16, cursor: "pointer", minHeight: 180,
          display: "flex", flexDirection: "column", gap: 12,
          transition: "border-color 180ms, background 180ms",
          userSelect: "none",
          borderColor: isSelected ? "var(--primary-line)" : isHover ? "var(--primary-line)" : "var(--border)",
          background: isSelected
            ? "rgba(222,115,86,0.06)"
            : isHover
              ? "rgba(222,115,86,0.03)"
              : "rgba(255,255,255,0.015)",
        };
        return (
          <div key={p.id}
            className="card"
            style={cardStyle}
            onClick={() => onSingleClick(p.id)}
            onDoubleClick={() => onDoubleClick(p.id)}
            onMouseEnter={() => setHover(p.id)}
            onMouseLeave={() => setHover(null)}
            aria-selected={isSelected}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onToggleSelect(p.id)}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                aria-label={`Select ${p.name}`}
                style={{
                  marginTop: 3,
                  opacity: showCheckbox ? 1 : 0,
                  transition: "opacity 150ms",
                  cursor: "pointer",
                  flexShrink: 0,
                }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link
                  href={`/projects/${p.id}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "block",
                    fontSize: 15, fontWeight: 510, color: "var(--fg)", lineHeight: 1.3,
                    marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden",
                    textOverflow: "ellipsis", letterSpacing: "-0.01em",
                    textDecoration: "none",
                  }}
                  className="hover:underline">
                  {p.name}
                </Link>
                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>
                  {p.company} · {p.year}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon" aria-label="More" onClick={(e) => e.stopPropagation()}><Icon name="more" size={14} color="var(--fg-3)" /></button>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div className="stat-num peach" style={{ fontSize: 24 }}>
                  {p.tco2e === 0 ? "—" : p.tco2e.toLocaleString()}
                </div>
                <div className="stat-label" style={{ fontSize: 10 }}>tCO₂e</div>
              </div>
              <Sparkline data={p.spark} width={120} height={30} color="#DE7356" />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: "auto" }}>
              <StatusPill status={p.projStatus} />
              <span style={{ fontSize: 11.5, color: "var(--fg-4)", marginLeft: "auto" }}>
                {p.uploadedDocs} docs · {p.updated}
              </span>
            </div>
          </div>
        );
      })}
      {projects.length === 0 && (
        <div style={{ gridColumn: "1 / -1", padding: "40px 12px", textAlign: "center", color: "var(--fg-4)", fontSize: 13 }}>
          No projects match this filter.
        </div>
      )}
    </div>
  );
};

const BulkActionBar: React.FC<{
  count: number;
  onDelete: () => void;
  onClear: () => void;
}> = ({ count, onDelete, onClear }) => (
  <div
    role="region"
    aria-label="Bulk selection actions"
    style={{
      position: "fixed",
      left: "50%",
      bottom: 24,
      transform: "translateX(-50%)",
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 8px 8px 16px",
      background: "var(--bg-2)",
      border: "1px solid var(--border)",
      borderRadius: 999,
      boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
      animation: "bar-rise 180ms ease-out",
    }}>
    <span style={{ fontSize: 13, color: "var(--fg)", whiteSpace: "nowrap" }}>
      {count} selected
    </span>
    <div style={{ width: 1, height: 18, background: "var(--border)" }} />
    <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
      Clear
    </button>
    <button
      type="button"
      className="btn btn-sm"
      onClick={onDelete}
      style={{
        background: "rgba(139, 0, 0, 0.5)",
        color: "#fff",
        border: "none",
      }}>
      <Icon name="trash" size={13} color="#fff" /> Delete
    </button>
    <style>{`
      @keyframes bar-rise {
        from { opacity: 0; transform: translate(-50%, 8px); }
        to   { opacity: 1; transform: translate(-50%, 0); }
      }
    `}</style>
  </div>
);

const BulkDeleteDialog: React.FC<{
  open: boolean;
  onOpenChange: (next: boolean) => void;
  projects: { id: string; name: string }[];
  deleting: boolean;
  onConfirm: () => void;
}> = ({ open, onOpenChange, projects, deleting, onConfirm }) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          Delete {projects.length} {projects.length === 1 ? "project" : "projects"}?
        </AlertDialogTitle>
        <AlertDialogDescription>
          The following {projects.length === 1 ? "project" : "projects"} and all of their
          documents, jobs, records, emission results, and built graphs will be permanently
          removed. This cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <ul
        style={{
          maxHeight: 240,
          overflowY: "auto",
          margin: "8px 0",
          padding: "8px 12px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontSize: 13,
          color: "var(--fg-2)",
        }}>
        {projects.map((p) => (
          <li key={p.id} style={{ padding: "3px 0", listStyle: "none" }}>
            {p.name}
          </li>
        ))}
      </ul>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => {
            e.preventDefault();
            onConfirm();
          }}
          disabled={deleting}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
          {deleting
            ? "Deleting…"
            : `Delete ${projects.length} ${projects.length === 1 ? "project" : "projects"}`}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

type ViewMode = "list" | "cards";
type StatusFilter = "all" | ProjStatus;

const STATUS_TABS: { k: StatusFilter; label: string }[] = [
  { k: "all",        label: "All projects" },
  { k: "empty",      label: "Empty" },
  { k: "uploaded",   label: "Uploaded" },
  { k: "processing", label: "Processing" },
  { k: "processed",  label: "Processed" },
];

export default function ProjectsDashboardClient({
  projects,
  stats,
}: {
  projects: Project[];
  stats: DashboardStats;
}) {
  const router = useRouter();
  const [view, setView] = React.useState<ViewMode>("list");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const counts: Record<string, number> = { all: projects.length };
  projects.forEach((p) => { counts[p.projStatus] = (counts[p.projStatus] || 0) + 1; });

  const visible = statusFilter === "all"
    ? projects
    : projects.filter((p) => p.projStatus === statusFilter);

  const navigate = React.useCallback(
    (id: string) => router.push(`/projects/${id}`),
    [router],
  );

  const toggleSelect = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSingleClick = React.useCallback((id: string) => {
    toggleSelect(id);
  }, [toggleSelect]);

  const handleDoubleClick = React.useCallback((id: string) => {
    navigate(id);
  }, [navigate]);

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedProjects = React.useMemo(
    () => projects.filter((p) => selectedIds.has(p.id)).map((p) => ({ id: p.id, name: p.name })),
    [projects, selectedIds],
  );

  async function handleConfirmDelete() {
    if (selectedProjects.length === 0) return;
    setDeleting(true);
    try {
      const result = await bulkDeleteProjects(selectedProjects);
      if (result.ok.length > 0) {
        toast.success(
          `Deleted ${result.ok.length} ${result.ok.length === 1 ? "project" : "projects"}`,
        );
      }
      if (result.failed.length > 0) {
        const first = result.failed[0];
        const more = result.failed.length - 1;
        toast.error(
          more > 0
            ? `Failed to delete ${first.name} (${first.error}) and ${more} other(s)`
            : `Failed to delete ${first.name}: ${first.error}`,
        );
      }
      // Drop the successfully-deleted ids from selection; failures stay selected for retry.
      setSelectedIds((prev) => {
        const next = new Set(prev);
        result.ok.forEach((p) => next.delete(p.id));
        return next;
      });
      setDialogOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const anySelected = selectedIds.size > 0;

  return (
    <Shell>
      <PageHeader
        crumbs={["Projects"]}
        actions={
          <>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Filter"><Icon name="filter" size={15} color="var(--fg-3)" /></button>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Sort"><Icon name="sort" size={15} color="var(--fg-3)" /></button>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Display"><Icon name="layers" size={15} color="var(--fg-3)" /></button>
            <div style={{ width: 1, height: 18, background: "var(--border)" }} />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => router.push("/projects/new")}>
              <Icon name="plus" size={14} color="var(--primary-ink)" /> New project
            </button>
          </>
        }
      />

      <div className="scroll" style={{ flex: 1, overflow: "auto" }}>
        <div style={{ padding: "28px 20px 18px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h1 className="serif" style={{ fontSize: 30, marginBottom: 6 }}>Projects</h1>
              <div style={{ color: "var(--fg-3)", fontSize: 13.5, maxWidth: 560 }}>
                GHG inventory projects — upload documents, trigger processing, and inspect the resulting emissions graph.
              </div>
            </div>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0,
            marginTop: 22, padding: "16px 0",
            borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
          }}>
            {[
              // TODO(next phase): derive "+N this quarter" from created_at cohort; currently static copy.
              { label: "Total projects",      val: stats.totalProjects.toString(),           hint: "Across all companies",                                   peach: false },
              { label: "Documents processed", val: stats.totalDocsProcessed.toString(),      hint: `${stats.totalDocsPending} pending · ${stats.totalDocsFailed} failed`, peach: false },
              { label: "Records processed",   val: stats.totalRecords.toLocaleString(),      hint: "Activity data rows",                                    peach: false },
              { label: "Total tCO₂e tracked", val: stats.totalTco2e === 0 ? "—" : (stats.totalTco2e / 1000).toFixed(1) + "k", hint: "Scope 1 + 2 · YTD",   peach: true  },
            ].map((s, i) => (
              <div key={i} style={{
                padding: "0 20px",
                borderRight: i < 3 ? "1px solid var(--border)" : "none",
              }}>
                <div className={"stat-num" + (s.peach ? " peach" : "")}>{s.val}</div>
                <div className="stat-label" style={{ marginTop: 6 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 4 }}>{s.hint}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "0 20px", display: "flex", alignItems: "center", gap: 4, marginBottom: 6, flexWrap: "wrap" }}>
          <div role="tablist" aria-label="Filter by status" style={{ display: "flex", gap: 4 }}>
            {STATUS_TABS.map((t) => {
              const active = statusFilter === t.k;
              const n = counts[t.k] || 0;
              return (
                <button key={t.k}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(t.k)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    height: 28, padding: "0 10px",
                    background: active ? "rgba(255,255,255,0.06)" : "transparent",
                    color: active ? "var(--fg)" : "var(--fg-3)",
                  }}>
                  {t.label} <span style={{ marginLeft: 4, color: "var(--fg-4)", fontSize: 11.5 }}>{n}</span>
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1 }} />

          <div style={{
            display: "flex", padding: 2, background: "rgba(255,255,255,0.03)",
            borderRadius: 7, border: "1px solid var(--border)",
          }}>
            {([
              { k: "list",  icon: "list" as const, label: "List"  },
              { k: "cards", icon: "grid" as const, label: "Cards" },
            ]).map((t) => (
              <button key={t.k}
                type="button"
                onClick={() => setView(t.k as ViewMode)}
                aria-pressed={view === t.k}
                className="btn btn-ghost btn-sm"
                style={{
                  border: "none", height: 26, padding: "0 10px",
                  background: view === t.k ? "rgba(255,255,255,0.08)" : "transparent",
                  color: view === t.k ? "var(--fg)" : "var(--fg-3)",
                }}>
                <Icon name={t.icon} size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {view === "list"
          ? <ProjectsList
              projects={visible}
              selectedIds={selectedIds}
              anySelected={anySelected}
              onSingleClick={handleSingleClick}
              onDoubleClick={handleDoubleClick}
              onToggleSelect={toggleSelect} />
          : <ProjectsCards
              projects={visible}
              selectedIds={selectedIds}
              anySelected={anySelected}
              onSingleClick={handleSingleClick}
              onDoubleClick={handleDoubleClick}
              onToggleSelect={toggleSelect} />}
      </div>

      {anySelected && (
        <BulkActionBar
          count={selectedIds.size}
          onClear={clearSelection}
          onDelete={() => setDialogOpen(true)}
        />
      )}

      <BulkDeleteDialog
        open={dialogOpen}
        onOpenChange={(next) => { if (!deleting) setDialogOpen(next); }}
        projects={selectedProjects}
        deleting={deleting}
        onConfirm={handleConfirmDelete}
      />
    </Shell>
  );
}
