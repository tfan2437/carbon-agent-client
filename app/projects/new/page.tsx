"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/engram/Primitives";
import { Shell, PageHeader } from "@/components/engram/Shell";
import { createClient } from "@/lib/supabase/client";
import { COMPANIES } from "@/lib/domain/ghg";

type YearPickerProps = {
  value: number;
  onChange: (year: number) => void;
  years?: number[];
};

// Segmented 3-button year picker. Controlled — default lives with the parent.
export const YearPicker: React.FC<YearPickerProps> = ({ value, onChange, years = [2024, 2025, 2026] }) => (
  <div role="radiogroup" aria-label="Reporting year" style={{ display: "flex", gap: 8 }}>
    {years.map((y) => {
      const selected = y === value;
      return (
        <button key={y}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(y)}
          className="btn"
          style={{
            flex: 1, height: 38,
            background: selected ? "var(--primary-soft)" : "rgba(255,255,255,0.02)",
            borderColor: selected ? "var(--primary-line)" : "var(--border-2)",
            color: selected ? "var(--primary)" : "var(--fg-2)",
          }}>{y}</button>
      );
    })}
  </div>
);

// New Project — centered single-column form with cream accent
export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [year, setYear] = React.useState(2025);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const cancel = () => router.push("/projects");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setError("Project name must be at least 3 characters");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // Phase 2: only one customer company exists. Phase 4 will replace this
      // with a real company picker driven by Supabase.
      const companyId = COMPANIES[0]?.id ?? "lingcarbon-transport";
      const supabase = createClient();
      const { data, error: insertError } = await supabase
        .from("projects")
        .insert({ name: trimmed, company_id: companyId, reporting_year: year })
        .select("id")
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? "Could not create project");
        return;
      }

      router.push(`/projects/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <PageHeader crumbs={["Projects", "New"]} />
      <div className="scroll" style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: 560, maxWidth: "100%" }}>
          <form onSubmit={submit} className="card" style={{
            padding: 36,
            position: "relative",
            background: "linear-gradient(180deg, rgba(248,238,210,0.035) 0%, rgba(255,255,255,0.01) 100%)",
            border: "1px solid var(--border)",
          }}>
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={cancel} style={{
              position: "absolute", top: 14, right: 14,
            }}>
              <Icon name="x" size={14} color="var(--fg-3)" />
            </button>
            <h1 className="serif" style={{ fontSize: 28, marginBottom: 6 }}>New project</h1>
            <div style={{ color: "var(--fg-3)", fontSize: 13.5, marginBottom: 28 }}>
              One inventory project per company per reporting year. You can add documents and run processing after creation.
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label htmlFor="project-name" style={{ display: "block", fontSize: 12.5, color: "var(--fg-2)", marginBottom: 6, fontWeight: 500 }}>
                  Project name
                </label>
                <input
                  id="project-name"
                  className="input"
                  placeholder="e.g. 零碳運輸 2025"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                />
                <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 6 }}>
                  Shown in the sidebar and on exported reports.
                </div>
              </div>

              <div>
                <label id="company-label" style={{ display: "block", fontSize: 12.5, color: "var(--fg-2)", marginBottom: 6, fontWeight: 500 }}>
                  Company
                </label>
                <div role="group"
                  aria-labelledby="company-label"
                  aria-disabled="true"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    height: 38, padding: "0 12px",
                    background: "rgba(255,255,255,0.015)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--fg-2)",
                    fontSize: 13.5,
                    cursor: "not-allowed",
                    userSelect: "none",
                  }}>
                  <span>{COMPANIES[0]?.name ?? "零碳運輸股份有限公司"}</span>
                  <Icon name="lock" size={13} color="var(--fg-4)" />
                </div>
                <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 6 }}>
                  Locked during Phase 2 — a company picker replaces this once the workspace supports multiple customers.
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12.5, color: "var(--fg-2)", marginBottom: 6, fontWeight: 500 }}>
                  Reporting year
                </label>
                <YearPicker value={year} onChange={setYear} />
              </div>

              <div style={{
                padding: 14, borderRadius: 8,
                background: "var(--cream-soft)",
                border: "1px solid oklch(0.95 0.04 85 / 0.14)",
                display: "flex", gap: 10,
              }}>
                <Icon name="sparkles" size={15} color="var(--cream)" />
                <div style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.55 }}>
                  <b style={{ color: "var(--cream)", fontWeight: 500 }}>Auto-setup:</b> we&apos;ll create default facility buckets for this company based on its last-year inventory. You can adjust them after upload.
                </div>
              </div>

              {error && (
                <div role="alert" style={{
                  padding: "10px 12px", borderRadius: 8,
                  background: "rgba(222,86,86,0.08)",
                  border: "1px solid rgba(222,86,86,0.3)",
                  color: "#E58971", fontSize: 12.5,
                }}>
                  {error}
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 28 }}>
              <button type="button" className="btn btn-ghost" onClick={cancel} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Creating…" : "Create project"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Shell>
  );
}
